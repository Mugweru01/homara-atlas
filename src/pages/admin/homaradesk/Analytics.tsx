import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  BarChart3,
  RefreshCw,
  Download,
  Calendar,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { format, subDays, subMonths, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExportButton } from '@/components/admin/ExportButton';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function HomaraDeskAnalytics() {
  const permissions = usePermissions();
  
  if (!permissions.canViewAnalytics) {
    return null; // ProtectedRoute will handle redirect
  }
  
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [ticketVolumeData, setTicketVolumeData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [priorityDistribution, setPriorityDistribution] = useState<any[]>([]);
  const [responseTimeData, setResponseTimeData] = useState<any[]>([]);
  const [resolutionTimeData, setResolutionTimeData] = useState<any[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<any[]>([]);
  const [slaCompliance, setSlaCompliance] = useState<any[]>([]);
  const [satisfactionTrend, setSatisfactionTrend] = useState<any[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalTickets: 0,
    avgResponseTime: 0,
    avgResolutionTime: 0,
    slaComplianceRate: 0,
    satisfactionScore: 0,
    firstContactResolution: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        return { start: subDays(now, 7), end: now };
      case '30d':
        return { start: subDays(now, 30), end: now };
      case '90d':
        return { start: subDays(now, 90), end: now };
      default:
        return { start: subDays(now, 30), end: now };
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      // Fetch tickets in date range
      const { data: tickets, error: ticketsError } = await supabase
        .from('homaradesk_tickets')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (ticketsError) {
        if (ticketsError.code === '42P01' || ticketsError.code === 'PGRST116' ||
            ticketsError.message?.includes('does not exist') || ticketsError.message?.includes('schema cache')) {
          setTicketVolumeData([]);
          setStatusDistribution([]);
          setPriorityDistribution([]);
          setResponseTimeData([]);
          setResolutionTimeData([]);
          setAgentPerformance([]);
          setSlaCompliance([]);
          setSatisfactionTrend([]);
          return;
        }
        throw ticketsError;
      }

      const ticketsList = tickets || [];
      const now = new Date();

      // Calculate overall stats
      const totalTickets = ticketsList.length;
      const ticketsWithResponse = ticketsList.filter((t: any) => t.first_response_time_minutes);
      const avgResponseTime = ticketsWithResponse.length > 0
        ? ticketsWithResponse.reduce((sum: number, t: any) => sum + (t.first_response_time_minutes || 0), 0) / ticketsWithResponse.length
        : 0;

      const ticketsWithResolution = ticketsList.filter((t: any) => t.resolution_time_minutes);
      const avgResolutionTime = ticketsWithResolution.length > 0
        ? ticketsWithResolution.reduce((sum: number, t: any) => sum + (t.resolution_time_minutes || 0), 0) / ticketsWithResolution.length
        : 0;

      // SLA compliance
      const ticketsWithSLA = ticketsList.filter((t: any) => t.first_response_due_at || t.resolution_due_at);
      const slaCompliant = ticketsWithSLA.filter((t: any) => {
        if (t.status === 'resolved' || t.status === 'closed') {
          if (t.first_response_due_at && new Date(t.first_response_due_at) < new Date(t.first_response_at || t.created_at)) return false;
          if (t.resolution_due_at && new Date(t.resolution_due_at) < new Date(t.resolved_at || t.updated_at)) return false;
          return true;
        }
        return true; // Open tickets are considered compliant until due date passes
      }).length;
      const slaComplianceRate = ticketsWithSLA.length > 0 ? (slaCompliant / ticketsWithSLA.length) * 100 : 0;

      // Satisfaction score
      const ticketsWithRating = ticketsList.filter((t: any) => t.customer_satisfaction_rating);
      const satisfactionScore = ticketsWithRating.length > 0
        ? ticketsWithRating.reduce((sum: number, t: any) => sum + (t.customer_satisfaction_rating || 0), 0) / ticketsWithRating.length
        : 0;

      // First contact resolution
      const firstContactResolved = ticketsList.filter((t: any) => {
        if (t.status !== 'resolved' && t.status !== 'closed') return false;
        // Check if resolved in first response
        return t.first_response_time_minutes && t.resolution_time_minutes && 
               Math.abs(t.first_response_time_minutes - t.resolution_time_minutes) < 60; // Within 1 hour
      }).length;
      const firstContactResolution = totalTickets > 0 ? (firstContactResolved / totalTickets) * 100 : 0;

      setOverallStats({
        totalTickets,
        avgResponseTime: Math.round(avgResponseTime / 60), // Convert to hours
        avgResolutionTime: Math.round(avgResolutionTime / 60), // Convert to hours
        slaComplianceRate: Math.round(slaComplianceRate),
        satisfactionScore: Math.round(satisfactionScore * 10) / 10,
        firstContactResolution: Math.round(firstContactResolution),
      });

      // Ticket volume trends
      const days = eachDayOfInterval({ start, end });
      const volumeData = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayTickets = ticketsList.filter((t: any) => {
          const ticketDate = new Date(t.created_at);
          return ticketDate >= dayStart && ticketDate < dayEnd;
        });
        return {
          date: format(day, 'MMM d'),
          tickets: dayTickets.length,
          resolved: dayTickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length,
        };
      });
      setTicketVolumeData(volumeData);

      // Status distribution
      const statusCounts: Record<string, number> = {};
      ticketsList.forEach((t: any) => {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      });
      const statusData = Object.entries(statusCounts).map(([status, count]) => ({
        name: status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        value: count,
      }));
      setStatusDistribution(statusData);

      // Priority distribution
      const priorityCounts: Record<string, number> = {};
      ticketsList.forEach((t: any) => {
        priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
      });
      const priorityData = Object.entries(priorityCounts).map(([priority, count]) => ({
        name: priority.charAt(0).toUpperCase() + priority.slice(1),
        value: count,
      }));
      setPriorityDistribution(priorityData);

      // Response time trends
      const responseData = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayTickets = ticketsList.filter((t: any) => {
          const ticketDate = new Date(t.created_at);
          return ticketDate >= dayStart && ticketDate < dayEnd && t.first_response_time_minutes;
        });
        const avgResponse = dayTickets.length > 0
          ? dayTickets.reduce((sum: number, t: any) => sum + (t.first_response_time_minutes || 0), 0) / dayTickets.length
          : 0;
        return {
          date: format(day, 'MMM d'),
          avgResponse: Math.round(avgResponse / 60), // Convert to hours
        };
      });
      setResponseTimeData(responseData);

      // Resolution time trends
      const resolutionData = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayTickets = ticketsList.filter((t: any) => {
          const ticketDate = new Date(t.created_at);
          return ticketDate >= dayStart && ticketDate < dayEnd && t.resolution_time_minutes;
        });
        const avgResolution = dayTickets.length > 0
          ? dayTickets.reduce((sum: number, t: any) => sum + (t.resolution_time_minutes || 0), 0) / dayTickets.length
          : 0;
        return {
          date: format(day, 'MMM d'),
          avgResolution: Math.round(avgResolution / 60), // Convert to hours
        };
      });
      setResolutionTimeData(resolutionData);

      // Agent performance
      const { data: admins } = await supabase
        .from('admins')
        .select('id, user_id')
        .eq('status', 'active');

      const adminsMap = new Map();
      if (admins) {
        const adminUserIds = admins.map((a: any) => a.user_id);
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', adminUserIds);

        if (adminProfiles) {
          const adminIdToUserId = new Map(admins.map((a: any) => [a.user_id, a.id]));
          adminProfiles.forEach((p: any) => {
            const adminId = adminIdToUserId.get(p.id);
            if (adminId) {
              adminsMap.set(adminId, p.full_name);
            }
          });
        }
      }

      const agentCounts: Record<string, { name: string; resolved: number; total: number; avgResponse: number; avgResolution: number }> = {};
      ticketsList.forEach((t: any) => {
        if (t.assignee_id && adminsMap.has(t.assignee_id)) {
          const agentName = adminsMap.get(t.assignee_id) || 'Unknown';
          if (!agentCounts[t.assignee_id]) {
            agentCounts[t.assignee_id] = { name: agentName, resolved: 0, total: 0, avgResponse: 0, avgResolution: 0 };
          }
          agentCounts[t.assignee_id].total++;
          if (t.status === 'resolved' || t.status === 'closed') {
            agentCounts[t.assignee_id].resolved++;
          }
          if (t.first_response_time_minutes) {
            agentCounts[t.assignee_id].avgResponse += t.first_response_time_minutes;
          }
          if (t.resolution_time_minutes) {
            agentCounts[t.assignee_id].avgResolution += t.resolution_time_minutes;
          }
        }
      });

      const agentData = Object.entries(agentCounts).map(([id, agent]) => ({
        name: agent.name,
        resolved: agent.resolved,
        total: agent.total,
        resolutionRate: agent.total > 0 ? Math.round((agent.resolved / agent.total) * 100) : 0,
        avgResponse: agent.total > 0 ? Math.round((agent.avgResponse / agent.total) / 60) : 0,
        avgResolution: agent.total > 0 ? Math.round((agent.avgResolution / agent.total) / 60) : 0,
      })).sort((a, b) => b.resolved - a.resolved);
      setAgentPerformance(agentData);

      // SLA compliance trends
      const slaData = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayTickets = ticketsList.filter((t: any) => {
          const ticketDate = new Date(t.created_at);
          return ticketDate >= dayStart && ticketDate < dayEnd && (t.first_response_due_at || t.resolution_due_at);
        });
        const compliant = dayTickets.filter((t: any) => {
          if (t.status === 'resolved' || t.status === 'closed') {
            if (t.first_response_due_at && new Date(t.first_response_due_at) < new Date(t.first_response_at || t.created_at)) return false;
            if (t.resolution_due_at && new Date(t.resolution_due_at) < new Date(t.resolved_at || t.updated_at)) return false;
            return true;
          }
          return true;
        }).length;
        return {
          date: format(day, 'MMM d'),
          compliance: dayTickets.length > 0 ? Math.round((compliant / dayTickets.length) * 100) : 0,
        };
      });
      setSlaCompliance(slaData);

      // Satisfaction trends
      const satisfactionData = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayTickets = ticketsList.filter((t: any) => {
          const ticketDate = new Date(t.created_at);
          return ticketDate >= dayStart && ticketDate < dayEnd && t.customer_satisfaction_rating;
        });
        const avgRating = dayTickets.length > 0
          ? dayTickets.reduce((sum: number, t: any) => sum + (t.customer_satisfaction_rating || 0), 0) / dayTickets.length
          : 0;
        return {
          date: format(day, 'MMM d'),
          rating: Math.round(avgRating * 10) / 10,
        };
      });
      setSatisfactionTrend(satisfactionData);
    } catch (error: any) {
      logger.error('Error fetching HomaraDesk analytics:', error);
      toast.error('Error', {
        description: error.message || 'Failed to fetch analytics',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    // Export analytics data as CSV
    const csvData = [
      ['Metric', 'Value'],
      ['Total Tickets', overallStats.totalTickets],
      ['Avg Response Time (hours)', overallStats.avgResponseTime],
      ['Avg Resolution Time (hours)', overallStats.avgResolutionTime],
      ['SLA Compliance Rate (%)', overallStats.slaComplianceRate],
      ['Satisfaction Score', overallStats.satisfactionScore],
      ['First Contact Resolution (%)', overallStats.firstContactResolution],
    ];
    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homaradesk-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Analytics exported successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into ticket performance and team metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalTickets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.avgResponseTime}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.avgResolutionTime}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.slaComplianceRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.satisfactionScore}/5</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">First Contact</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.firstContactResolution}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ticket Volume Trends</CardTitle>
            <CardDescription>New tickets and resolutions over time</CardDescription>
          </CardHeader>
          <CardContent>
            {ticketVolumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={ticketVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="tickets" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="New Tickets" />
                  <Area type="monotone" dataKey="resolved" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Resolved" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Current ticket status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Response Time Trends</CardTitle>
            <CardDescription>Average first response time (hours)</CardDescription>
          </CardHeader>
          <CardContent>
            {responseTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={responseTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="avgResponse" stroke="#3b82f6" strokeWidth={2} name="Avg Response (hours)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolution Time Trends</CardTitle>
            <CardDescription>Average resolution time (hours)</CardDescription>
          </CardHeader>
          <CardContent>
            {resolutionTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={resolutionTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="avgResolution" stroke="#10b981" strokeWidth={2} name="Avg Resolution (hours)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SLA Compliance Trends</CardTitle>
            <CardDescription>Percentage of tickets meeting SLA targets</CardDescription>
          </CardHeader>
          <CardContent>
            {slaCompliance.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={slaCompliance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="compliance" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="SLA Compliance (%)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Satisfaction Trends</CardTitle>
            <CardDescription>Average satisfaction rating over time</CardDescription>
          </CardHeader>
          <CardContent>
            {satisfactionTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={satisfactionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 5]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="rating" stroke="#FFBB28" strokeWidth={2} name="Satisfaction (1-5)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>Individual agent metrics and statistics</CardDescription>
        </CardHeader>
        <CardContent>
          {agentPerformance.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={agentPerformance.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={100} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="resolved" fill="#10b981" name="Resolved" />
                  <Bar dataKey="total" fill="#3b82f6" name="Total Assigned" />
                </BarChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Agent</th>
                      <th className="text-right p-2">Total</th>
                      <th className="text-right p-2">Resolved</th>
                      <th className="text-right p-2">Resolution Rate</th>
                      <th className="text-right p-2">Avg Response (h)</th>
                      <th className="text-right p-2">Avg Resolution (h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPerformance.map((agent, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 font-medium">{agent.name}</td>
                        <td className="p-2 text-right">{agent.total}</td>
                        <td className="p-2 text-right">{agent.resolved}</td>
                        <td className="p-2 text-right">{agent.resolutionRate}%</td>
                        <td className="p-2 text-right">{agent.avgResponse}</td>
                        <td className="p-2 text-right">{agent.avgResolution}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No agent data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

