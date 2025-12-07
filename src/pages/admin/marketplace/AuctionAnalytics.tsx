import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  TrendingUp,
  RefreshCw,
  Download,
  DollarSign,
  Users,
  Gavel,
  Clock,
  BarChart3,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

interface AuctionStats {
  totalAuctions: number;
  activeAuctions: number;
  completedAuctions: number;
  totalBids: number;
  totalRevenue: number;
  averageBidAmount: number;
  averageBidsPerAuction: number;
  uniqueBidders: number;
  completionRate: number;
  revenueTrend: { date: string; revenue: number; auctions: number }[];
  bidDistribution: { range: string; count: number }[];
  topProperties: { property_id: string; property_title: string; total_bids: number; final_price: number }[];
  sessionPerformance: { session_id: string; session_date: string; auctions: number; bids: number; revenue: number }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AuctionAnalytics() {
  const [stats, setStats] = useState<AuctionStats | null>(null);
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

      // Fetch auctions
      const { data: auctionsData, error: auctionsError } = await supabase
        .from('marketplace_listings')
        .select(`
          *,
          bids:marketplace_bids(count, max_bid_amount)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .catch(() => ({ data: [], error: null }));

      if (auctionsError && auctionsError.code !== '42P01') {
        throw auctionsError;
      }

      const auctions = auctionsData || [];

      // Fetch bids
      const { data: bidsData, error: bidsError } = await supabase
        .from('marketplace_bids')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .catch(() => ({ data: [], error: null }));

      if (bidsError && bidsError.code !== '42P01') {
        throw bidsError;
      }

      const bids = bidsData || [];

      // Fetch sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('auction_sessions')
        .select('*')
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .catch(() => ({ data: [], error: null }));

      if (sessionsError && sessionsError.code !== '42P01') {
        throw sessionsError;
      }

      const sessions = sessionsData || [];

      // Calculate stats
      const totalAuctions = auctions.length;
      const activeAuctions = auctions.filter((a: any) => a.status === 'active' || a.status === 'ongoing').length;
      const completedAuctions = auctions.filter((a: any) => a.status === 'completed' || a.status === 'sold').length;
      const totalBids = bids.length;
      const totalRevenue = auctions
        .filter((a: any) => a.final_price || a.sold_price)
        .reduce((sum: number, a: any) => sum + (a.final_price || a.sold_price || 0), 0);
      const averageBidAmount = bids.length > 0
        ? bids.reduce((sum: number, b: any) => sum + (b.bid_amount || 0), 0) / bids.length
        : 0;
      const averageBidsPerAuction = totalAuctions > 0 ? totalBids / totalAuctions : 0;
      const uniqueBidders = new Set(bids.map((b: any) => b.bidder_id)).size;
      const completionRate = totalAuctions > 0 ? (completedAuctions / totalAuctions) * 100 : 0;

      // Revenue trend (daily)
      const revenueMap = new Map<string, { revenue: number; auctions: number }>();
      auctions.forEach((auction: any) => {
        const date = format(new Date(auction.created_at), 'yyyy-MM-dd');
        if (!revenueMap.has(date)) {
          revenueMap.set(date, { revenue: 0, auctions: 0 });
        }
        const dayData = revenueMap.get(date)!;
        dayData.auctions++;
        if (auction.final_price || auction.sold_price) {
          dayData.revenue += (auction.final_price || auction.sold_price || 0);
        }
      });

      const revenueTrend = Array.from(revenueMap.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM d'),
          revenue: data.revenue,
          auctions: data.auctions,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Bid distribution
      const bidRanges = [
        { min: 0, max: 10000, label: '0-10K' },
        { min: 10000, max: 50000, label: '10K-50K' },
        { min: 50000, max: 100000, label: '50K-100K' },
        { min: 100000, max: 500000, label: '100K-500K' },
        { min: 500000, max: Infinity, label: '500K+' },
      ];

      const bidDistribution = bidRanges.map(range => ({
        range: range.label,
        count: bids.filter((b: any) => {
          const amount = b.bid_amount || 0;
          return amount >= range.min && amount < range.max;
        }).length,
      }));

      // Top properties
      const propertyBidMap = new Map<string, { title: string; bids: any[] }>();
      bids.forEach((bid: any) => {
        const listingId = bid.listing_id;
        if (!propertyBidMap.has(listingId)) {
          propertyBidMap.set(listingId, {
            title: `Property ${listingId.substring(0, 8)}`,
            bids: [],
          });
        }
        propertyBidMap.get(listingId)!.bids.push(bid);
      });

      const topProperties = Array.from(propertyBidMap.entries())
        .map(([property_id, data]) => {
          const auction = auctions.find((a: any) => a.id === property_id);
          return {
            property_id,
            property_title: auction?.title || data.title,
            total_bids: data.bids.length,
            final_price: auction?.final_price || auction?.sold_price || 0,
          };
        })
        .sort((a, b) => b.total_bids - a.total_bids)
        .slice(0, 10);

      // Session performance
      const sessionPerformance = sessions.map((session: any) => {
        const sessionAuctions = auctions.filter((a: any) => 
          a.created_at >= session.start_time && 
          (!session.end_time || a.created_at <= session.end_time)
        );
        const sessionBids = bids.filter((b: any) =>
          b.created_at >= session.start_time &&
          (!session.end_time || b.created_at <= session.end_time)
        );
        const sessionRevenue = sessionAuctions
          .filter((a: any) => a.final_price || a.sold_price)
          .reduce((sum: number, a: any) => sum + (a.final_price || a.sold_price || 0), 0);

        return {
          session_id: session.id,
          session_date: format(new Date(session.start_time), 'MMM d, yyyy'),
          auctions: sessionAuctions.length,
          bids: sessionBids.length,
          revenue: sessionRevenue,
        };
      })
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
      .slice(0, 10);

      setStats({
        totalAuctions,
        activeAuctions,
        completedAuctions,
        totalBids,
        totalRevenue,
        averageBidAmount,
        averageBidsPerAuction,
        uniqueBidders,
        completionRate,
        revenueTrend,
        bidDistribution,
        topProperties,
        sessionPerformance,
      });
    } catch (error: any) {
      logger.error('Error fetching auction analytics:', error);
      if (error.code !== '42P01') {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch analytics',
          variant: 'destructive',
        });
      }
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
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No analytics data available</p>
        <p className="text-sm mt-2">
          Analytics will appear here once auction data is available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auction Analytics</h1>
          <p className="text-muted-foreground">
            Insights and performance metrics for marketplace auctions
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
            <CardTitle className="text-sm font-medium">Total Auctions</CardTitle>
            <Gavel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAuctions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeAuctions} active, {stats.completedAuctions} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {stats.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.completionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bids</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBids}</div>
            <p className="text-xs text-muted-foreground">
              Avg {stats.averageBidsPerAuction.toFixed(1)} per auction
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Bidders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueBidders}</div>
            <p className="text-xs text-muted-foreground">
              Avg bid: KES {stats.averageBidAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>
              Daily revenue and auction count over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    name="Revenue (KES)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="auctions"
                    stroke="#3b82f6"
                    name="Auctions"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bid Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Bid Distribution</CardTitle>
            <CardDescription>
              Distribution of bids by amount range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.bidDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Properties */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Properties</CardTitle>
          <CardDescription>
            Properties with the most bids
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.topProperties.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No property data available
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
                        {property.total_bids} bids
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Final Price</div>
                    <div className="font-semibold">
                      KES {property.final_price.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Session Performance</CardTitle>
          <CardDescription>
            Performance metrics by auction session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Session Date</th>
                  <th className="text-right p-4 font-medium">Auctions</th>
                  <th className="text-right p-4 font-medium">Bids</th>
                  <th className="text-right p-4 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.sessionPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      No session data available
                    </td>
                  </tr>
                ) : (
                  stats.sessionPerformance.map((session) => (
                    <tr key={session.session_id} className="border-b">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{session.session_date}</span>
                        </div>
                      </td>
                      <td className="text-right p-4">{session.auctions}</td>
                      <td className="text-right p-4">{session.bids}</td>
                      <td className="text-right p-4 font-medium">
                        KES {session.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

