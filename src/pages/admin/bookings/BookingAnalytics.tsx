import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Calendar,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Home,
  BarChart3,
  PieChart,
  Download,
  MapPin,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface OccupancyData {
  property_id: string;
  property_title: string;
  property_location: string;
  total_nights: number;
  booked_nights: number;
  occupancy_rate: number;
  revenue: number;
}

interface RevenueData {
  period: string;
  revenue: number;
  bookings: number;
  average_booking_value: number;
}

interface PerformanceMetrics {
  conversion_rate: number;
  cancellation_rate: number;
  average_booking_duration: number;
  repeat_guest_rate: number;
}

export default function BookingAnalytics() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    conversion_rate: 0,
    cancellation_rate: 0,
    average_booking_duration: 0,
    repeat_guest_rate: 0,
  });
  const [overallStats, setOverallStats] = useState({
    total_revenue: 0,
    total_bookings: 0,
    average_booking_value: 0,
    total_occupancy_rate: 0,
    peak_season: '',
  });

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch short stay bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('short_stay_bookings')
        .select(`
          *,
          property:properties(id, title, location_address, location_county, location_town),
          guest:profiles!short_stay_bookings_guest_id_fkey(id)
        `)
        .gte('check_in_date', dateRange.start)
        .lte('check_out_date', dateRange.end);

      if (bookingsError) throw bookingsError;

      // Calculate occupancy by property
      const propertyMap = new Map<string, OccupancyData>();
      
      bookings?.forEach(booking => {
        if (!booking.property) return;
        
        const propertyId = booking.property.id;
        const nights = Math.ceil(
          (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / 
          (1000 * 60 * 60 * 24)
        );

        if (!propertyMap.has(propertyId)) {
          propertyMap.set(propertyId, {
            property_id: propertyId,
            property_title: booking.property.title || 'Unknown',
            property_location: `${booking.property.location_town || ''}, ${booking.property.location_county || ''}`.trim(),
            total_nights: 0,
            booked_nights: 0,
            occupancy_rate: 0,
            revenue: 0,
          });
        }

        const data = propertyMap.get(propertyId)!;
        data.booked_nights += nights;
        data.revenue += booking.total_amount || 0;
      });

      // Calculate total nights in period
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      const occupancyArray = Array.from(propertyMap.values()).map(data => ({
        ...data,
        total_nights: totalDays,
        occupancy_rate: totalDays > 0 ? (data.booked_nights / totalDays) * 100 : 0,
      }));

      setOccupancyData(occupancyArray.sort((a, b) => b.occupancy_rate - a.occupancy_rate));

      // Calculate revenue by period
      const revenueMap = new Map<string, { revenue: number; bookings: number }>();
      
      bookings?.forEach(booking => {
        let periodKey = '';
        const bookingDate = new Date(booking.check_in_date);
        
        switch (period) {
          case 'daily':
            periodKey = format(bookingDate, 'yyyy-MM-dd');
            break;
          case 'weekly':
            const weekStart = startOfDay(bookingDate);
            periodKey = format(weekStart, 'yyyy-MM-dd');
            break;
          case 'monthly':
            periodKey = format(bookingDate, 'yyyy-MM');
            break;
          case 'yearly':
            periodKey = format(bookingDate, 'yyyy');
            break;
        }

        if (!revenueMap.has(periodKey)) {
          revenueMap.set(periodKey, { revenue: 0, bookings: 0 });
        }

        const data = revenueMap.get(periodKey)!;
        data.revenue += booking.total_amount || 0;
        data.bookings += 1;
      });

      const revenueArray = Array.from(revenueMap.entries())
        .map(([period, data]) => ({
          period,
          revenue: data.revenue,
          bookings: data.bookings,
          average_booking_value: data.bookings > 0 ? data.revenue / data.bookings : 0,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      setRevenueData(revenueArray);

      // Calculate performance metrics
      const totalBookings = bookings?.length || 0;
      const confirmedBookings = bookings?.filter(b => b.status === 'confirmed').length || 0;
      const cancelledBookings = bookings?.filter(b => b.status === 'cancelled').length || 0;
      
      // Calculate average booking duration
      const totalNights = bookings?.reduce((sum, b) => {
        const nights = Math.ceil(
          (new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        return sum + nights;
      }, 0) || 0;
      const avgDuration = totalBookings > 0 ? totalNights / totalBookings : 0;

      // Calculate repeat guest rate (simplified - would need guest history)
      const uniqueGuests = new Set(bookings?.map(b => b.guest_id) || []);
      const repeatGuests = bookings?.filter(b => {
        // This is simplified - would need to check guest booking history
        return false;
      }).length || 0;
      const repeatRate = uniqueGuests.size > 0 ? (repeatGuests / uniqueGuests.size) * 100 : 0;

      setPerformanceMetrics({
        conversion_rate: totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0,
        cancellation_rate: totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0,
        average_booking_duration: avgDuration,
        repeat_guest_rate: repeatRate,
      });

      // Calculate overall stats
      const totalRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
      const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
      const totalOccupancy = occupancyArray.length > 0
        ? occupancyArray.reduce((sum, d) => sum + d.occupancy_rate, 0) / occupancyArray.length
        : 0;

      // Find peak season (month with most bookings)
      const monthlyBookings = new Map<string, number>();
      bookings?.forEach(b => {
        const month = format(new Date(b.check_in_date), 'MMMM');
        monthlyBookings.set(month, (monthlyBookings.get(month) || 0) + 1);
      });
      const peakMonth = Array.from(monthlyBookings.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      setOverallStats({
        total_revenue: totalRevenue,
        total_bookings: totalBookings,
        average_booking_value: avgBookingValue,
        total_occupancy_rate: totalOccupancy,
        peak_season: peakMonth,
      });
    } catch (error: any) {
      logger.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, dateRange]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Booking Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Analyze booking performance, occupancy rates, and revenue trends
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <ExportButton
            data={{
              occupancy: occupancyData,
              revenue: revenueData,
              metrics: performanceMetrics,
              stats: overallStats,
            }}
            filename="booking-analytics"
            label="Export"
          />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Period</Label>
              <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchAnalytics} className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {overallStats.total_revenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {overallStats.total_bookings} bookings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Booking Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {overallStats.average_booking_value.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Per booking
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overallStats.total_occupancy_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Average across properties
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceMetrics.conversion_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Confirmed bookings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Season</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overallStats.peak_season}
            </div>
            <p className="text-xs text-muted-foreground">
              Most bookings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="occupancy" className="w-full">
        <TabsList>
          <TabsTrigger value="occupancy">Occupancy Rates</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analytics</TabsTrigger>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
        </TabsList>

        {/* Occupancy Rates */}
        <TabsContent value="occupancy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Occupancy by Property</CardTitle>
              <CardDescription>
                Occupancy rates and revenue by property for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : occupancyData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No occupancy data available
                </div>
              ) : (
                <div className="space-y-4">
                  {occupancyData.map((data) => (
                    <Card key={data.property_id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="font-semibold">{data.property_title}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {data.property_location}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              {data.occupancy_rate.toFixed(1)}%
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Occupancy
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Booked Nights</div>
                            <div className="font-semibold">{data.booked_nights}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Total Nights</div>
                            <div className="font-semibold">{data.total_nights}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Revenue</div>
                            <div className="font-semibold">
                              KES {data.revenue.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(data.occupancy_rate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Analytics */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>
                Revenue and booking trends over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : revenueData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No revenue data available
                </div>
              ) : (
                <div className="space-y-4">
                  {revenueData.map((data) => (
                    <Card key={data.period}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{data.period}</div>
                            <div className="text-sm text-muted-foreground">
                              {data.bookings} bookings
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              KES {data.revenue.toLocaleString()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Avg: KES {data.average_booking_value.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Metrics */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Conversion Rate</CardTitle>
                <CardDescription>
                  Percentage of bookings that are confirmed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {performanceMetrics.conversion_rate.toFixed(1)}%
                </div>
                <div className="mt-4">
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(performanceMetrics.conversion_rate, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Cancellation Rate</CardTitle>
                <CardDescription>
                  Percentage of bookings that are cancelled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {performanceMetrics.cancellation_rate.toFixed(1)}%
                </div>
                <div className="mt-4">
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive"
                      style={{ width: `${Math.min(performanceMetrics.cancellation_rate, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Average Booking Duration</CardTitle>
                <CardDescription>
                  Average number of nights per booking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {performanceMetrics.average_booking_duration.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  nights
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Repeat Guest Rate</CardTitle>
                <CardDescription>
                  Percentage of guests who book multiple times
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">
                  {performanceMetrics.repeat_guest_rate.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  guest loyalty
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

