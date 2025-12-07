import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  Mail,
  Phone,
  Video,
  Eye,
  FileText,
  CreditCard,
  MessageSquare,
  Tag,
  UserPlus,
  Edit,
  TrendingUp,
  Users,
  Clock,
} from 'lucide-react';
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { ExportButton } from '@/components/admin/ExportButton';
import { formatDateForExport, type ExportColumn } from '@/lib/export-utils';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ActivityItem {
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
  created_at: string;
  contact?: {
    full_name: string;
    email: string | null;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Activities() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    week: 0,
    month: 0,
    byType: {} as Record<string, number>,
    byDate: [] as Array<{ date: string; count: number }>,
  });

  useEffect(() => {
    fetchActivities();
    fetchStats();
  }, [activityTypeFilter, dateRangeFilter]);

  const getDateRange = () => {
    const now = new Date();
    switch (dateRangeFilter) {
      case 'today':
        return {
          start: startOfDay(now).toISOString(),
          end: endOfDay(now).toISOString(),
        };
      case 'week':
        return {
          start: startOfDay(subDays(now, 7)).toISOString(),
          end: endOfDay(now).toISOString(),
        };
      case 'month':
        return {
          start: startOfDay(subDays(now, 30)).toISOString(),
          end: endOfDay(now).toISOString(),
        };
      case 'year':
        return {
          start: startOfDay(subDays(now, 365)).toISOString(),
          end: endOfDay(now).toISOString(),
        };
      default:
        return { start: null, end: null };
    }
  };

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange();
      
      let query = supabase.from('crm_activities').select(`
        *,
        contact:crm_contacts!crm_activities_contact_id_fkey(full_name, email)
      `);

      // Apply filters
      if (activityTypeFilter !== 'all') {
        query = query.eq('activity_type', activityTypeFilter);
      }

      if (dateRange.start) {
        query = query.gte('created_at', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('created_at', dateRange.end);
      }

      // Search
      if (searchQuery) {
        query = query.or(`subject.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      query = query.order('created_at', { ascending: false }).limit(100);

      const { data, error } = await query;

      if (error) throw error;

      setActivities((data as any) || []);
    } catch (error: any) {
      logger.error('Error fetching activities', { error });
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const today = startOfDay(new Date()).toISOString();
      const weekAgo = startOfDay(subDays(new Date(), 7)).toISOString();
      const monthAgo = startOfDay(subDays(new Date(), 30)).toISOString();

      // Total count
      const { count: total } = await supabase
        .from('crm_activities')
        .select('*', { count: 'exact', head: true });

      // Today's count
      const { count: todayCount } = await supabase
        .from('crm_activities')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      // Week count
      const { count: weekCount } = await supabase
        .from('crm_activities')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo);

      // Month count
      const { count: monthCount } = await supabase
        .from('crm_activities')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthAgo);

      // By type
      const { data: byTypeData } = await supabase
        .from('crm_activities')
        .select('activity_type')
        .gte('created_at', weekAgo);

      const byType: Record<string, number> = {};
      if (byTypeData) {
        byTypeData.forEach((item) => {
          byType[item.activity_type] = (byType[item.activity_type] || 0) + 1;
        });
      }

      // By date (last 7 days)
      const dateRange = getDateRange();
      const { data: byDateData } = await supabase
        .from('crm_activities')
        .select('created_at')
        .gte('created_at', dateRange.start || weekAgo)
        .lte('created_at', dateRange.end || new Date().toISOString());

      const byDateMap: Record<string, number> = {};
      if (byDateData) {
        byDateData.forEach((item) => {
          const date = format(new Date(item.created_at), 'yyyy-MM-dd');
          byDateMap[date] = (byDateMap[date] || 0) + 1;
        });
      }

      const byDate = Object.entries(byDateMap)
        .map(([date, count]) => ({ date: format(new Date(date), 'MMM d'), count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setStats({
        total: total || 0,
        today: todayCount || 0,
        week: weekCount || 0,
        month: monthCount || 0,
        byType,
        byDate,
      });
    } catch (error: any) {
      logger.error('Error fetching stats', { error });
    }
  };

  const getActivityIcon = (activityType: string) => {
    const iconMap: Record<string, any> = {
      email: <Mail className="h-4 w-4" />,
      sms: <MessageSquare className="h-4 w-4" />,
      call: <Phone className="h-4 w-4" />,
      meeting: <Video className="h-4 w-4" />,
      property_view: <Eye className="h-4 w-4" />,
      property_save: <Activity className="h-4 w-4" />,
      property_inquiry: <MessageSquare className="h-4 w-4" />,
      application_submitted: <FileText className="h-4 w-4" />,
      booking_created: <Calendar className="h-4 w-4" />,
      payment_received: <CreditCard className="h-4 w-4" />,
      message_sent: <MessageSquare className="h-4 w-4" />,
      note_added: <FileText className="h-4 w-4" />,
      tag_assigned: <Tag className="h-4 w-4" />,
      contact_created: <UserPlus className="h-4 w-4" />,
      contact_updated: <Edit className="h-4 w-4" />,
    };
    return iconMap[activityType] || <Activity className="h-4 w-4" />;
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
    'call',
    'meeting',
    'property_view',
    'property_save',
    'property_inquiry',
    'application_submitted',
    'booking_created',
    'payment_received',
    'message_sent',
    'note_added',
    'tag_assigned',
    'contact_created',
  ];

  const pieChartData = Object.entries(stats.byType)
    .map(([name, value]) => ({ name: formatActivityType(name), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const exportColumns: ExportColumn[] = [
    { key: 'activity_type', label: 'Activity Type', format: formatActivityType },
    { key: 'subject', label: 'Subject' },
    { key: 'description', label: 'Description' },
    { key: 'contact.full_name', label: 'Contact Name' },
    { key: 'contact.email', label: 'Contact Email' },
    { key: 'status', label: 'Status' },
    { key: 'duration_minutes', label: 'Duration (minutes)' },
    { key: 'related_record_type', label: 'Related Record Type' },
    { key: 'created_at', label: 'Created At', format: formatDateForExport },
  ];

  const exportFilterCriteria = {
    activityType: activityTypeFilter,
    dateRange: dateRangeFilter,
    search: searchQuery,
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
          <p className="text-muted-foreground">
            Track all interactions and activities across your CRM
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchActivities(); fetchStats(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <ExportButton
            data={activities}
            columns={exportColumns}
            filename="crm-activities"
            pageType="crm-activities"
            filterCriteria={exportFilterCriteria}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
            <p className="text-xs text-muted-foreground">Activities today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.week}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.month}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity Volume</CardTitle>
            <CardDescription>Activities over time</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.byDate.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.byDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#0088FE" />
                </BarChart>
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
            <CardTitle>Activity Types</CardTitle>
            <CardDescription>Distribution by type</CardDescription>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
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

      {/* Filters and Activities List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Activity Timeline</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[250px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchActivities();
                  }
                }}
              />
              <Button variant="outline" size="icon" onClick={fetchActivities}>
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No activities found</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="relative space-y-4 before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-border">
                {activities.map((activity) => (
                  <div key={activity.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className="absolute left-2 top-2 w-4 h-4 rounded-full border-2 border-background bg-primary flex items-center justify-center text-white">
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

                          {activity.contact && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <Users className="h-3 w-3" />
                              <span>{activity.contact.full_name || activity.contact.email || 'Unknown'}</span>
                            </div>
                          )}

                          {activity.related_record_type && activity.related_record_id && (
                            <Badge variant="secondary" className="text-xs">
                              Related: {activity.related_record_type} ({activity.related_record_id.substring(0, 8)}...)
                            </Badge>
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
    </div>
  );
}

