import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Download,
  Calendar,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  TrendingUp,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ExportButton } from '@/components/admin/ExportButton';
import { usePermissions } from '@/hooks/usePermissions';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'tickets' | 'performance' | 'sla' | 'satisfaction';
  icon: any;
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'ticket-summary',
    name: 'Ticket Summary Report',
    description: 'Overview of all tickets with status, priority, and assignee',
    category: 'tickets',
    icon: FileText,
  },
  {
    id: 'agent-performance',
    name: 'Agent Performance Report',
    description: 'Individual agent metrics including resolution rates and response times',
    category: 'performance',
    icon: Users,
  },
  {
    id: 'sla-compliance',
    name: 'SLA Compliance Report',
    description: 'SLA adherence metrics and breach analysis',
    category: 'sla',
    icon: CheckCircle,
  },
  {
    id: 'response-time',
    name: 'Response Time Report',
    description: 'Average response times by agent, team, and ticket type',
    category: 'performance',
    icon: Clock,
  },
  {
    id: 'resolution-time',
    name: 'Resolution Time Report',
    description: 'Average resolution times and trends',
    category: 'performance',
    icon: TrendingUp,
  },
  {
    id: 'customer-satisfaction',
    name: 'Customer Satisfaction Report',
    description: 'Satisfaction ratings and feedback analysis',
    category: 'satisfaction',
    icon: CheckCircle,
  },
  {
    id: 'ticket-trends',
    name: 'Ticket Trends Report',
    description: 'Ticket volume trends over time by category and type',
    category: 'tickets',
    icon: TrendingUp,
  },
  {
    id: 'sla-breaches',
    name: 'SLA Breach Report',
    description: 'Detailed list of tickets that breached SLA targets',
    category: 'sla',
    icon: AlertCircle,
  },
];

