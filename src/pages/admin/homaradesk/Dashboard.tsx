import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  MessageSquare,
  ArrowRight,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { Link } from 'react-router-dom';
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

interface TicketStats {
  total: number;
  open: number;
  assigned: number;
  in_progress: number;
  resolved: number;
  closed: number;
  overdue: number;
  assigned_to_me: number;
  avg_response_time: number;
  avg_resolution_time: number;
  satisfaction_score: number;
}

interface RecentTicket {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  requester_name?: string;
  assignee_name?: string;
  created_at: string;
  last_activity_at: string;
}

export default function HomaraDeskDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    overdue: 0,
    assigned_to_me: 0,
    avg_response_time: 0,
    avg_resolution_time: 0,
    satisfaction_score: 0,
  });
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketVolumeData, setTicketVolumeData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [responseTimeData, setResponseTimeData] = useState<any[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch tickets
      const { data: tickets, error: ticketsError } = await supabase
        .from('homaradesk_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (ticketsError) {
        if (ticketsError.code === '42P01' || ticketsError.code === 'PGRST116' || 
            ticketsError.message?.includes('does not exist') || ticketsError.message?.includes('schema cache')) {
          setStats({
            total: 0,
            open: 0,
            assigned: 0,
            in_progress: 0,
            resolved: 0,
            closed: 0,
            overdue: 0,
            assigned_to_me: 0,
            avg_response_time: 0,
            avg_resolution_time: 0,
            satisfaction_score: 0,
          });
          setRecentTickets([]);
          return;
        }
        throw ticketsError;
      }

      const ticketsList = tickets || [];
      const now = new Date();

      // Calculate stats
      const total = ticketsList.length;
      const open = ticketsList.filter((t: any) => t.status === 'open').length;
      const assigned = ticketsList.filter((t: any) => t.status === 'assigned').length;
      const in_progress = ticketsList.filter((t: any) => t.status === 'in_progress').length;
      const resolved = ticketsList.filter((t: any) => t.status === 'resolved').length;
      const closed = ticketsList.filter((t: any) => t.status === 'closed').length;
      
      // Overdue tickets (past SLA due date)
      const overdue = ticketsList.filter((t: any) => {
        if (t.status === 'resolved' || t.status === 'closed') return false;
        if (t.first_response_due_at && new Date(t.first_response_due_at) < now) return true;
        if (t.resolution_due_at && new Date(t.resolution_due_at) < now) return true;
        return false;
      }).length;

      // Get current admin ID for "assigned to me"
      const { data: { user } } = await supabase.auth.getUser();
      let assignedToMe = 0;
      if (user) {
        const { data: admin } = await supabase
          .from('admins')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        if (admin) {
          assignedToMe = ticketsList.filter((t: any) => t.assignee_id === admin.id && 
            (t.status === 'open' || t.status === 'assigned' || t.status === 'in_progress')).length;
        }
      }

      // Calculate average response time
      const ticketsWithResponse = ticketsList.filter((t: any) => t.first_response_time_minutes);
      const avgResponseTime = ticketsWithResponse.length > 0
        ? ticketsWithResponse.reduce((sum: number, t: any) => sum + (t.first_response_time_minutes || 0), 0) / ticketsWithResponse.length
        : 0;

      // Calculate average resolution time
      const ticketsWithResolution = ticketsList.filter((t: any) => t.resolution_time_minutes);
      const avgResolutionTime = ticketsWithResolution.length > 0
        ? ticketsWithResolution.reduce((sum: number, t: any) => sum + (t.resolution_time_minutes || 0), 0) / ticketsWithResolution.length
        : 0;

      // Calculate satisfaction score
      const ticketsWithRating = ticketsList.filter((t: any) => t.customer_satisfaction_rating);
      const satisfactionScore = ticketsWithRating.length > 0
        ? ticketsWithRating.reduce((sum: number, t: any) => sum + (t.customer_satisfaction_rating || 0), 0) / ticketsWithRating.length
        : 0;

      setStats({
        total,
        open,
        assigned,
        in_progress,
        resolved,
        closed,
        overdue,
        assigned_to_me: assignedToMe,
        avg_response_time: Math.round(avgResponseTime),
        avg_resolution_time: Math.round(avgResolutionTime),
        satisfaction_score: Math.round(satisfactionScore * 10) / 10,
      });

      // Fetch recent tickets with requester and assignee names
      const recentTicketsData = ticketsList.slice(0, 10);
      const requesterIds = [...new Set(recentTicketsData.map((t: any) => t.requester_id).filter(Boolean))];
      const assigneeIds = [...new Set(recentTicketsData.map((t: any) => t.assignee_id).filter(Boolean))];
      
      const profilesMap = new Map();
      if (requesterIds.length > 0 || assigneeIds.length > 0) {
        const allIds = [...new Set([...requesterIds, ...assigneeIds])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', allIds);
        
        if (profiles) {
          profiles.forEach((p: any) => {
            profilesMap.set(p.id, p.full_name);
          });
        }
      }

      // Get admin names
      const adminsMap = new Map();
      if (assigneeIds.length > 0) {
        const { data: admins } = await supabase
          .from('admins')
          .select('id, user_id')
          .in('id', assigneeIds);
        
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
      }

      const processedRecent = recentTicketsData.map((ticket: any) => ({
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        requester_name: ticket.requester_id ? profilesMap.get(ticket.requester_id) : ticket.requester_name,
        assignee_name: ticket.assignee_id ? adminsMap.get(ticket.assignee_id) : null,
        created_at: ticket.created_at,
        last_activity_at: ticket.last_activity_at,
      }));

      setRecentTickets(processedRecent);

      // Calculate ticket volume trends (last 30 days)
      const thirtyDaysAgo = subDays(now, 30);
      const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now });
      const volumeData = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
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

      // Calculate status distribution
      const statusCounts: Record<string, number> = {};
      ticketsList.forEach((t: any) => {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      });
      const statusData = Object.entries(statusCounts).map(([status, count]) => ({
        name: status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        value: count,
      }));
      setStatusDistribution(statusData);

      // Calculate response time trends (last 7 days)
      const sevenDaysAgo = subDays(now, 7);
      const weekDays = eachDayOfInterval({ start: sevenDaysAgo, end: now });
      const responseData = weekDays.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
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

      // Calculate agent performance (top 5 agents by tickets resolved)
      const agentCounts: Record<string, { name: string; resolved: number; total: number }> = {};
      ticketsList.forEach((t: any) => {
        if (t.assignee_id && adminsMap.has(t.assignee_id)) {
          const agentName = adminsMap.get(t.assignee_id) || 'Unknown';
          if (!agentCounts[t.assignee_id]) {
            agentCounts[t.assignee_id] = { name: agentName, resolved: 0, total: 0 };
          }
          agentCounts[t.assignee_id].total++;
          if (t.status === 'resolved' || t.status === 'closed') {
            agentCounts[t.assignee_id].resolved++;
          }
        }
      });
      const agentData = Object.values(agentCounts)
        .sort((a, b) => b.resolved - a.resolved)
        .slice(0, 5)
        .map(agent => ({
          name: agent.name,
          resolved: agent.resolved,
          total: agent.total,
          resolutionRate: agent.total > 0 ? Math.round((agent.resolved / agent.total) * 100) : 0,
        }));
      setAgentPerformance(agentData);
    } catch (error: any) {
      logger.error('Error fetching HomaraDesk dashboard data:', error);
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      open: 'secondary',
      assigned: 'default',
      in_progress: 'default',
      waiting_customer: 'outline',
      resolved: 'default',
      closed: 'secondary',
      cancelled: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'secondary',
      normal: 'default',
      high: 'outline',
      urgent: 'destructive',
      critical: 'destructive',
    };
    return (
      <Badge variant={variants[priority] || 'default'}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HomaraDesk</h1>
          <p className="text-muted-foreground">
            Unified ticketing and support system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Link to="/homaradesk/tickets">
            <Button>
              View All Tickets
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.open} open • {stats.resolved} resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned to Me</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assigned_to_me}</div>
            <p className="text-xs text-muted-foreground">
              {stats.in_progress} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">
              Past SLA due date
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avg_response_time > 0 ? `${Math.round(stats.avg_response_time / 60)}h` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.avg_resolution_time > 0 ? `Resolution: ${Math.round(stats.avg_resolution_time / 60)}h` : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Open</span>
                <span className="font-medium">{stats.open}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Assigned</span>
                <span className="font-medium">{stats.assigned}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">In Progress</span>
                <span className="font-medium">{stats.in_progress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Resolved</span>
                <span className="font-medium">{stats.resolved}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Closed</span>
                <span className="font-medium">{stats.closed}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.satisfaction_score > 0 ? `${stats.satisfaction_score}/5` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Average rating from surveys
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link to="/homaradesk/tickets?status=open">
                <Button variant="outline" className="w-full justify-start">
                  View Open Tickets
                </Button>
              </Link>
              <Link to="/homaradesk/tickets?assignee=me">
                <Button variant="outline" className="w-full justify-start">
                  My Tickets ({stats.assigned_to_me})
                </Button>
              </Link>
              <Link to="/homaradesk/tickets?overdue=true">
                <Button variant="outline" className="w-full justify-start">
                  Overdue Tickets ({stats.overdue})
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Ticket Volume Trends</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </div>
              <Link to="/homaradesk/analytics">
                <Button variant="ghost" size="sm">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {ticketVolumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
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
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
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
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => {
                      const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
                      return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                    })}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average Response Time</CardTitle>
            <CardDescription>Last 7 days (in hours)</CardDescription>
          </CardHeader>
          <CardContent>
            {responseTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
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
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Agents Performance</CardTitle>
            <CardDescription>Top 5 agents by resolution rate</CardDescription>
          </CardHeader>
          <CardContent>
            {agentPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={agentPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="resolved" fill="#10b981" name="Resolved" />
                  <Bar dataKey="total" fill="#3b82f6" name="Total Assigned" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No agent data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tickets</CardTitle>
          <CardDescription>
            Latest tickets requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentTickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tickets found</p>
              <p className="text-sm mt-2">
                Tickets will appear here once created
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/homaradesk/tickets/${ticket.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {ticket.ticket_number}
                      </span>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <div className="font-medium text-sm truncate">{ticket.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {ticket.requester_name && (
                        <span>Requester: {ticket.requester_name}</span>
                      )}
                      {ticket.assignee_name && (
                        <span className="ml-3">Assignee: {ticket.assignee_name}</span>
                      )}
                      <span className="ml-3">
                        {format(new Date(ticket.last_activity_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-4 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

