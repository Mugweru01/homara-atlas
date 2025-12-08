import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdmin } from '@/hooks/useAdmin';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  avgResolutionTime: number;
  byPriority: { priority: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byCategory: { category: string; count: number }[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F'];

export default function TicketAnalytics() {
  const { isSeniorAdmin, isSuperAdmin, loading: adminLoading } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    avgResolutionTime: 0,
    byPriority: [],
    byStatus: [],
    byCategory: [],
  });

  useEffect(() => {
    // Only fetch if authorized
    if (!adminLoading && (isSeniorAdmin || isSuperAdmin)) {
      fetchAnalytics();
    }
  }, [isSeniorAdmin, isSuperAdmin, period, adminLoading]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      if (period === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      }

      // Get all tickets in period
      const { data: tickets, error } = await supabase
        .from('homaradesk_tickets')
        .select('id, status, priority, category, created_at, resolved_at')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const ticketsList = tickets || [];

      // Calculate stats
      const total = ticketsList.length;
      const open = ticketsList.filter(t => t.status === 'open').length;
      const inProgress = ticketsList.filter(t => t.status === 'in_progress').length;
      const resolved = ticketsList.filter(t => t.status === 'resolved').length;
      const closed = ticketsList.filter(t => t.status === 'closed').length;

      // Calculate average resolution time
      const resolvedTickets = ticketsList.filter(t =>
        (t.status === 'resolved' || t.status === 'closed') && t.resolved_at
      );
      let avgResolutionTime = 0;
      if (resolvedTickets.length > 0) {
        const resolutionTimes = resolvedTickets.map(t => {
          const created = new Date(t.created_at);
          const resolved = new Date(t.resolved_at!);
          return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
        });
        avgResolutionTime = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
      }

      // Group by priority
      const priorityCounts: Record<string, number> = {};
      ticketsList.forEach(t => {
        const priority = t.priority || 'normal';
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      });
      const byPriority = Object.entries(priorityCounts).map(([priority, count]) => ({
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        count,
      }));

      // Group by status
      const statusCounts: Record<string, number> = {};
      ticketsList.forEach(t => {
        const status = t.status || 'open';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      const byStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
        count,
      }));

      // Group by category (if available)
      const categoryCounts: Record<string, number> = {};
      ticketsList.forEach(t => {
        const category = t.category || 'uncategorized';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
      const byCategory = Object.entries(categoryCounts).map(([category, count]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        count,
      }));

      setStats({
        total,
        open,
        inProgress,
        resolved,
        closed,
        avgResolutionTime,
        byPriority,
        byStatus,
        byCategory,
      });

    } catch (error) {
      console.error('Error fetching ticket analytics:', error);
      toast.error('Failed to load ticket analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    try {
      const csv = [
        ['Metric', 'Value'].join(','),
        ['Total Tickets', stats.total].join(','),
        ['Open', stats.open].join(','),
        ['In Progress', stats.inProgress].join(','),
        ['Resolved', stats.resolved].join(','),
        ['Closed', stats.closed].join(','),
        ['Avg Resolution Time (hours)', stats.avgResolutionTime.toFixed(2)].join(','),
        ['', ''].join(','),
        ['Priority', 'Count'].join(','),
        ...stats.byPriority.map(p => [p.priority, p.count].join(',')),
        ['', ''].join(','),
        ['Status', 'Count'].join(','),
        ...stats.byStatus.map(s => [s.status, s.count].join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  // Redirect if not authorized (handled by ProtectedRoute, but double-check)
  if (!adminLoading && !isSeniorAdmin && !isSuperAdmin) {
    return null; // Will redirect via ProtectedRoute
  }

  if (adminLoading || loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-10 w-48 bg-muted/50 rounded-lg animate-shimmer"></div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted/20 rounded-xl animate-shimmer"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            Ticket Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive ticket metrics and insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(value: 'week' | 'month' | 'quarter') => setPeriod(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportReport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Tickets in period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? ((stats.open / stats.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved + stats.closed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? (((stats.resolved + stats.closed) / stats.total) * 100).toFixed(1) : 0}% resolution rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResolutionTime.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              Average time to resolve
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By Priority</CardTitle>
            <CardDescription>Ticket distribution by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.byPriority}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {stats.byPriority.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Status</CardTitle>
            <CardDescription>Ticket distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byStatus}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="status"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Bar dataKey="count" fill="#8884d8" name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


