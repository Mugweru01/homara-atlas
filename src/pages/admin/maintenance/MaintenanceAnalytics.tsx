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
  Wrench,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
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

interface MaintenanceStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  cancelled: number;
  averageCompletionTime: number;
  totalCost: number;
  averageCost: number;
  statusDistribution: { status: string; count: number; percentage: number }[];
  priorityDistribution: { priority: string; count: number; percentage: number }[];
  categoryDistribution: { category: string; count: number }[];
  completionTrend: { date: string; completed: number; created: number }[];
  costTrend: { date: string; total: number; average: number }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function MaintenanceAnalytics() {
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
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

      // Fetch work orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('work_orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (ordersError) {
        if (ordersError.code === '42P01' || ordersError.code === 'PGRST116' || ordersError.code === 'PGRST301' || 
            ordersError.message?.includes('does not exist') || ordersError.message?.includes('schema cache')) {
          setStats({
            total: 0,
            completed: 0,
            inProgress: 0,
            pending: 0,
            cancelled: 0,
            avgCompletionTime: 0,
            totalCost: 0,
            averageCost: 0,
          });
          setStatusDistribution({});
          setPriorityDistribution({});
          setCompletionTrend([]);
          setCostTrend([]);
          setTopCategories([]);
          return;
        }
        throw ordersError;
      }

      const orders = ordersData || [];

      // Calculate stats
      const total = orders.length;
      const completed = orders.filter((o: any) => o.status === 'completed').length;
      const inProgress = orders.filter((o: any) => o.status === 'in_progress').length;
      const pending = orders.filter((o: any) => o.status === 'pending').length;
      const cancelled = orders.filter((o: any) => o.status === 'cancelled').length;

      // Average completion time (in days)
      const completedOrders = orders.filter((o: any) => 
        o.status === 'completed' && o.completed_at && o.created_at
      );
      const avgCompletionTime = completedOrders.length > 0
        ? completedOrders.reduce((sum: number, o: any) => {
            const days = (new Date(o.completed_at).getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / completedOrders.length
        : 0;

      // Cost stats
      const ordersWithCost = orders.filter((o: any) => o.actual_cost);
      const totalCost = ordersWithCost.reduce((sum: number, o: any) => sum + (o.actual_cost || 0), 0);
      const averageCost = ordersWithCost.length > 0 ? totalCost / ordersWithCost.length : 0;

      // Status distribution
      const statusCounts: Record<string, number> = {};
      orders.forEach((o: any) => {
        statusCounts[o.status || 'pending'] = (statusCounts[o.status || 'pending'] || 0) + 1;
      });

      const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
        status: status.replace('_', ' '),
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));

      // Priority distribution
      const priorityCounts: Record<string, number> = {};
      orders.forEach((o: any) => {
        priorityCounts[o.priority || 'normal'] = (priorityCounts[o.priority || 'normal'] || 0) + 1;
      });

      const priorityDistribution = Object.entries(priorityCounts).map(([priority, count]) => ({
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));

      // Category distribution
      const categoryCounts: Record<string, number> = {};
      orders.forEach((o: any) => {
        const category = o.category || 'general';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });

      const categoryDistribution = Object.entries(categoryCounts)
        .map(([category, count]) => ({
          category: category.charAt(0).toUpperCase() + category.slice(1),
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Completion trend (daily)
      const trendMap = new Map<string, { completed: number; created: number }>();
      orders.forEach((order: any) => {
        const date = format(new Date(order.created_at), 'yyyy-MM-dd');
        if (!trendMap.has(date)) {
          trendMap.set(date, { completed: 0, created: 0 });
        }
        const entry = trendMap.get(date)!;
        entry.created++;
        if (order.status === 'completed' && order.completed_at) {
          const completedDate = format(new Date(order.completed_at), 'yyyy-MM-dd');
          if (!trendMap.has(completedDate)) {
            trendMap.set(completedDate, { completed: 0, created: 0 });
          }
          trendMap.get(completedDate)!.completed++;
        }
      });

      const completionTrend = Array.from(trendMap.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM d'),
          completed: data.completed,
          created: data.created,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Cost trend
      const costTrendMap = new Map<string, { total: number; count: number }>();
      ordersWithCost.forEach((order: any) => {
        const date = format(new Date(order.completed_at || order.created_at), 'yyyy-MM-dd');
        if (!costTrendMap.has(date)) {
          costTrendMap.set(date, { total: 0, count: 0 });
        }
        const entry = costTrendMap.get(date)!;
        entry.total += order.actual_cost || 0;
        entry.count++;
      });

      const costTrend = Array.from(costTrendMap.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM d'),
          total: data.total,
          average: data.count > 0 ? data.total / data.count : 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setStats({
        total,
        completed,
        inProgress,
        pending,
        cancelled,
        averageCompletionTime: avgCompletionTime,
        totalCost,
        averageCost,
        statusDistribution,
        priorityDistribution,
        categoryDistribution,
        completionTrend,
        costTrend,
      });
    } catch (error: any) {
      logger.error('Error fetching maintenance analytics:', error);
      console.error('Analytics fetch error:', error);
      setStats({
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        cancelled: 0,
        averageCompletionTime: 0,
        totalCost: 0,
        averageCost: 0,
      });
      setStatusDistribution({});
      setPriorityDistribution({});
      setCompletionTrend([]);
      setCostTrend([]);
      setTopCategories([]);
      // Don't show error if table doesn't exist
      if (error?.code !== '42P01' && error?.code !== 'PGRST116' && 
          !error?.message?.includes('does not exist') && !error?.message?.includes('schema cache')) {
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
        <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No analytics data available</p>
        <p className="text-sm mt-2">
          Analytics will appear here once work orders are created
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maintenance Analytics</h1>
          <p className="text-muted-foreground">
            Performance metrics and trends for work orders
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
            <CardTitle className="text-sm font-medium">Total Work Orders</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.completed} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageCompletionTime.toFixed(1)} days
            </div>
            <p className="text-xs text-muted-foreground">
              Average time to complete
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {stats.totalCost.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: KES {stats.averageCost.toLocaleString()}
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
              Distribution of work orders by status
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

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
            <CardDescription>
              Distribution of work orders by priority
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.priorityDistribution}
                    dataKey="count"
                    nameKey="priority"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ priority, percentage }) => `${priority} (${percentage.toFixed(1)}%)`}
                  >
                    {stats.priorityDistribution.map((entry, index) => (
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

        {/* Completion Trend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Completion Trend</CardTitle>
            <CardDescription>
              Daily work order creation and completion over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.completionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="#3b82f6"
                    name="Created"
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#10b981"
                    name="Completed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Cost Trend */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Cost Trend</CardTitle>
            <CardDescription>
              Daily total and average maintenance costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.costTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    name="Total Cost (KES)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="average"
                    stroke="#10b981"
                    name="Average Cost (KES)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Top Categories</CardTitle>
          <CardDescription>
            Most common work order categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.categoryDistribution.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No category data available
              </div>
            ) : (
              stats.categoryDistribution.map((category, index) => (
                <div
                  key={category.category}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{category.category}</div>
                    </div>
                  </div>
                  <div className="text-lg font-semibold">{category.count}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

