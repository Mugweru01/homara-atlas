import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Home,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Calendar,
  Gavel,
  Clock,
  Server,
  RefreshCw,
  FileText,
  Download,
  BarChart3,
  Settings,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityFeed } from '@/components/admin/ActivityFeed';
import { format, subDays, subMonths, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { useAdmin } from '@/hooks/useAdmin';
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

interface DashboardStats {
  total_users: number;
  total_landlords: number;
  total_properties: number;
  active_properties: number;
  pending_verifications: number;
  total_revenue?: number;
  active_bookings?: number;
  open_disputes?: number;
  active_auctions?: number;
  queue_size?: number;
  system_uptime?: number;
  response_time?: number;
  flagged_content?: number;
  pending_payments?: number;
  security_alerts?: number;
}

interface GrowthData {
  users_growth?: number;
  properties_growth?: number;
  revenue_growth?: number;
  bookings_growth?: number;
}

// Count-up animation hook
function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return count;
}

// Define stat type
interface StatData {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { direction: 'up' | 'down'; percentage: number };
}

// Individual stat card component with count-up animation
function StatCard({ 
  stat, 
  index,
  trend 
}: { 
  stat: {
    id: string;
    title: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    subtitle?: string;
    link?: string;
  }; 
  index: number;
  trend?: { direction: 'up' | 'down'; percentage: number };
}) {
  const animatedValue = useCountUp(stat.value, 1200);
  const Icon = stat.icon;

  return (
    <Card
      className={`group relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02] animate-fade-up ${stat.link ? 'cursor-pointer' : ''}`}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={stat.link ? () => window.location.href = stat.link! : undefined}
    >
      {/* Gradient Border Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-2xl transform translate-x-8 -translate-y-8"></div>

      <CardHeader className="relative flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
          {stat.title}
        </CardTitle>
        <div
          className={`rounded-xl p-2.5 ${stat.bgColor} group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className={`h-5 w-5 ${stat.color}`} />
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div className="flex items-baseline gap-3">
          <div className="text-4xl font-bold tracking-tight">
            {stat.id === 'total_revenue' 
              ? `KES ${animatedValue.toLocaleString()}K`
              : stat.value >= 1000 
                ? `${(stat.value / 1000).toFixed(1)}K` 
                : animatedValue.toLocaleString()}
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>{Math.abs(trend.percentage).toFixed(1)}%</span>
            </div>
          )}
        </div>
        {stat.subtitle && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {stat.subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface ChartData {
  userGrowth: Array<{ date: string; users: number }>;
  revenueTrends: Array<{ date: string; revenue: number }>;
  propertyTypes: Array<{ name: string; value: number }>;
  topProperties: Array<{ name: string; views: number; bookings: number }>;
}

export default function AdminDashboard() {
  const { isSuperAdmin, adminInfo } = useAdmin();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [growth, setGrowth] = useState<GrowthData>({});
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<number>(30);
  const [chartData, setChartData] = useState<ChartData>({
    userGrowth: [],
    revenueTrends: [],
    propertyTypes: [],
    topProperties: [],
  });

  useEffect(() => {
    fetchStats();
    fetchLayout();
    fetchGrowthData();
    fetchChartData();
    
    // Set up real-time subscriptions
    const subscriptions = [
      supabase
        .channel('dashboard-stats')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'profiles' },
          () => {
            fetchStats();
            fetchChartData();
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'properties' },
          () => {
            fetchStats();
            fetchChartData();
          }
        )
        .subscribe()
    ];

    // Refresh stats every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchChartData();
    }, 30000);

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
      clearInterval(interval);
    };
  }, [dateRange, isSuperAdmin]);

  const fetchStats = async () => {
    try {
      // Fetch dashboard stats using the existing function
      const { data: dashboardData, error: dashboardError } = await supabase.rpc('get_dashboard_stats');
      if (dashboardError) throw dashboardError;

      const baseStats = dashboardData as unknown as DashboardStats;
      
      // For non-super admins, don't fetch sensitive data
      if (!isSuperAdmin) {
        baseStats.total_users = 0;
        baseStats.total_revenue = 0;
        baseStats.active_auctions = 0;
        baseStats.queue_size = 0;
      }

      // Fetch additional stats (with error handling for tables that might not exist)
      const [
        bookingsResult,
        viewingsResult,
        disputesResult,
        auctionsResult,
        queueResult,
        revenueResult,
      ] = await Promise.allSettled([
        // Active bookings (short stays)
        supabase
          .from('short_stay_bookings')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'confirmed']),
        // Viewing bookings
        supabase
          .from('viewing_bookings')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'confirmed']),
        // Open disputes (may not exist yet)
        supabase
          .from('disputes')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'in_progress', 'under_review']),
        // Active auctions (only for super admins)
        isSuperAdmin
          ? supabase
              .from('marketplace_listings')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'active')
          : Promise.resolve({ data: null, count: 0, error: null }),
        // Bid queue size (only for super admins)
        isSuperAdmin
          ? supabase
              .from('bid_queue')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'pending')
          : Promise.resolve({ data: null, count: 0, error: null }),
        // Total revenue (from payments) (only for super admins)
        isSuperAdmin
          ? supabase
              .from('payments')
              .select('amount')
              .eq('status', 'completed')
              .gte('created_at', format(subDays(new Date(), 30), 'yyyy-MM-dd'))
          : Promise.resolve({ data: [], error: null }),
      ]);

      const bookingsCount = bookingsResult.status === 'fulfilled' ? (bookingsResult.value.count || 0) : 0;
      const viewingsCount = viewingsResult.status === 'fulfilled' ? (viewingsResult.value.count || 0) : 0;
      const activeBookings = bookingsCount + viewingsCount;
      
      const disputesCount = disputesResult.status === 'fulfilled' 
        ? (disputesResult.value.count || 0) 
        : 0;
      
      const auctionsCount = auctionsResult.status === 'fulfilled' 
        ? (auctionsResult.value.count || 0) 
        : 0;
      
      const queueCount = queueResult.status === 'fulfilled' 
        ? (queueResult.value.count || 0) 
        : 0;
      
      const totalRevenue = revenueResult.status === 'fulfilled' && revenueResult.value.data
        ? revenueResult.value.data.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
        : 0;

      // Fetch flagged content
      let flaggedCount = 0;
      try {
        const { count } = await supabase
          .from('property_flags')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        flaggedCount = count || 0;
      } catch (error) {
        // Table might not exist
        flaggedCount = 0;
      }

      // Fetch pending payments
      let pendingPaymentsCount = 0;
      try {
        const { count } = await supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'processing']);
        pendingPaymentsCount = count || 0;
      } catch (error) {
        // Table might not exist
        pendingPaymentsCount = 0;
      }

      // Fetch security alerts (from monitoring_alerts or similar)
      let alertsCount = 0;
      try {
        const { count } = await supabase
          .from('monitoring_alerts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        alertsCount = count || 0;
      } catch (error) {
        // Table might not exist
        alertsCount = 0;
      }

      setStats({
        ...baseStats,
        active_bookings: activeBookings,
        open_disputes: disputesCount,
        active_auctions: auctionsCount,
        queue_size: queueCount,
        total_revenue: totalRevenue,
        system_uptime: 99.9, // TODO: Calculate from system metrics
        response_time: 120, // TODO: Get from performance metrics
        flagged_content: flaggedCount || 0,
        pending_payments: pendingPaymentsCount || 0,
        security_alerts: alertsCount || 0,
      });
    } catch (error) {
      logger.error('Error fetching dashboard stats', { error });
    } finally {
      setLoading(false);
    }
  };

  const fetchGrowthData = async () => {
    try {
      const now = new Date();
      const lastMonth = subMonths(now, 1);
      const twoMonthsAgo = subMonths(now, 2);

      // Fetch current month stats
      const { data: currentUsers } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', format(lastMonth, 'yyyy-MM-dd'));

      // Fetch previous month stats
      const { data: previousUsers } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', format(twoMonthsAgo, 'yyyy-MM-dd'))
        .lt('created_at', format(lastMonth, 'yyyy-MM-dd'));

      const usersGrowth = previousUsers && previousUsers > 0
        ? ((currentUsers - previousUsers) / previousUsers) * 100
        : 0;

      // Similar calculations for properties and revenue
      const { data: currentProperties } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', format(lastMonth, 'yyyy-MM-dd'));

      const { data: previousProperties } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', format(twoMonthsAgo, 'yyyy-MM-dd'))
        .lt('created_at', format(lastMonth, 'yyyy-MM-dd'));

      const propertiesGrowth = previousProperties && previousProperties > 0
        ? ((currentProperties - previousProperties) / previousProperties) * 100
        : 0;

      setGrowth({
        users_growth: usersGrowth,
        properties_growth: propertiesGrowth,
      });
    } catch (error) {
      logger.error('Error fetching growth data', { error });
    }
  };

  const fetchLayout = async () => {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_layout');
      if (error) throw error;
      setLayout(data || []);
    } catch (error) {
      logger.error('Error fetching dashboard layout', { error });
    }
  };

  const fetchChartData = async () => {
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, dateRange);
      const days = eachDayOfInterval({ start: startDate, end: endDate });

      // Fetch user growth data (only for super admins)
      const userGrowthPromises = isSuperAdmin ? days.map(async (day) => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .lte('created_at', format(dayEnd, 'yyyy-MM-dd HH:mm:ss'));
        return {
          date: format(day, 'MMM dd'),
          users: count || 0,
        };
      }) : [];

      const userGrowth = isSuperAdmin ? await Promise.all(userGrowthPromises) : [];

      // Fetch revenue trends (only for super admins)
      const { data: payments } = isSuperAdmin
        ? await supabase
            .from('payments')
            .select('amount, created_at')
            .eq('status', 'completed')
            .gte('created_at', format(startDate, 'yyyy-MM-dd'))
        : { data: [] };

      const revenueByDay = days.map((day) => {
        const dayPayments = payments?.filter(p => {
          const paymentDate = new Date(p.created_at);
          return paymentDate >= startOfDay(day) && paymentDate <= endOfDay(day);
        }) || [];
        const revenue = dayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        return {
          date: format(day, 'MMM dd'),
          revenue: Math.round(revenue),
        };
      });

      // Fetch property types distribution
      const { data: properties } = await supabase
        .from('properties')
        .select('property_type');

      const typeCounts: Record<string, number> = {};
      properties?.forEach(p => {
        const type = p.property_type || 'Other';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      const propertyTypes = Object.entries(typeCounts).map(([name, value]) => ({
        name,
        value,
      }));

      // Fetch top performing properties
      const { data: topProps } = await supabase
        .from('properties')
        .select('id, title, views_count, saves_count')
        .order('views_count', { ascending: false })
        .limit(5);

      const topProperties = topProps?.map(p => ({
        name: p.title?.substring(0, 20) + (p.title && p.title.length > 20 ? '...' : '') || 'Untitled',
        views: p.views_count || 0,
        bookings: p.saves_count || 0, // Using saves as proxy for bookings
      })) || [];

      setChartData({
        userGrowth,
        revenueTrends: revenueByDay,
        propertyTypes,
        topProperties,
      });
    } catch (error) {
      logger.error('Error fetching chart data', { error });
    }
  };

  const exportChart = (chartId: string) => {
    // TODO: Implement chart export to PNG/PDF
    toast({
      title: 'Export',
      description: 'Chart export functionality coming soon',
    });
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-10 w-64 bg-muted/50 rounded-lg animate-shimmer"></div>
          <div className="h-5 w-48 bg-muted/30 rounded animate-shimmer"></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-40 bg-muted/20 rounded-xl animate-shimmer"
              style={{ animationDelay: `${i * 100}ms` }}
            ></div>
          ))}
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️ Good Morning';
    if (hour < 18) return '🌤️ Good Afternoon';
    return '🌙 Good Evening';
  };

  const isWidgetVisible = (widgetId: string) => {
    if (layout.length === 0) return true; // Show all if no layout saved
    const widget = layout.find((w: any) => w.id === widgetId);
    return widget ? widget.visible !== false : true;
  };

  // Sensitive cards that only super admins can see
  const sensitiveCardIds = ['user_stats', 'total_revenue', 'active_auctions', 'queue_status', 'system_health'];
  
  const statCards = [
    {
      id: 'user_stats',
      title: 'Total Users',
      value: stats?.total_users || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      subtitle: 'vs last month',
      link: '/admin/users',
      trend: growth.users_growth ? {
        direction: growth.users_growth >= 0 ? 'up' : 'down',
        percentage: Math.abs(growth.users_growth),
      } : undefined,
    },
    {
      id: 'active_properties',
      title: 'Active Properties',
      value: stats?.active_properties || 0,
      icon: Home,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      subtitle: 'vs last month',
      link: '/admin/listings',
      trend: growth.properties_growth ? {
        direction: growth.properties_growth >= 0 ? 'up' : 'down',
        percentage: Math.abs(growth.properties_growth),
      } : undefined,
    },
    {
      id: 'total_revenue',
      title: 'Total Revenue',
      value: Math.round((stats?.total_revenue || 0) / 1000), // Display in thousands
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      subtitle: `KES ${(stats?.total_revenue || 0).toLocaleString()} (30 days)`,
      link: '/admin/payments/reports',
      trend: growth.revenue_growth ? {
        direction: growth.revenue_growth >= 0 ? 'up' : 'down',
        percentage: Math.abs(growth.revenue_growth),
      } : undefined,
    },
    {
      id: 'pending_verifications',
      title: 'Pending Verifications',
      value: stats?.pending_verifications || 0,
      icon: ShieldCheck,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      subtitle: 'Needs attention',
      link: '/admin/verifications',
    },
    {
      id: 'active_bookings',
      title: 'Active Bookings',
      value: stats?.active_bookings || 0,
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      subtitle: 'Short stays + viewings',
      link: '/admin/bookings/short-stays',
    },
    {
      id: 'open_disputes',
      title: 'Open Disputes',
      value: stats?.open_disputes || 0,
      icon: FileText,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      subtitle: 'Require resolution',
      link: '/admin/disputes',
    },
    {
      id: 'active_auctions',
      title: 'Active Auctions',
      value: stats?.active_auctions || 0,
      icon: Gavel,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/20',
      subtitle: 'Marketplace listings',
      link: '/admin/marketplace/auctions',
    },
    {
      id: 'queue_status',
      title: 'Bid Queue',
      value: stats?.queue_size || 0,
      icon: Clock,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/20',
      subtitle: 'Pending bids',
      link: '/admin/marketplace/queue',
    },
    {
      id: 'system_health',
      title: 'System Health',
      value: stats?.system_uptime || 0,
      icon: Server,
      color: stats?.system_uptime && stats.system_uptime >= 99 ? 'text-green-600' : 'text-yellow-600',
      bgColor: stats?.system_uptime && stats.system_uptime >= 99 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-yellow-100 dark:bg-yellow-900/20',
      subtitle: `${stats?.response_time || 0}ms avg response`,
      link: '/admin/performance',
    },
  ].filter(card => {
    // Filter by widget visibility
    if (!isWidgetVisible(card.id)) return false;
    
    // Filter sensitive cards - only show to super admins
    if (sensitiveCardIds.includes(card.id) && !isSuperAdmin) {
      return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight animate-fade-down">{getGreeting()}</h1>
          <p className="text-lg text-muted-foreground animate-fade-in">
            Here's what's happening with your platform today
          </p>
        </div>
        <Link to="/admin/dashboard-settings">
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Customize Dashboard
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statCards.map((stat, index) => (
          <StatCard key={stat.id} stat={stat} index={index} trend={stat.trend} />
        ))}
      </div>

      {/* Alert Card for Pending Verifications */}
      {stats && stats.pending_verifications > 0 && isWidgetVisible('pending_verifications') && (
        <Card className="relative overflow-hidden border-warning/50 bg-gradient-to-br from-warning/5 via-warning/10 to-warning/5 animate-fade-up shadow-lg">
          {/* Animated Border */}
          <div className="absolute inset-0 bg-gradient-to-r from-warning/20 via-warning/40 to-warning/20 animate-gradient"></div>
          <div className="absolute inset-[1px] bg-card/95 backdrop-blur-sm rounded-[11px]"></div>

          {/* Content */}
          <div className="relative">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-warning/20 animate-pulse-glow">
                  <AlertCircle className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <div className="text-xl font-bold">Attention Required</div>
                  <div className="text-sm font-normal text-muted-foreground mt-0.5">
                    Pending items need your review
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-base">
                  You have{' '}
                  <span className="font-bold text-warning text-lg">
                    {stats.pending_verifications}
                  </span>{' '}
                  pending landlord verification{stats.pending_verifications !== 1 ? 's' : ''}{' '}
                  awaiting review.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click below to review and process them
                </p>
              </div>
              <Link to="/admin/verifications">
                <Button className="bg-gradient-to-r from-warning to-warning/80 hover:from-warning/90 hover:to-warning/70 text-warning-foreground shadow-glow hover:shadow-glow-lg transition-all duration-300 hover:scale-105">
                  Review Now
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Button>
              </Link>
            </CardContent>
          </div>
        </Card>
      )}

      {/* Charts & Visualizations */}
      {isWidgetVisible('charts') && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Analytics & Trends</h2>
              <p className="text-muted-foreground">Visual insights into platform performance</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange.toString()} onValueChange={(v) => setDateRange(Number(v))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 6 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* User Growth Chart - Super Admin Only */}
            {isSuperAdmin && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>User Growth</CardTitle>
                    <CardDescription>New user registrations over time</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => exportChart('user-growth')}>
                    <Download className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData.userGrowth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="users" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Revenue Trends Chart - Super Admin Only */}
            {isSuperAdmin && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Revenue Trends</CardTitle>
                    <CardDescription>Daily revenue from completed payments</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => exportChart('revenue')}>
                    <Download className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData.revenueTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Property Types Distribution */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Property Types</CardTitle>
                  <CardDescription>Distribution of listings by property type</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => exportChart('property-types')}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData.propertyTypes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.propertyTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Performing Properties */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Top Properties</CardTitle>
                  <CardDescription>Most viewed properties</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => exportChart('top-properties')}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.topProperties}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="views" fill="#3b82f6" name="Views" />
                    <Bar dataKey="bookings" fill="#10b981" name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Recent Activity Feed */}
      {isWidgetVisible('activity_feed') && (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <ActivityFeed limit={15} />
        </div>
      )}

      {/* Quick Actions */}
      {isWidgetVisible('quick_actions') && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link to="/admin/verifications">
                <Button
                  variant="outline"
                  className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-orange-600" />
                      <span className="font-medium">Approve Pending Items</span>
                    </div>
                    {stats && stats.pending_verifications > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {stats.pending_verifications}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    Review and approve pending verifications
                  </p>
                </Button>
              </Link>

              <Link to="/admin/listings?filter=flagged">
                <Button
                  variant="outline"
                  className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium">Review Flagged Content</span>
                    </div>
                    {stats && (stats as any).flagged_content > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {(stats as any).flagged_content}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    Review flagged properties and content
                  </p>
                </Button>
              </Link>

              <Link to="/admin/payments/processing">
                <Button
                  variant="outline"
                  className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Process Payments</span>
                    </div>
                    {stats && (stats as any).pending_payments > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {(stats as any).pending_payments}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    Process pending payment transactions
                  </p>
                </Button>
              </Link>

              <Link to="/admin/security-center">
                <Button
                  variant="outline"
                  className="w-full h-auto p-4 flex flex-col items-start gap-2 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <span className="font-medium">View Alerts</span>
                    </div>
                    {stats && (stats as any).security_alerts > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {(stats as any).security_alerts}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    View security alerts and notifications
                  </p>
                </Button>
              </Link>

              <Link to="/admin/reports" className="md:col-span-2 lg:col-span-4">
                <Button
                  variant="outline"
                  className="w-full h-auto p-4 flex items-center justify-between hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div className="text-left">
                      <div className="font-medium">Access Reports</div>
                      <p className="text-xs text-muted-foreground">
                        View and generate detailed reports
                      </p>
                    </div>
                  </div>
                  <svg
                    className="w-4 h-4 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
