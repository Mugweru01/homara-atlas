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
  Scale,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Download,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
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

interface DisputeStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  averageResolutionTime: number;
  resolutionRate: number;
  totalAmountDisputed: number;
  averageAmount: number;
  statusDistribution: { status: string; count: number; percentage: number }[];
  typeDistribution: { type: string; count: number; percentage: number }[];
  resolutionTrend: { date: string; opened: number; resolved: number }[];
  mediatorPerformance: { mediator_id: string; mediator_name: string; total: number; resolved: number; avgTime: number }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DisputeAnalytics() {
  const [stats, setStats] = useState<DisputeStats | null>(null);
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

      // Fetch disputes
      let disputesData = null;
      let disputesError = null;
      
      try {
        const result = await supabase
          .from('disputes')
          .select(`
            *,
            mediator:admins!disputes_mediator_id_fkey(id, full_name)
          `)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
        
        disputesData = result.data;
        disputesError = result.error;
      } catch (queryError: any) {
        if (queryError?.code === '42P01' || queryError?.code === 'PGRST116' || queryError?.code === 'PGRST301') {
          disputesData = [];
          disputesError = null;
        } else {
          throw queryError;
        }
      }

      if (disputesError && disputesError.code !== '42P01' && disputesError.code !== 'PGRST116' && disputesError.code !== 'PGRST301') {
        throw disputesError;
      }

      const disputes = disputesData || [];

      // Calculate stats
      const total = disputes.length;
      const open = disputes.filter((d: any) => d.status === 'open').length;
      const inProgress = disputes.filter((d: any) => d.status === 'in_progress').length;
      const resolved = disputes.filter((d: any) => d.status === 'resolved').length;
      const closed = disputes.filter((d: any) => d.status === 'closed').length;

      // Average resolution time (in days)
      const resolvedDisputes = disputes.filter((d: any) => 
        d.status === 'resolved' && d.resolved_at && d.created_at
      );
      const avgResolutionTime = resolvedDisputes.length > 0
        ? resolvedDisputes.reduce((sum: number, d: any) => {
            const days = (new Date(d.resolved_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / resolvedDisputes.length
        : 0;

      // Resolution rate
      const resolutionRate = total > 0
        ? ((resolved + closed) / total) * 100
        : 0;

      // Amount stats
      const disputesWithAmount = disputes.filter((d: any) => d.amount_disputed);
      const totalAmountDisputed = disputesWithAmount.reduce((sum: number, d: any) => sum + (d.amount_disputed || 0), 0);
      const averageAmount = disputesWithAmount.length > 0 ? totalAmountDisputed / disputesWithAmount.length : 0;

      // Status distribution
      const statusCounts: Record<string, number> = {};
      disputes.forEach((d: any) => {
        statusCounts[d.status || 'open'] = (statusCounts[d.status || 'open'] || 0) + 1;
      });

      const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
        status: status.replace('_', ' '),
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));

      // Type distribution
      const typeCounts: Record<string, number> = {};
      disputes.forEach((d: any) => {
        typeCounts[d.dispute_type || 'other'] = (typeCounts[d.dispute_type || 'other'] || 0) + 1;
      });

      const typeDistribution = Object.entries(typeCounts).map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));

      // Resolution trend (daily)
      const trendMap = new Map<string, { opened: number; resolved: number }>();
      disputes.forEach((dispute: any) => {
        const date = format(new Date(dispute.created_at), 'yyyy-MM-dd');
        if (!trendMap.has(date)) {
          trendMap.set(date, { opened: 0, resolved: 0 });
        }
        trendMap.get(date)!.opened++;
        if (dispute.status === 'resolved' && dispute.resolved_at) {
          const resolvedDate = format(new Date(dispute.resolved_at), 'yyyy-MM-dd');
          if (!trendMap.has(resolvedDate)) {
            trendMap.set(resolvedDate, { opened: 0, resolved: 0 });
          }
          trendMap.get(resolvedDate)!.resolved++;
        }
      });

      const resolutionTrend = Array.from(trendMap.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM d'),
          opened: data.opened,
          resolved: data.resolved,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Mediator performance
      const mediatorMap = new Map<string, { name: string; disputes: any[] }>();
      disputes.forEach((dispute: any) => {
        if (dispute.mediator_id) {
          const mediatorId = dispute.mediator_id;
          if (!mediatorMap.has(mediatorId)) {
            mediatorMap.set(mediatorId, {
              name: (dispute.mediator as any)?.full_name || 'Unknown',
              disputes: [],
            });
          }
          mediatorMap.get(mediatorId)!.disputes.push(dispute);
        }
      });

      const mediatorPerformance = Array.from(mediatorMap.entries())
        .map(([mediator_id, data]) => {
          const resolved = data.disputes.filter((d: any) => d.status === 'resolved');
          const avgTime = resolved.length > 0
            ? resolved.reduce((sum: number, d: any) => {
                if (d.resolved_at && d.created_at) {
                  const days = (new Date(d.resolved_at).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24);
                  return sum + days;
                }
                return sum;
              }, 0) / resolved.length
            : 0;

          return {
            mediator_id,
            mediator_name: data.name,
            total: data.disputes.length,
            resolved: resolved.length,
            avgTime,
          };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      setStats({
        total,
        open,
        inProgress,
        resolved,
        closed,
        averageResolutionTime: avgResolutionTime,
        resolutionRate,
        totalAmountDisputed,
        averageAmount,
        statusDistribution,
        typeDistribution,
        resolutionTrend,
        mediatorPerformance,
      });
    } catch (error: any) {
      logger.error('Error fetching dispute analytics:', error);
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
        <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No analytics data available</p>
        <p className="text-sm mt-2">
          Analytics will appear here once disputes are created
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dispute Analytics</h1>
          <p className="text-muted-foreground">
            Resolution metrics and performance insights
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
            <CardTitle className="text-sm font-medium">Total Disputes</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolutionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.resolved + stats.closed} resolved
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageResolutionTime.toFixed(1)} days
            </div>
            <p className="text-xs text-muted-foreground">
              Average time to resolve
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount Disputed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {stats.totalAmountDisputed.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: KES {stats.averageAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>
              Distribution of disputes by status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.statusDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Type Distribution</CardTitle>
            <CardDescription>
              Distribution of disputes by type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.typeDistribution}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ type, percentage }) => `${type} (${percentage.toFixed(1)}%)`}
                  >
                    {stats.typeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Resolution Trend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Resolution Trend</CardTitle>
            <CardDescription>
              Daily dispute opening and resolution over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.resolutionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="opened"
                    stroke="#ef4444"
                    name="Opened"
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved"
                    stroke="#10b981"
                    name="Resolved"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Mediator Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Mediator Performance</CardTitle>
          <CardDescription>
            Top mediators by dispute handling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.mediatorPerformance.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No mediator data available
              </div>
            ) : (
              stats.mediatorPerformance.map((mediator, index) => (
                <div
                  key={mediator.mediator_id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{mediator.mediator_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {mediator.resolved} of {mediator.total} resolved
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Resolution Rate</div>
                      <div className="font-semibold">
                        {mediator.total > 0 ? ((mediator.resolved / mediator.total) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Avg Time</div>
                      <div className="font-semibold">
                        {mediator.avgTime.toFixed(1)} days
                      </div>
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

