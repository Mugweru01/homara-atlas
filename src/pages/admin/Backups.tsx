import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Database, 
  Download, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface BackupStatus {
  last_backup_time: string | null;
  next_backup_time: string | null;
  backup_interval_days: number;
  total_backups: number;
  successful_backups: number;
  failed_backups: number;
  status: 'never_run' | 'overdue' | 'due_soon' | 'healthy';
}

interface BackupHistory {
  id: string;
  backup_id: string;
  backup_type: string;
  status: string;
  file_size_mb: number | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

export default function Backups() {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBackupData = async () => {
    try {
      // Get backup status
      const { data: statusData, error: statusError } = await supabase
        .rpc('get_backup_status');

      if (statusError) throw statusError;
      
      if (statusData && statusData.length > 0) {
        setBackupStatus(statusData[0]);
      }

      // Get backup history
      const { data: historyData, error: historyError } = await supabase
        .rpc('get_recent_backups', { p_limit: 20 });

      if (historyError) throw historyError;
      
      setBackupHistory(historyData || []);
    } catch (error: any) {
      console.error('Error fetching backup data:', error);
      toast.error('Failed to load backup data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBackupData();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchBackupData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchBackupData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'due_soon':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'never_run':
        return 'outline';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatFileSize = (mb: number | null) => {
    if (!mb) return 'N/A';
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Database Backups</h1>
          <p className="text-muted-foreground mt-1">
            Automated backup monitoring and management
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Backup Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup Status
          </CardTitle>
          <CardDescription>
            Current backup system health and configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupStatus ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Status Badge */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">System Status</p>
                <Badge variant={getStatusColor(backupStatus.status)} className="text-sm">
                  {backupStatus.status === 'healthy' && '✓ Healthy'}
                  {backupStatus.status === 'due_soon' && '⏰ Due Soon'}
                  {backupStatus.status === 'overdue' && '⚠ Overdue'}
                  {backupStatus.status === 'never_run' && '○ Never Run'}
                </Badge>
              </div>

              {/* Last Backup */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Last Backup</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">
                    {backupStatus.last_backup_time 
                      ? formatDistanceToNow(new Date(backupStatus.last_backup_time), { addSuffix: true })
                      : 'Never'}
                  </span>
                </div>
                {backupStatus.last_backup_time && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(backupStatus.last_backup_time), 'PPpp')}
                  </p>
                )}
              </div>

              {/* Next Backup */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Next Backup</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">
                    {backupStatus.next_backup_time 
                      ? formatDistanceToNow(new Date(backupStatus.next_backup_time), { addSuffix: true })
                      : 'Not scheduled'}
                  </span>
                </div>
                {backupStatus.next_backup_time && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(backupStatus.next_backup_time), 'PPpp')}
                  </p>
                )}
              </div>

              {/* Interval */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Backup Interval</p>
                <p className="text-2xl font-bold">
                  {backupStatus.backup_interval_days}
                  <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
                </p>
              </div>

              {/* Statistics */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Backups (30d)</p>
                <p className="text-2xl font-bold">{backupStatus.total_backups}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Successful</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">
                    {backupStatus.successful_backups}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Failed</p>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-2xl font-bold text-red-600">
                    {backupStatus.failed_backups}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {backupStatus.total_backups > 0
                    ? Math.round((backupStatus.successful_backups / backupStatus.total_backups) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No backup configuration found</p>
          )}
        </CardContent>
      </Card>

      {/* PITR Information */}
      <Card>
        <CardHeader>
          <CardTitle>Point-in-Time Recovery (PITR)</CardTitle>
          <CardDescription>
            Restore your database to any point in time within the retention period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4 p-4 border rounded-lg bg-primary/5">
            <Database className="h-6 w-6 text-primary mt-1" />
            <div className="flex-1">
              <h4 className="font-semibold mb-2">Supabase Automatic Backups</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Your database is protected with Point-in-Time Recovery. You can restore to any 
                second within the last 30 days through the Supabase Dashboard.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a 
                  href="https://supabase.com/dashboard/project/zsgyqhsajyiiluiutopg/settings/database" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Manage Backups in Supabase
                </a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 border rounded-lg">
              <p className="font-semibold mb-2">Retention Period</p>
              <p className="text-2xl font-bold">30 days</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="font-semibold mb-2">Backup Type</p>
              <p className="text-muted-foreground">Continuous (PITR)</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="font-semibold mb-2">Recovery Time</p>
              <p className="text-muted-foreground">~5-15 minutes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>
            Recent backup operations and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Backup ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupHistory.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(backup.status)}
                        <span className="capitalize">{backup.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {backup.backup_id.substring(0, 16)}...
                    </TableCell>
                    <TableCell className="capitalize">{backup.backup_type}</TableCell>
                    <TableCell>{formatFileSize(backup.file_size_mb)}</TableCell>
                    <TableCell>{formatDuration(backup.duration_seconds)}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(backup.started_at), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {backup.completed_at 
                        ? format(new Date(backup.completed_at), 'MMM dd, HH:mm')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No backup history available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

