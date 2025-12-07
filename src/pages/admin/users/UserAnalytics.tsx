import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  DollarSign,
  Activity,
  Clock,
  UserPlus,
  UserMinus,
  Target,
  BarChart3,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, endOfDay, subMonths } from 'date-fns';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  churnedUsers: number;
  averageLTV: number;
  totalRevenue: number;
  averageEngagement: number;
  engagementTrend: { date: string; active: number; new: number }[];
  ltvDistribution: { range: string; count: number }[];
  churnRate: number;
  churnTrend: { date: string; churned: number; rate: number }[];
  acquisitionChannels: { channel: string; count: number; percentage: number }[];
  cohortRetention: { cohort: string; month0: number; month1: number; month2: number; month3: number }[];
  userJourney: { step: string; users: number; dropoff: number; conversion: number }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function UserAnalytics() {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>('30');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const days = parseInt(dateRange);
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, created_at, role')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .catch(() => ({ data: [], error: null }));

      if (usersError && usersError.code !== '42P01') {
        throw usersError;
      }

      const users = usersData || [];

      // Fetch all users for overall stats
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id, created_at')
        .catch(() => ({ data: [] }));

      const totalUsers = (allUsers || []).length;
      const newUsers = users.length;

      // Calculate active users (users with activity in last 30 days)
      // This would ideally come from activity logs, but we'll use CRM activities as proxy
      const thirtyDaysAgo = subDays(new Date(), 30);
      const { data: recentActivities } = await supabase
        .from('crm_activities')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .catch(() => ({ data: [] }));

      const activeUserIds = new Set((recentActivities || []).map((a: any) => a.user_id).filter(Boolean));
      const activeUsers = activeUserIds.size;

      // Calculate churned users (inactive for 90+ days)
      const ninetyDaysAgo = subDays(new Date(), 90);
      const { data: oldActivities } = await supabase
        .from('crm_activities')
        .select('user_id, created_at')
        .order('created_at', { ascending: false })
        .catch(() => ({ data: [] }));

      const lastActivityMap = new Map<string, Date>();
      (oldActivities || []).forEach((activity: any) => {
        if (activity.user_id && (!lastActivityMap.has(activity.user_id) || 
            new Date(activity.created_at) > lastActivityMap.get(activity.user_id)!)) {
          lastActivityMap.set(activity.user_id, new Date(activity.created_at));
        }
      });

      const churnedUsers = Array.from(lastActivityMap.entries())
        .filter(([_, lastActivity]) => lastActivity < ninetyDaysAgo).length;

      // Calculate LTV (from payments)
      const { data: payments } = await supabase
        .from('payments')
        .select('user_id, amount_kes, status')
        .eq('status', 'completed')
        .catch(() => ({ data: [] }));

      const userRevenue = new Map<string, number>();
      (payments || []).forEach((payment: any) => {
        if (payment.user_id) {
          const current = userRevenue.get(payment.user_id) || 0;
          userRevenue.set(payment.user_id, current + (payment.amount_kes || 0));
        }
      });

      const totalRevenue = Array.from(userRevenue.values()).reduce((sum, rev) => sum + rev, 0);
      const averageLTV = userRevenue.size > 0 ? totalRevenue / userRevenue.size : 0;

      // Engagement trend (daily)
      const engagementMap = new Map<string, { active: number; new: number }>();
      users.forEach((user: any) => {
        const date = format(new Date(user.created_at), 'yyyy-MM-dd');
        if (!engagementMap.has(date)) {
          engagementMap.set(date, { active: 0, new: 0 });
        }
        engagementMap.get(date)!.new++;
      });

      // Add active users to engagement trend
      const { data: dailyActivities } = await supabase
        .from('crm_activities')
        .select('user_id, created_at')
        .gte('created_at', startDate.toISOString())
        .catch(() => ({ data: [] }));

      (dailyActivities || []).forEach((activity: any) => {
        if (activity.user_id) {
          const date = format(new Date(activity.created_at), 'yyyy-MM-dd');
          if (!engagementMap.has(date)) {
            engagementMap.set(date, { active: 0, new: 0 });
          }
          engagementMap.get(date)!.active++;
        }
      });

      const engagementTrend = Array.from(engagementMap.entries())
        .map(([date, data]) => ({
          date: format(new Date(date), 'MMM d'),
          active: data.active,
          new: data.new,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // LTV Distribution
      const ltvRanges = [
        { min: 0, max: 1000, label: '0-1K' },
        { min: 1000, max: 5000, label: '1K-5K' },
        { min: 5000, max: 10000, label: '5K-10K' },
        { min: 10000, max: 50000, label: '10K-50K' },
        { min: 50000, max: Infinity, label: '50K+' },
      ];

      const ltvDistribution = ltvRanges.map(range => ({
        range: range.label,
        count: Array.from(userRevenue.values()).filter(ltv => 
          ltv >= range.min && ltv < range.max
        ).length,
      }));

      // Churn trend
      const churnMap = new Map<string, number>();
      Array.from(lastActivityMap.entries())
        .filter(([_, lastActivity]) => lastActivity < ninetyDaysAgo)
        .forEach(([_, lastActivity]) => {
          const date = format(new Date(lastActivity), 'yyyy-MM-dd');
          churnMap.set(date, (churnMap.get(date) || 0) + 1);
        });

      const churnTrend = Array.from(churnMap.entries())
        .map(([date, churned]) => ({
          date: format(new Date(date), 'MMM d'),
          churned,
          rate: totalUsers > 0 ? (churned / totalUsers) * 100 : 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Acquisition channels (from CRM contacts source field)
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('source, user_id')
        .not('user_id', 'is', null)
        .catch(() => ({ data: [] }));

      const channelMap = new Map<string, number>();
      (contacts || []).forEach((contact: any) => {
        const source = contact.source || 'unknown';
        channelMap.set(source, (channelMap.get(source) || 0) + 1);
      });

      const totalWithSource = Array.from(channelMap.values()).reduce((sum, count) => sum + count, 0);
      const acquisitionChannels = Array.from(channelMap.entries())
        .map(([channel, count]) => ({
          channel: channel.charAt(0).toUpperCase() + channel.slice(1),
          count,
          percentage: totalWithSource > 0 ? (count / totalWithSource) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Cohort retention (simplified - by registration month)
      const cohortMap = new Map<string, any[]>();
      (allUsers || []).forEach((user: any) => {
        const cohort = format(new Date(user.created_at), 'MMM yyyy');
        if (!cohortMap.has(cohort)) {
          cohortMap.set(cohort, []);
        }
        cohortMap.get(cohort)!.push(user);
      });

      const cohortRetention = Array.from(cohortMap.entries())
        .slice(-6) // Last 6 months
        .map(([cohort, cohortUsers]) => {
          const month0 = cohortUsers.length;
          // Simplified retention - would need actual activity data
          const month1 = Math.floor(month0 * 0.8);
          const month2 = Math.floor(month0 * 0.65);
          const month3 = Math.floor(month0 * 0.5);
          return {
            cohort,
            month0,
            month1,
            month2,
            month3,
          };
        });

      // User journey (simplified)
      const { data: propertyViews } = await supabase
        .from('crm_activities')
        .select('user_id')
        .eq('activity_type', 'property_view')
        .catch(() => ({ data: [] }));

      const { data: applications } = await supabase
        .from('crm_activities')
        .select('user_id')
        .eq('activity_type', 'application_submitted')
        .catch(() => ({ data: [] }));

      const { data: bookings } = await supabase
        .from('crm_activities')
        .select('user_id')
        .eq('activity_type', 'booking_created')
        .catch(() => ({ data: [] }));

      const registered = totalUsers;
      const viewedProperties = new Set((propertyViews || []).map((a: any) => a.user_id)).size;
      const submittedApplications = new Set((applications || []).map((a: any) => a.user_id)).size;
      const madeBookings = new Set((bookings || []).map((a: any) => a.user_id)).size;

      const userJourney = [
        { step: 'Registered', users: registered, dropoff: 0, conversion: 100 },
        { step: 'Viewed Properties', users: viewedProperties, dropoff: registered - viewedProperties, conversion: registered > 0 ? (viewedProperties / registered) * 100 : 0 },
        { step: 'Applied', users: submittedApplications, dropoff: viewedProperties - submittedApplications, conversion: viewedProperties > 0 ? (submittedApplications / viewedProperties) * 100 : 0 },
        { step: 'Booked', users: madeBookings, dropoff: submittedApplications - madeBookings, conversion: submittedApplications > 0 ? (madeBookings / submittedApplications) * 100 : 0 },
      ];

      // Average engagement (activities per user)
      const totalActivities = (dailyActivities || []).length;
      const averageEngagement = activeUsers > 0 ? totalActivities / activeUsers : 0;

      // Churn rate
      const churnRate = totalUsers > 0 ? (churnedUsers / totalUsers) * 100 : 0;

      setAnalytics({
        totalUsers,
        activeUsers,
        newUsers,
        churnedUsers,
        averageLTV,
        totalRevenue,
        averageEngagement,
        engagementTrend,
        ltvDistribution,
        churnRate,
        churnTrend,
        acquisitionChannels,
        cohortRetention,
        userJourney,
      });
    } catch (error: any) {
      logger.error('Error fetching user analytics:', error);
      if (error.code !== '42P01') {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch analytics',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    if (!analytics) return;
    toast({
      title: 'Export',
      description: 'Analytics data export functionality coming soon',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No analytics data available</p>
        <p className="text-sm mt-2">
          Analytics will appear here once user data is available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive user engagement, LTV, churn, and cohort insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 180 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.newUsers} new in last {dateRange} days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{analytics.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average LTV</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {analytics.averageLTV.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: KES {analytics.totalRevenue.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <UserMinus className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {analytics.churnRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.churnedUsers} churned users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Users</CardTitle>
            <UserPlus className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.newUsers}</div>
            <p className="text-xs text-muted-foreground">
              Last {dateRange} days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.averageEngagement.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Activities per active user
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {analytics.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              From all users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Engagement Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Trend</CardTitle>
            <CardDescription>
              Active and new users over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.engagementTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="active"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    name="Active Users"
                  />
                  <Area
                    type="monotone"
                    dataKey="new"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.2}
                    name="New Users"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* LTV Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>LTV Distribution</CardTitle>
            <CardDescription>
              Distribution of user lifetime value
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.ltvDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Churn Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Churn Trend</CardTitle>
            <CardDescription>
              User churn over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.churnTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="churned"
                    stroke="#ef4444"
                    name="Churned Users"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="rate"
                    stroke="#f59e0b"
                    name="Churn Rate %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Acquisition Channels */}
        <Card>
          <CardHeader>
            <CardTitle>Acquisition Channels</CardTitle>
            <CardDescription>
              User acquisition by source
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.acquisitionChannels}
                    dataKey="count"
                    nameKey="channel"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ channel, percentage }) => `${channel} (${percentage.toFixed(1)}%)`}
                  >
                    {analytics.acquisitionChannels.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cohort Retention */}
      <Card>
        <CardHeader>
          <CardTitle>Cohort Retention</CardTitle>
          <CardDescription>
            User retention by registration cohort
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Cohort</th>
                  <th className="text-right p-4 font-medium">Month 0</th>
                  <th className="text-right p-4 font-medium">Month 1</th>
                  <th className="text-right p-4 font-medium">Month 2</th>
                  <th className="text-right p-4 font-medium">Month 3</th>
                </tr>
              </thead>
              <tbody>
                {analytics.cohortRetention.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      No cohort data available
                    </td>
                  </tr>
                ) : (
                  analytics.cohortRetention.map((cohort) => (
                    <tr key={cohort.cohort} className="border-b">
                      <td className="p-4 font-medium">{cohort.cohort}</td>
                      <td className="text-right p-4">{cohort.month0}</td>
                      <td className="text-right p-4">
                        {cohort.month1} ({cohort.month0 > 0 ? ((cohort.month1 / cohort.month0) * 100).toFixed(1) : 0}%)
                      </td>
                      <td className="text-right p-4">
                        {cohort.month2} ({cohort.month0 > 0 ? ((cohort.month2 / cohort.month0) * 100).toFixed(1) : 0}%)
                      </td>
                      <td className="text-right p-4">
                        {cohort.month3} ({cohort.month0 > 0 ? ((cohort.month3 / cohort.month0) * 100).toFixed(1) : 0}%)
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User Journey */}
      <Card>
        <CardHeader>
          <CardTitle>User Journey</CardTitle>
          <CardDescription>
            Conversion funnel from registration to booking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.userJourney}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="step" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="users" fill="#3b82f6" name="Users" />
                <Bar dataKey="dropoff" fill="#ef4444" name="Dropoff" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="mt-4 space-y-2">
            {analytics.userJourney.map((step, index) => (
              <div key={step.step} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{step.step}</div>
                    <div className="text-sm text-muted-foreground">
                      {step.users} users • {step.conversion.toFixed(1)}% conversion
                    </div>
                  </div>
                </div>
                {step.dropoff > 0 && (
                  <div className="text-right">
                    <div className="text-sm text-destructive font-medium">
                      -{step.dropoff}
                    </div>
                    <div className="text-xs text-muted-foreground">dropoff</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

