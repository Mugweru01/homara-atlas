import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Mail,
  Phone,
  Video,
  Calendar,
  MessageSquare,
  Eye,
  Search,
  FileText,
  CreditCard,
  Home,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Filter,
  RefreshCw,
  Activity,
  Building,
  ShoppingCart,
  UserPlus,
  Tag,
  Edit,
  Save,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';

interface ContactActivity {
  id: string;
  contact_id: string;
  user_id: string | null;
  activity_type: string;
  subject: string | null;
  description: string | null;
  activity_data: Record<string, any>;
  related_record_type: string | null;
  related_record_id: string | null;
  duration_minutes: number | null;
  status: string;
  created_by: string | null;
  created_at: string;
}

interface ContactActivityTimelineProps {
  contactId: string;
}

export function ContactActivityTimeline({ contactId }: ContactActivityTimelineProps) {
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [totalCount, setTotalCount] = useState(0);
  const [createActivityDialogOpen, setCreateActivityDialogOpen] = useState(false);
  const [newActivity, setNewActivity] = useState({
    activity_type: 'call',
    subject: '',
    description: '',
    duration_minutes: null as number | null,
    status: 'completed' as 'completed' | 'pending' | 'cancelled' | 'failed',
  });

  useEffect(() => {
    if (contactId) {
      fetchActivities();
    }
  }, [contactId, activityTypeFilter, dateRangeFilter]);

  const fetchActivities = async () => {
    if (!contactId) return;

    setLoading(true);
    try {
      let startDate: string | null = null;
      let endDate: string | null = null;

      // Calculate date range
      if (dateRangeFilter !== 'all') {
        const now = new Date();
        switch (dateRangeFilter) {
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
            endDate = new Date().toISOString();
            break;
          case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
            endDate = new Date().toISOString();
            break;
          case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
            endDate = new Date().toISOString();
            break;
          case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
            endDate = new Date().toISOString();
            break;
        }
      }

      const { data, error } = await supabase.rpc('get_contact_activities' as any, {
        p_contact_id: contactId,
        p_activity_type: activityTypeFilter === 'all' ? null : activityTypeFilter,
        p_start_date: startDate,
        p_end_date: endDate,
        p_limit: 100,
        p_offset: 0,
      });

      if (error) throw error;

      if (data && Array.isArray(data) && data.length > 0) {
        setActivities(data as ContactActivity[]);
        setTotalCount((data[0] as any)?.total_count || 0);
      } else {
        setActivities([]);
        setTotalCount(0);
      }
    } catch (error: any) {
      logger.error('Error fetching activities', { error });
      toast.error('Failed to load activities');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = async () => {
    if (!newActivity.subject && !newActivity.description) {
      toast.error('Subject or description is required');
      return;
    }

    try {
      const { error } = await supabase.rpc('create_crm_activity' as any, {
        p_activity_type: newActivity.activity_type,
        p_contact_id: contactId,
        p_subject: newActivity.subject || null,
        p_description: newActivity.description || null,
        p_duration_minutes: newActivity.duration_minutes || null,
        p_status: newActivity.status,
      });

      if (error) throw error;

      toast.success('Activity created successfully');
      setCreateActivityDialogOpen(false);
      setNewActivity({
        activity_type: 'call',
        subject: '',
        description: '',
        duration_minutes: null,
        status: 'completed',
      });
      fetchActivities();
    } catch (error: any) {
      logger.error('Error creating activity', { error });
      toast.error(error?.message || 'Failed to create activity');
    }
  };

  const getActivityIcon = (activityType: string) => {
    const iconMap: Record<string, any> = {
      email: <Mail className="h-4 w-4" />,
      sms: <MessageSquare className="h-4 w-4" />,
      call: <Phone className="h-4 w-4" />,
      meeting: <Video className="h-4 w-4" />,
      property_view: <Eye className="h-4 w-4" />,
      property_save: <Save className="h-4 w-4" />,
      property_inquiry: <MessageSquare className="h-4 w-4" />,
      search_performed: <Search className="h-4 w-4" />,
      filter_applied: <Filter className="h-4 w-4" />,
      application_submitted: <FileText className="h-4 w-4" />,
      booking_created: <Calendar className="h-4 w-4" />,
      booking_confirmed: <CheckCircle className="h-4 w-4" />,
      booking_cancelled: <XCircle className="h-4 w-4" />,
      viewing_scheduled: <Calendar className="h-4 w-4" />,
      payment_received: <CreditCard className="h-4 w-4" />,
      payment_failed: <XCircle className="h-4 w-4" />,
      message_sent: <MessageSquare className="h-4 w-4" />,
      message_received: <MessageSquare className="h-4 w-4" />,
      note_added: <FileText className="h-4 w-4" />,
      tag_assigned: <Tag className="h-4 w-4" />,
      contact_created: <UserPlus className="h-4 w-4" />,
      contact_updated: <Edit className="h-4 w-4" />,
    };
    return iconMap[activityType] || <Activity className="h-4 w-4" />;
  };

  const getActivityColor = (activityType: string) => {
    const colorMap: Record<string, string> = {
      email: 'bg-blue-500',
      sms: 'bg-green-500',
      call: 'bg-purple-500',
      meeting: 'bg-indigo-500',
      property_view: 'bg-gray-500',
      property_save: 'bg-red-500',
      property_inquiry: 'bg-yellow-500',
      application_submitted: 'bg-blue-600',
      booking_created: 'bg-green-600',
      booking_confirmed: 'bg-green-700',
      booking_cancelled: 'bg-red-600',
      viewing_scheduled: 'bg-blue-700',
      payment_received: 'bg-emerald-500',
      payment_failed: 'bg-red-500',
      message_sent: 'bg-teal-500',
      message_received: 'bg-cyan-500',
      note_added: 'bg-gray-600',
      tag_assigned: 'bg-orange-500',
      contact_created: 'bg-green-500',
      contact_updated: 'bg-yellow-500',
    };
    return colorMap[activityType] || 'bg-gray-500';
  };

  const formatActivityType = (activityType: string) => {
    return activityType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getActivityTypes = () => [
    'all',
    'email',
    'sms',
    'call',
    'meeting',
    'property_view',
    'property_save',
    'property_inquiry',
    'application_submitted',
    'booking_created',
    'booking_confirmed',
    'viewing_scheduled',
    'payment_received',
    'message_sent',
    'message_received',
    'note_added',
    'tag_assigned',
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Timeline</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {totalCount} {totalCount === 1 ? 'activity' : 'activities'} tracked
              </p>
            </div>
            <Button onClick={() => setCreateActivityDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Activity
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Activity Type" />
              </SelectTrigger>
              <SelectContent>
                {getActivityTypes().map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'all' ? 'All Types' : formatActivityType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchActivities}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-2">No activities yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Start tracking interactions with this contact
              </p>
              <Button onClick={() => setCreateActivityDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Activity
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="relative space-y-4 before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-border">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-2 top-2 w-4 h-4 rounded-full border-2 border-background ${getActivityColor(
                        activity.activity_type
                      )} flex items-center justify-center text-white`}
                    >
                      <div className="scale-75">{getActivityIcon(activity.activity_type)}</div>
                    </div>

                    {/* Activity content */}
                    <div className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="gap-1">
                              {getActivityIcon(activity.activity_type)}
                              {formatActivityType(activity.activity_type)}
                            </Badge>
                            {activity.status && (
                              <Badge
                                variant={
                                  activity.status === 'completed'
                                    ? 'default'
                                    : activity.status === 'pending'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                              >
                                {activity.status}
                              </Badge>
                            )}
                          </div>

                          {activity.subject && (
                            <h4 className="font-medium mb-1">{activity.subject}</h4>
                          )}

                          {activity.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {activity.description}
                            </p>
                          )}

                          {activity.duration_minutes && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              <Clock className="h-3 w-3" />
                              {activity.duration_minutes} minutes
                            </div>
                          )}

                          {activity.related_record_type && activity.related_record_id && (
                            <Badge variant="secondary" className="text-xs">
                              Related: {activity.related_record_type} ({activity.related_record_id.substring(0, 8)}...)
                            </Badge>
                          )}

                          {activity.activity_data && Object.keys(activity.activity_data).length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              <details>
                                <summary className="cursor-pointer hover:text-foreground">
                                  View details
                                </summary>
                                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                                  {JSON.stringify(activity.activity_data, null, 2)}
                                </pre>
                              </details>
                            </div>
                          )}
                        </div>

                        <div className="text-right text-xs text-muted-foreground">
                          <div title={format(new Date(activity.created_at), 'PPpp')}>
                            {formatDistanceToNow(new Date(activity.created_at), {
                              addSuffix: true,
                            })}
                          </div>
                          <div className="mt-1">
                            {format(new Date(activity.created_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Activity Dialog */}
      <Dialog open={createActivityDialogOpen} onOpenChange={setCreateActivityDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
            <DialogDescription>
              Record a new activity for this contact
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Activity Type *</Label>
                <Select
                  value={newActivity.activity_type}
                  onValueChange={(value) =>
                    setNewActivity({ ...newActivity, activity_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="note_added">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={newActivity.status}
                  onValueChange={(value: any) =>
                    setNewActivity({ ...newActivity, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={newActivity.subject}
                onChange={(e) =>
                  setNewActivity({ ...newActivity, subject: e.target.value })
                }
                placeholder="Brief subject line"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newActivity.description}
                onChange={(e) =>
                  setNewActivity({ ...newActivity, description: e.target.value })
                }
                placeholder="Detailed description of the activity..."
                rows={4}
              />
            </div>
            {(newActivity.activity_type === 'call' || newActivity.activity_type === 'meeting') && (
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={newActivity.duration_minutes || ''}
                  onChange={(e) =>
                    setNewActivity({
                      ...newActivity,
                      duration_minutes: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="Duration in minutes"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateActivityDialogOpen(false);
                setNewActivity({
                  activity_type: 'call',
                  subject: '',
                  description: '',
                  duration_minutes: null,
                  status: 'completed',
                });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateActivity}>Add Activity</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

