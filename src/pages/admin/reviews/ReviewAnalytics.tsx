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
  Star,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Calendar,
  Download,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';

interface ReviewStats {
  total: number;
  averageRating: number;
  ratingDistribution: { rating: number; count: number; percentage: number }[];
  verifiedCount: number;
  withResponseCount: number;
  recentTrend: { date: string; count: number; avgRating: number }[];
  topProperties: { property_id: string; property_title: string; review_count: number; avg_rating: number }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ReviewAnalytics() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>('30');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const days = parseInt(dateRange);
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      // Fetch reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          property:properties!reviews_property_id_fkey(id, title)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (reviewsError) throw reviewsError;

      const reviews = reviewsData || [];

      // Calculate stats
      const total = reviews.length;
      const averageRating = total > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / total
        : 0;

      // Rating distribution
      const ratingCounts = [0, 0, 0, 0, 0];
      reviews.forEach(r => {
        if (r.rating >= 1 && r.rating <= 5) {
          ratingCounts[r.rating - 1]++;
        }
      });

      const ratingDistribution = ratingCounts.map((count, index) => ({
        rating: index + 1,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));

      // Verified and response counts
      const verifiedCount = reviews.filter(r => r.verified).length;
      const withResponseCount = reviews.filter(r => r.landlord_response).length;

      // Recent trend (daily)
      const trendMap = new Map<string, { count: number; totalRating: number }>();
      reviews.forEach(review => {
        const date = format(new Date(review.created_at), 'yyyy-MM-dd');
        if (!trendMap.has(date)) {
          trendMap.set(date, { count: 0, totalRating: 0 });
        }
        const entry = trendMap.get(date)!;
        entry.count++;
        entry.totalRating += review.rating;
      });

      const recentTrend = Array.from(trendMap.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM d'),
          count: data.count,
          avgRating: data.totalRating / data.count,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Top properties by review count
      const propertyMap = new Map<string, { title: string; reviews: any[] }>();
      reviews.forEach(review => {
        const propId = review.property_id;
        if (!propertyMap.has(propId)) {
          propertyMap.set(propId, {
            title: (review.property as any)?.title || 'Unknown Property',
            reviews: [],
          });
        }
        propertyMap.get(propId)!.reviews.push(review);
      });

      const topProperties = Array.from(propertyMap.entries())
        .map(([property_id, data]) => ({
          property_id,
          property_title: data.title,
          review_count: data.reviews.length,
          avg_rating: data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length,
        }))
        .sort((a, b) => b.review_count - a.review_count)
        .slice(0, 10);

      setStats({
        total,
        averageRating,
        ratingDistribution,
        verifiedCount,
        withResponseCount,
        recentTrend,
        topProperties,
      });
    } catch (error: any) {
      logger.error('Error fetching review analytics:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    if (!stats) return;
    toast({
      title: 'Export',
      description: 'Analytics data export functionality coming soon',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No analytics data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Analytics</h1>
          <p className="text-muted-foreground">
            Rating distribution, trends, and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 180 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Last {dateRange} days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Out of 5.0
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <Star className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verifiedCount}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? ((stats.verifiedCount / stats.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Response</CardTitle>
            <Star className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withResponseCount}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? ((stats.withResponseCount / stats.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Rating Distribution - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>
              Distribution of review ratings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={stats.ratingDistribution}
                    dataKey="count"
                    nameKey="rating"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ rating, percentage }) => `${rating}★ (${percentage.toFixed(1)}%)`}
                  >
                    {stats.ratingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Rating Distribution - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Rating Counts</CardTitle>
            <CardDescription>
              Number of reviews per rating
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.ratingDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rating" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Recent Trend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Review Trends</CardTitle>
            <CardDescription>
              Daily review count and average rating over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.recentTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 5]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    name="Review Count"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgRating"
                    stroke="#10b981"
                    name="Avg Rating"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Properties */}
      <Card>
        <CardHeader>
          <CardTitle>Top Properties by Reviews</CardTitle>
          <CardDescription>
            Properties with the most reviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.topProperties.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No property reviews found
              </div>
            ) : (
              stats.topProperties.map((property, index) => (
                <div
                  key={property.property_id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{property.property_title}</div>
                      <div className="text-sm text-muted-foreground">
                        {property.review_count} reviews
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">{property.avg_rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

