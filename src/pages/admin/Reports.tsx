import { useState, useEffect } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Calendar,
  Clock,
  Plus,
  Download,
  Trash2,
  PlayCircle,
  PauseCircle,
  FileText,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ReportSchedule {
  id: string;
  report_name: string;
  report_description: string | null;
  report_type: string;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string | null;
  filter_criteria: any;
  columns_to_include: string[] | null;
  format: string;
  email_recipients: string[] | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

interface GeneratedReport {
  id: string;
  schedule_id: string | null;
  report_name: string;
  report_type: string;
  file_name: string;
  file_format: string;
  file_size_bytes: number | null;
  record_count: number;
  generation_status: string;
  generated_at: string;
  downloaded_at: string | null;
  download_count: number;
}

interface ReportStats {
  total_schedules: number;
  active_schedules: number;
  total_generated_reports: number;
  reports_this_month: number;
  most_generated_type: string | null;
}

export default function Reports() {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportType, setReportType] = useState('verifications');
  const [frequency, setFrequency] = useState('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [reportFormat, setReportFormat] = useState('csv');
  const [emailRecipients, setEmailRecipients] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .rpc('get_report_schedules');

      if (schedulesError) throw schedulesError;
      setSchedules(schedulesData || []);

      // Fetch generated reports
      const { data: reportsData, error: reportsError } = await supabase
        .rpc('get_generated_reports', { p_limit: 20 });

      if (reportsError) throw reportsError;
      setGeneratedReports(reportsData || []);

      // Fetch statistics
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_report_statistics');

      if (statsError) throw statsError;
      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!reportName.trim()) {
      toast.error('Report name is required');
      return;
    }

    setIsSaving(true);
    try {
      const recipients = emailRecipients
        .split(',')
        .map(e => e.trim())
        .filter(e => e);

      const { data, error } = await supabase.rpc('create_report_schedule', {
        p_report_name: reportName,
        p_report_type: reportType,
        p_frequency: frequency,
        p_report_description: reportDescription || null,
        p_day_of_week: frequency === 'weekly' ? dayOfWeek : null,
        p_time_of_day: timeOfDay,
        p_format: reportFormat,
        p_email_recipients: recipients.length > 0 ? recipients : null,
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to create schedule');
      }

      toast.success('Report schedule created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error creating schedule:', error);
      toast.error(error.message || 'Failed to create report schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSchedule = async (scheduleId: string, currentState: boolean) => {
    try {
      const { data, error } = await supabase.rpc('update_report_schedule', {
        p_schedule_id: scheduleId,
        p_is_active: !currentState,
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to update schedule');
      }

      toast.success(currentState ? 'Schedule paused' : 'Schedule activated');
      fetchData();
    } catch (error: any) {
      console.error('Error toggling schedule:', error);
      toast.error('Failed to update schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const { data, error } = await supabase.rpc('delete_report_schedule', {
        p_schedule_id: scheduleId,
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to delete schedule');
      }

      toast.success('Schedule deleted successfully');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  const resetForm = () => {
    setReportName('');
    setReportDescription('');
    setReportType('verifications');
    setFrequency('weekly');
    setDayOfWeek(1);
    setTimeOfDay('09:00');
    setReportFormat('csv');
    setEmailRecipients('');
  };

  const getFrequencyBadge = (frequency: string) => {
    const colors: Record<string, string> = {
      daily: 'bg-blue-500',
      weekly: 'bg-purple-500',
      monthly: 'bg-green-500',
    };
    return <Badge className={colors[frequency] || 'bg-gray-500'}>{frequency}</Badge>;
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="default" className="bg-green-500">Active</Badge>
    ) : (
      <Badge variant="secondary">Paused</Badge>
    );
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${kb.toFixed(2)} KB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Reports</h1>
          <p className="text-muted-foreground mt-1">
            Automate report generation and delivery
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Report Schedule</DialogTitle>
              <DialogDescription>
                Set up a new automated report schedule
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reportName">Report Name *</Label>
                <Input
                  id="reportName"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g., Weekly Verifications Report"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reportDescription">Description</Label>
                <Textarea
                  id="reportDescription"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="reportType">Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="verifications">Verifications</SelectItem>
                      <SelectItem value="users">Users</SelectItem>
                      <SelectItem value="listings">Listings</SelectItem>
                      <SelectItem value="audit">Audit Logs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {frequency === 'weekly' && (
                <div className="grid gap-2">
                  <Label htmlFor="dayOfWeek">Day of Week</Label>
                  <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sunday</SelectItem>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="timeOfDay">Time</Label>
                  <Input
                    id="timeOfDay"
                    type="time"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="format">Format</Label>
                  <Select value={reportFormat} onValueChange={setReportFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emailRecipients">
                  Email Recipients (comma-separated, optional)
                </Label>
                <Input
                  id="emailRecipients"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="admin@example.com, manager@example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSchedule} disabled={isSaving}>
                {isSaving ? 'Creating...' : 'Create Schedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_schedules}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
              <PlayCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_schedules}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Generated Reports</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_generated_reports}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.reports_this_month}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Schedules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Report Schedules</CardTitle>
          <CardDescription>Manage your automated report schedules</CardDescription>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No report schedules yet</p>
              <p className="text-sm">Create your first automated report schedule</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      {schedule.report_name}
                      {schedule.report_description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {schedule.report_description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{schedule.report_type}</Badge>
                    </TableCell>
                    <TableCell>{getFrequencyBadge(schedule.frequency)}</TableCell>
                    <TableCell>
                      {schedule.next_run_at ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {format(new Date(schedule.next_run_at), 'MMM dd, HH:mm')}
                        </div>
                      ) : (
                        'Not scheduled'
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(schedule.is_active)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleSchedule(schedule.id, schedule.is_active)}
                        >
                          {schedule.is_active ? (
                            <PauseCircle className="h-4 w-4" />
                          ) : (
                            <PlayCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generated Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>Recently generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {generatedReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No reports generated yet</p>
              <p className="text-sm">Reports will appear here once scheduled</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Downloads</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.report_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.report_type}</Badge>
                    </TableCell>
                    <TableCell>{report.record_count}</TableCell>
                    <TableCell>{formatFileSize(report.file_size_bytes)}</TableCell>
                    <TableCell>
                      {format(new Date(report.generated_at), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell>{report.download_count}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

