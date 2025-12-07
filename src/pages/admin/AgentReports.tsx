import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileBarChart, 
  Download,
  Calendar,
  TrendingUp,
  Users
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
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ReportData {
  date: string;
  tickets: number;
  resolved: number;
  avgResolutionTime: number;
}

export default function AgentReports() {
  const { isSeniorAdmin, isSuperAdmin, loading: adminLoading } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [summary, setSummary] = useState({
    totalTickets: 0,
    totalResolved: 0,
    resolutionRate: 0,
    avgResolutionTime: 0,
  });

  useEffect(() => {
    // Only fetch if authorized
    if (!adminLoading && (isSeniorAdmin || isSuperAdmin)) {
      fetchReportData();
    }
  }, [isSeniorAdmin, isSuperAdmin, period, adminLoading]);

  const fetchReportData = async () => {
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

      // Get tickets grouped by date
      const { data: tickets, error } = await supabase
        .from('homaradesk_tickets')
        .select('id, status, created_at, resolved_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by date
      const grouped: Record<string, { tickets: number; resolved: number; resolutionTimes: number[] }> = {};
      
      (tickets || []).forEach(ticket => {
        const date = new Date(ticket.created_at).toISOString().split('T')[0];
        if (!grouped[date]) {
          grouped[date] = { tickets: 0, resolved: 0, resolutionTimes: [] };
        }
        grouped[date].tickets++;
        
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          grouped[date].resolved++;
          if (ticket.resolved_at) {
            const created = new Date(ticket.created_at);
            const resolved = new Date(ticket.resolved_at);
            const hours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
            grouped[date].resolutionTimes.push(hours);
          }
        }
      });

      const data: ReportData[] = Object.entries(grouped).map(([date, stats]) => ({
        date,
        tickets: stats.tickets,
        resolved: stats.resolved,
        avgResolutionTime: stats.resolutionTimes.length > 0
          ? stats.resolutionTimes.reduce((a, b) => a + b, 0) / stats.resolutionTimes.length
          : 0,
      })).sort((a, b) => a.date.localeCompare(b.date));

      setReportData(data);

      // Calculate summary
      const totalTickets = data.reduce((sum, d) => sum + d.tickets, 0);
      const totalResolved = data.reduce((sum, d) => sum + d.resolved, 0);
      const allResolutionTimes = data.flatMap(d => 
        d.avgResolutionTime > 0 ? [d.avgResolutionTime] : []
      );
      const avgResolution = allResolutionTimes.length > 0
        ? allResolutionTimes.reduce((a, b) => a + b, 0) / allResolutionTimes.length
        : 0;

      setSummary({
        totalTickets,
        totalResolved,
        resolutionRate: totalTickets > 0 ? (totalResolved / totalTickets) * 100 : 0,
        avgResolutionTime: avgResolution,
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    try {
      const csv = [
        ['Date', 'Tickets', 'Resolved', 'Avg Resolution Time (hours)'].join(','),
        ...reportData.map(d => [
          d.date,
          d.tickets,
          d.resolved,
          d.avgResolutionTime.toFixed(2)
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agent-reports-${period}-${new Date().toISOString().split('T')[0]}.csv`;
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
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-muted/20 rounded-xl animate-shimmer"></div>
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
              <FileBarChart className="h-6 w-6 text-primary" />
            </div>
            Agent Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Detailed analytics and performance reports for support agents
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
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTickets}</div>
            <p className="text-xs text-muted-foreground">
              Tickets in period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalResolved}</div>
            <p className="text-xs text-muted-foreground">
              {summary.resolutionRate.toFixed(1)}% resolution rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgResolutionTime.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              Average time to resolve
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              See Team Performance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ticket Volume</CardTitle>
            <CardDescription>Tickets created and resolved over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
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
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="tickets" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="Tickets Created"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="resolved" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    name="Tickets Resolved"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolution Time</CardTitle>
            <CardDescription>Average resolution time by date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
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
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}h`, 'Avg Resolution']}
                  />
                  <Bar dataKey="avgResolutionTime" fill="#8884d8" name="Avg Resolution (hours)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


