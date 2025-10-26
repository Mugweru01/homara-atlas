import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { 
  Search, 
  RefreshCw, 
  Download, 
  ScrollText, 
  CheckCircle2, 
  XCircle, 
  User, 
  Shield,
  Activity,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';

interface AuditLog {
  id: string;
  admin_email: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setLogs(data || []);
      toast.success('Audit logs loaded successfully');
    } catch (error) {
      logger.error('Error fetching audit logs', { error });
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !search ||
      log.admin_email.toLowerCase().includes(search.toLowerCase()) ||
      log.action_type.toLowerCase().includes(search.toLowerCase()) ||
      (log.target_type && log.target_type.toLowerCase().includes(search.toLowerCase()));

    const matchesAction =
      actionFilter === 'all' || log.action_type === actionFilter;

    const matchesStatus =
      statusFilter === 'all' || 
      (statusFilter === 'success' && log.success) ||
      (statusFilter === 'failed' && !log.success);

    return matchesSearch && matchesAction && matchesStatus;
  });

  const getActionBadgeVariant = (actionType: string) => {
    if (actionType.includes('login')) return { color: 'info', icon: Shield };
    if (actionType.includes('approved')) return { color: 'success', icon: CheckCircle2 };
    if (actionType.includes('rejected') || actionType.includes('failed')) return { color: 'destructive', icon: XCircle };
    if (actionType.includes('viewed')) return { color: 'default', icon: User };
    return { color: 'primary', icon: Activity };
  };

  const exportLogs = () => {
    const csv = [
      ['Date', 'Admin', 'Action', 'Target Type', 'Success', 'Details'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.admin_email,
        log.action_type,
        log.target_type || 'N/A',
        log.success ? 'Yes' : 'No',
        JSON.stringify(log.details).replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Audit logs exported successfully');
  };

  const getStats = () => {
    return {
      total: logs.length,
      success: logs.filter(l => l.success).length,
      failed: logs.filter(l => !l.success).length,
      uniqueAdmins: new Set(logs.map(l => l.admin_email)).size,
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-muted/50 rounded-lg animate-shimmer"></div>
          <div className="h-5 w-64 bg-muted/30 rounded animate-shimmer"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted/20 rounded-xl animate-shimmer" style={{ animationDelay: `${i * 50}ms` }}></div>
          ))}
        </div>
        <Card className="border-border/50">
          <CardHeader>
            <div className="h-6 w-32 bg-muted/50 rounded animate-shimmer"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted/20 rounded animate-shimmer" style={{ animationDelay: `${i * 50}ms` }}></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <ScrollText className="h-6 w-6 text-primary" />
          </div>
          Audit Logs
        </h1>
        <p className="text-muted-foreground mt-1">
          Security event log for compliance and auditing • Last 100 events
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
        {[
          { label: 'Total Events', value: stats.total, color: 'primary', icon: Activity },
          { label: 'Successful', value: stats.success, color: 'success', icon: CheckCircle2 },
          { label: 'Failed', value: stats.failed, color: 'destructive', icon: XCircle },
          { label: 'Unique Admins', value: stats.uniqueAdmins, color: 'info', icon: Shield },
        ].map((stat, index) => (
          <Card key={stat.label} className="border-border/50 hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg bg-${stat.color}/10`}>
                  <stat.icon className={`h-5 w-5 text-${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Card */}
      <Card className="border-border/50 shadow-soft animate-fade-up" style={{ animationDelay: '200ms' }}>
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-card/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">Security Events</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchLogs}
                className="hover:bg-accent hover:scale-105 transition-all duration-200"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportLogs}
                className="hover:bg-accent hover:scale-105 transition-all duration-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by admin, action, or target..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[200px] h-10">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="admin_login">Login</SelectItem>
                <SelectItem value="admin_logout">Logout</SelectItem>
                <SelectItem value="property_approved">Property Approved</SelectItem>
                <SelectItem value="property_rejected">Property Rejected</SelectItem>
                <SelectItem value="verification_approved">Verification Approved</SelectItem>
                <SelectItem value="verification_rejected">Verification Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/50">
                  <TableHead className="font-semibold">Timestamp</TableHead>
                  <TableHead className="font-semibold">Admin</TableHead>
                  <TableHead className="font-semibold">Action</TableHead>
                  <TableHead className="font-semibold">Target</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-full bg-muted/50">
                          <ScrollText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-lg">No audit logs found</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {search || actionFilter !== 'all' || statusFilter !== 'all' 
                              ? 'Try adjusting your filters'
                              : 'Security events will appear here'
                            }
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log, index) => {
                    const badgeInfo = getActionBadgeVariant(log.action_type);
                    const BadgeIcon = badgeInfo.icon;
                    
                    return (
                      <TableRow 
                        key={log.id} 
                        className="group hover:bg-accent/50 transition-all duration-200 border-b border-border/30 animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="text-[10px]">{new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-semibold">
                              {log.admin_email.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm group-hover:text-primary transition-colors">
                              {log.admin_email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={badgeInfo.color === 'success' ? 'default' : badgeInfo.color === 'destructive' ? 'destructive' : 'outline'}
                            className={`
                              ${badgeInfo.color === 'success' ? 'bg-success/10 text-success border-success/20 hover:bg-success/20' : ''}
                              ${badgeInfo.color === 'info' ? 'bg-info/10 text-info border-info/20 hover:bg-info/20' : ''}
                              ${badgeInfo.color === 'primary' ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' : ''}
                              font-medium transition-colors
                            `}
                          >
                            <BadgeIcon className="h-3 w-3 mr-1" />
                            {log.action_type.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.target_type ? (
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground"></div>
                              <span className="text-sm text-muted-foreground font-medium">
                                {log.target_type}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 transition-colors font-medium">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-destructive text-destructive hover:bg-destructive/10 transition-colors font-medium">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-xs text-muted-foreground truncate" title={log.error_message || JSON.stringify(log.details)}>
                            {log.error_message || (Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : '-')}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer Info */}
          {filteredLogs.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Showing <span className="font-medium text-foreground">{filteredLogs.length}</span> of <span className="font-medium text-foreground">{logs.length}</span> events
              </p>
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse"></span>
                Last updated: just now
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
