import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Download,
  Calendar,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AgentPerformance {
  admin_id: string;
  email: string;
  full_name: string;
  admin_role: string;
  tickets_assigned: number;
  tickets_resolved: number;
  tickets_pending: number;
  avg_resolution_time_hours: number;
  customer_satisfaction_score: number;
  last_activity: string;
}

export default function TeamPerformance() {
  const { isSeniorAdmin, isSuperAdmin, loading: adminLoading } = useAdmin();
  const permissions = usePermissions();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalTickets: 0,
    avgResolutionTime: 0,
    avgSatisfaction: 0,
  });

  useEffect(() => {
    // Only fetch if authorized
    if (!adminLoading && (isSeniorAdmin || isSuperAdmin)) {
      fetchTeamPerformance();
    }
  }, [isSeniorAdmin, isSuperAdmin, period, adminLoading]);

  const fetchTeamPerformance = async () => {
    try {
      setLoading(true);
      
      // Get all junior admins and support admins (agents)
      const { data: agentsData, error: agentsError } = await supabase
        .from('admins')
        .select('id, email, full_name, admin_role, last_login_at')
        .in('admin_role', ['junior_admin', 'support_admin'])
        .eq('status', 'active');

      if (agentsError) throw agentsError;

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      if (period === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      }

      // Get ticket statistics for each agent
      const agentPerformance: AgentPerformance[] = [];
      let totalTickets = 0;
      let totalResolved = 0;
      let totalResolutionTime = 0;

      for (const agent of agentsData || []) {
        // Get tickets assigned to this agent
        const { data: tickets, error: ticketsError } = await supabase
          .from('homaradesk_tickets')
          .select('id, status, created_at, resolved_at, priority')
          .eq('assigned_to', agent.id)
          .gte('created_at', startDate.toISOString());

        if (ticketsError) {
          console.error(`Error fetching tickets for ${agent.email}:`, ticketsError);
          continue;
        }

        const ticketsList = tickets || [];
        const resolved = ticketsList.filter(t => t.status === 'resolved' || t.status === 'closed');
        const pending = ticketsList.filter(t => t.status === 'open' || t.status === 'in_progress');
        
        // Calculate average resolution time
        let avgResolutionTime = 0;
        if (resolved.length > 0) {
          const resolutionTimes = resolved
            .filter(t => t.resolved_at)
            .map(t => {
              const created = new Date(t.created_at);
              const resolved = new Date(t.resolved_at!);
              return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
            });
          avgResolutionTime = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
        }

        // Mock customer satisfaction (in real app, this would come from surveys)
        const satisfaction = resolved.length > 0 
          ? Math.min(5, 3.5 + (resolved.length / ticketsList.length) * 1.5)
          : 0;

        agentPerformance.push({
          admin_id: agent.id,
          email: agent.email || '',
          full_name: agent.full_name || agent.email?.split('@')[0] || 'Unknown',
          admin_role: agent.admin_role,
          tickets_assigned: ticketsList.length,
          tickets_resolved: resolved.length,
          tickets_pending: pending.length,
          avg_resolution_time_hours: avgResolutionTime,
          customer_satisfaction_score: satisfaction,
          last_activity: agent.last_login_at || 'Never',
        });

        totalTickets += ticketsList.length;
        totalResolved += resolved.length;
        if (avgResolutionTime > 0) {
          totalResolutionTime += avgResolutionTime;
        }
      }

      setAgents(agentPerformance);
      
      // Calculate overall stats
      const activeAgents = agentPerformance.filter(a => a.tickets_assigned > 0).length;
      const avgResolution = agentPerformance.length > 0 
        ? totalResolutionTime / agentPerformance.filter(a => a.avg_resolution_time_hours > 0).length 
        : 0;
      const avgSatisfaction = agentPerformance.length > 0
        ? agentPerformance.reduce((sum, a) => sum + a.customer_satisfaction_score, 0) / agentPerformance.length
        : 0;

      setStats({
        totalAgents: agentPerformance.length,
        activeAgents,
        totalTickets,
        avgResolutionTime: avgResolution,
        avgSatisfaction,
      });

    } catch (error) {
      console.error('Error fetching team performance:', error);
      toast.error('Failed to load team performance data');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    try {
      const csv = [
        ['Agent', 'Email', 'Role', 'Tickets Assigned', 'Tickets Resolved', 'Pending', 'Avg Resolution (hours)', 'Satisfaction Score', 'Last Activity'].join(','),
        ...agents.map(a => [
          a.full_name,
          a.email,
          a.admin_role,
          a.tickets_assigned,
          a.tickets_resolved,
          a.tickets_pending,
          a.avg_resolution_time_hours.toFixed(2),
          a.customer_satisfaction_score.toFixed(2),
          a.last_activity
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team-performance-${period}-${new Date().toISOString().split('T')[0]}.csv`;
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
              <Users className="h-6 w-6 text-primary" />
            </div>
            Team Performance
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor agent performance and team metrics
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
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAgents}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeAgents} active this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTickets}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTickets > 0 ? Math.round((stats.totalTickets / stats.totalAgents) * 10) / 10 : 0} per agent
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgSatisfaction.toFixed(1)}/5</div>
            <p className="text-xs text-muted-foreground">
              Average customer rating
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>
            Individual agent metrics for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Assigned</TableHead>
                  <TableHead className="text-center">Resolved</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Avg Resolution</TableHead>
                  <TableHead className="text-center">Satisfaction</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <p className="text-muted-foreground">No agent data available for this period</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => (
                    <TableRow key={agent.admin_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                            {agent.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{agent.full_name}</p>
                            <p className="text-sm text-muted-foreground">{agent.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {agent.admin_role.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{agent.tickets_assigned}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-success">{agent.tickets_resolved}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-warning">{agent.tickets_pending}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">
                          {agent.avg_resolution_time_hours > 0 
                            ? `${agent.avg_resolution_time_hours.toFixed(1)}h`
                            : 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-medium">{agent.customer_satisfaction_score.toFixed(1)}</span>
                          <span className="text-muted-foreground">/5</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {agent.last_activity === 'Never' 
                            ? 'Never' 
                            : new Date(agent.last_activity).toLocaleDateString()}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