export default function HomaraDeskReports() {
  const permissions = usePermissions();
  
  if (!permissions.canViewReportsHD) {
    return null; // ProtectedRoute will handle redirect
  }
  
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedReport, setSelectedReport] = useState<ReportTemplate | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        return { start: subDays(now, 7), end: now };
      case '30d':
        return { start: subDays(now, 30), end: now };
      case '90d':
        return { start: subDays(now, 90), end: now };
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : subDays(now, 30),
          end: customEndDate ? new Date(customEndDate) : now,
        };
      default:
        return { start: subDays(now, 30), end: now };
    }
  };

  const generateReport = async (template: ReportTemplate) => {
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
          toast.error('Error', {
            description: 'Tickets table not found',
          });
          return;
        }
        throw ticketsError;
      }

      const ticketsList = tickets || [];

      // Fetch admin/agent data
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

      // Generate report based on template
      let reportData: any = {
        template: template.name,
        dateRange: `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`,
        generatedAt: format(new Date(), 'MMM d, yyyy HH:mm'),
        totalTickets: ticketsList.length,
      };

      switch (template.id) {
        case 'ticket-summary':
          reportData.data = ticketsList.map((t: any) => ({
            ticketNumber: t.ticket_number,
            title: t.title,
            status: t.status,
            priority: t.priority,
            category: t.category,
            assignee: t.assignee_id ? adminsMap.get(t.assignee_id) || 'Unassigned' : 'Unassigned',
            requester: t.requester_name || 'Unknown',
            createdAt: format(new Date(t.created_at), 'MMM d, yyyy HH:mm'),
            resolvedAt: t.resolved_at ? format(new Date(t.resolved_at), 'MMM d, yyyy HH:mm') : 'N/A',
          }));
          break;

        case 'agent-performance':
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
          reportData.data = Object.values(agentCounts).map(agent => ({
            agent: agent.name,
            totalAssigned: agent.total,
            resolved: agent.resolved,
            resolutionRate: agent.total > 0 ? Math.round((agent.resolved / agent.total) * 100) : 0,
            avgResponseTime: agent.total > 0 ? Math.round((agent.avgResponse / agent.total) / 60) : 0,
            avgResolutionTime: agent.total > 0 ? Math.round((agent.avgResolution / agent.total) / 60) : 0,
          }));
          break;

        case 'sla-compliance':
          const ticketsWithSLA = ticketsList.filter((t: any) => t.first_response_due_at || t.resolution_due_at);
          const slaCompliant = ticketsWithSLA.filter((t: any) => {
            if (t.status === 'resolved' || t.status === 'closed') {
              if (t.first_response_due_at && new Date(t.first_response_due_at) < new Date(t.first_response_at || t.created_at)) return false;
              if (t.resolution_due_at && new Date(t.resolution_due_at) < new Date(t.resolved_at || t.updated_at)) return false;
              return true;
            }
            return true;
          }).length;
          reportData.slaComplianceRate = ticketsWithSLA.length > 0 ? Math.round((slaCompliant / ticketsWithSLA.length) * 100) : 0;
          reportData.data = ticketsWithSLA.map((t: any) => ({
            ticketNumber: t.ticket_number,
            title: t.title,
            firstResponseDue: t.first_response_due_at ? format(new Date(t.first_response_due_at), 'MMM d, yyyy HH:mm') : 'N/A',
            firstResponseAt: t.first_response_at ? format(new Date(t.first_response_at), 'MMM d, yyyy HH:mm') : 'N/A',
            resolutionDue: t.resolution_due_at ? format(new Date(t.resolution_due_at), 'MMM d, yyyy HH:mm') : 'N/A',
            resolvedAt: t.resolved_at ? format(new Date(t.resolved_at), 'MMM d, yyyy HH:mm') : 'N/A',
            compliant: (() => {
              if (t.status === 'resolved' || t.status === 'closed') {
                if (t.first_response_due_at && new Date(t.first_response_due_at) < new Date(t.first_response_at || t.created_at)) return false;
                if (t.resolution_due_at && new Date(t.resolution_due_at) < new Date(t.resolved_at || t.updated_at)) return false;
                return true;
              }
              return true;
            })(),
          }));
          break;

        case 'response-time':
          const responseTimeByAgent: Record<string, { name: string; times: number[] }> = {};
          ticketsList.forEach((t: any) => {
            if (t.assignee_id && adminsMap.has(t.assignee_id) && t.first_response_time_minutes) {
              const agentName = adminsMap.get(t.assignee_id) || 'Unknown';
              if (!responseTimeByAgent[t.assignee_id]) {
                responseTimeByAgent[t.assignee_id] = { name: agentName, times: [] };
              }
              responseTimeByAgent[t.assignee_id].times.push(t.first_response_time_minutes);
            }
          });
          reportData.data = Object.entries(responseTimeByAgent).map(([id, agent]) => ({
            agent: agent.name,
            avgResponseTime: agent.times.length > 0 ? Math.round((agent.times.reduce((a, b) => a + b, 0) / agent.times.length) / 60) : 0,
            minResponseTime: agent.times.length > 0 ? Math.round(Math.min(...agent.times) / 60) : 0,
            maxResponseTime: agent.times.length > 0 ? Math.round(Math.max(...agent.times) / 60) : 0,
            totalResponses: agent.times.length,
          }));
          break;

        case 'resolution-time':
          const resolutionTimeByAgent: Record<string, { name: string; times: number[] }> = {};
          ticketsList.forEach((t: any) => {
            if (t.assignee_id && adminsMap.has(t.assignee_id) && t.resolution_time_minutes) {
              const agentName = adminsMap.get(t.assignee_id) || 'Unknown';
              if (!resolutionTimeByAgent[t.assignee_id]) {
                resolutionTimeByAgent[t.assignee_id] = { name: agentName, times: [] };
              }
              resolutionTimeByAgent[t.assignee_id].times.push(t.resolution_time_minutes);
            }
          });
          reportData.data = Object.entries(resolutionTimeByAgent).map(([id, agent]) => ({
            agent: agent.name,
            avgResolutionTime: agent.times.length > 0 ? Math.round((agent.times.reduce((a, b) => a + b, 0) / agent.times.length) / 60) : 0,
            minResolutionTime: agent.times.length > 0 ? Math.round(Math.min(...agent.times) / 60) : 0,
            maxResolutionTime: agent.times.length > 0 ? Math.round(Math.max(...agent.times) / 60) : 0,
            totalResolutions: agent.times.length,
          }));
          break;

        case 'customer-satisfaction':
          const ticketsWithRating = ticketsList.filter((t: any) => t.customer_satisfaction_rating);
          const avgRating = ticketsWithRating.length > 0
            ? ticketsWithRating.reduce((sum: number, t: any) => sum + (t.customer_satisfaction_rating || 0), 0) / ticketsWithRating.length
            : 0;
          reportData.averageRating = Math.round(avgRating * 10) / 10;
          reportData.totalRatings = ticketsWithRating.length;
          reportData.data = ticketsWithRating.map((t: any) => ({
            ticketNumber: t.ticket_number,
            title: t.title,
            rating: t.customer_satisfaction_rating,
            feedback: t.customer_satisfaction_feedback || 'No feedback',
            resolvedAt: t.resolved_at ? format(new Date(t.resolved_at), 'MMM d, yyyy HH:mm') : 'N/A',
          }));
          break;

        case 'ticket-trends':
          const days = eachDayOfInterval({ start, end });
          reportData.data = days.map(day => {
            const dayStart = startOfDay(day);
            const dayEnd = endOfDay(day);
            const dayTickets = ticketsList.filter((t: any) => {
              const ticketDate = new Date(t.created_at);
              return ticketDate >= dayStart && ticketDate < dayEnd;
            });
            const byCategory: Record<string, number> = {};
            const byType: Record<string, number> = {};
            dayTickets.forEach((t: any) => {
              byCategory[t.category || 'Uncategorized'] = (byCategory[t.category || 'Uncategorized'] || 0) + 1;
              byType[t.ticket_type || 'support'] = (byType[t.ticket_type || 'support'] || 0) + 1;
            });
            return {
              date: format(day, 'MMM d, yyyy'),
              total: dayTickets.length,
              resolved: dayTickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length,
              byCategory,
              byType,
            };
          });
          break;

        case 'sla-breaches':
          const breaches = ticketsList.filter((t: any) => {
            if (t.status === 'resolved' || t.status === 'closed') {
              if (t.first_response_due_at && new Date(t.first_response_due_at) < new Date(t.first_response_at || t.created_at)) return true;
              if (t.resolution_due_at && new Date(t.resolution_due_at) < new Date(t.resolved_at || t.updated_at)) return true;
            } else {
              // Check if currently overdue
              if (t.first_response_due_at && new Date(t.first_response_due_at) < new Date()) return true;
              if (t.resolution_due_at && new Date(t.resolution_due_at) < new Date()) return true;
            }
            return false;
          });
          reportData.totalBreaches = breaches.length;
          reportData.data = breaches.map((t: any) => ({
            ticketNumber: t.ticket_number,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignee: t.assignee_id ? adminsMap.get(t.assignee_id) || 'Unassigned' : 'Unassigned',
            firstResponseDue: t.first_response_due_at ? format(new Date(t.first_response_due_at), 'MMM d, yyyy HH:mm') : 'N/A',
            firstResponseAt: t.first_response_at ? format(new Date(t.first_response_at), 'MMM d, yyyy HH:mm') : 'N/A',
            resolutionDue: t.resolution_due_at ? format(new Date(t.resolution_due_at), 'MMM d, yyyy HH:mm') : 'N/A',
            resolvedAt: t.resolved_at ? format(new Date(t.resolved_at), 'MMM d, yyyy HH:mm') : 'N/A',
            breachType: (() => {
              if (t.first_response_due_at && new Date(t.first_response_due_at) < new Date(t.first_response_at || t.created_at)) return 'First Response';
              if (t.resolution_due_at && new Date(t.resolution_due_at) < new Date(t.resolved_at || t.updated_at)) return 'Resolution';
              if (t.first_response_due_at && new Date(t.first_response_due_at) < new Date()) return 'First Response (Overdue)';
              if (t.resolution_due_at && new Date(t.resolution_due_at) < new Date()) return 'Resolution (Overdue)';
              return 'Unknown';
            })(),
          }));
          break;
      }

      setGeneratedReport(reportData);
      setReportDialogOpen(true);
      toast.success('Report generated successfully');
    } catch (error: any) {
      logger.error('Error generating report:', error);
      toast.error('Error generating report', {
        description: error.message || 'Failed to generate report',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format: 'csv' | 'json') => {
    if (!generatedReport) return;

    if (format === 'csv') {
      const headers = Object.keys(generatedReport.data[0] || {});
      const csvRows = [
        headers.join(','),
        ...generatedReport.data.map((row: any) =>
          headers.map(header => {
            const value = row[header];
            if (typeof value === 'object') return JSON.stringify(value);
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(',')
        ),
      ];
      const csv = csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedReport.template.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const json = JSON.stringify(generatedReport, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedReport.template.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    }

    toast.success(`Report exported as ${format.toUpperCase()}`);
  };

  const categories = ['tickets', 'performance', 'sla', 'satisfaction'] as const;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTemplates = selectedCategory === 'all'
    ? reportTemplates
    : reportTemplates.filter(t => t.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and export detailed reports on tickets, performance, and SLA compliance
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Settings</CardTitle>
          <CardDescription>Configure date range and filters for your reports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dateRange === 'custom' && (
              <>
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Templates */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Report Templates</h2>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const Icon = template.icon;
            return (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => generateReport(template)}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{template.category}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Generated Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{generatedReport?.template}</DialogTitle>
            <DialogDescription>
              Generated on {generatedReport?.generatedAt} • Date Range: {generatedReport?.dateRange}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4">
            {generatedReport && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total Tickets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{generatedReport.totalTickets}</div>
                    </CardContent>
                  </Card>
                  {generatedReport.slaComplianceRate !== undefined && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">SLA Compliance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{generatedReport.slaComplianceRate}%</div>
                      </CardContent>
                    </Card>
                  )}
                  {generatedReport.averageRating !== undefined && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Avg Rating</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{generatedReport.averageRating}/5</div>
                      </CardContent>
                    </Card>
                  )}
                  {generatedReport.totalBreaches !== undefined && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">SLA Breaches</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-destructive">{generatedReport.totalBreaches}</div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                <div className="border rounded-md p-4 max-h-[400px] overflow-auto">
                  <pre className="text-sm">{JSON.stringify(generatedReport.data, null, 2)}</pre>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => exportReport('csv')} disabled={!generatedReport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => exportReport('json')} disabled={!generatedReport}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function eachDayOfInterval({ start, end }: { start: Date; end: Date }): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

