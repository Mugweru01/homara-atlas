import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Home, ShieldCheck, AlertCircle, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface DashboardStats {
  total_users: number;
  total_landlords: number;
  total_properties: number;
  active_properties: number;
  pending_verifications: number;
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

// Individual stat card component with count-up animation
function StatCard({ stat, index }: { stat: any; index: number }) {
  const animatedValue = useCountUp(stat.value, 1200);
  const Icon = stat.icon;

  return (
    <Card 
      className="group relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02] animate-fade-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Gradient Border Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-2xl transform translate-x-8 -translate-y-8"></div>
      
      <CardHeader className="relative flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
          {stat.title}
        </CardTitle>
        <div className={`rounded-xl p-2.5 ${stat.bgColor} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`h-5 w-5 ${stat.color}`} />
        </div>
      </CardHeader>
      
      <CardContent className="relative">
        <div className="flex items-baseline gap-3">
          <div className="text-4xl font-bold tracking-tight">
            {animatedValue.toLocaleString()}
          </div>
          {stat.trend && (
            <div className={`flex items-center gap-1 text-sm font-medium ${stat.trend > 0 ? 'text-success' : 'text-destructive'}`}>
              {stat.trend > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>{Math.abs(stat.trend)}%</span>
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

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch dashboard stats using the existing function
      const { data, error } = await supabase.rpc('get_dashboard_stats');

      if (error) throw error;

      if (data && typeof data === 'object') {
        setStats(data as unknown as DashboardStats);
      }
    } catch (error) {
      logger.error('Error fetching dashboard stats', { error });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-10 w-64 bg-muted/50 rounded-lg animate-shimmer"></div>
          <div className="h-5 w-48 bg-muted/30 rounded animate-shimmer"></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-muted/20 rounded-xl animate-shimmer" style={{ animationDelay: `${i * 100}ms` }}></div>
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

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.total_users || 0,
      icon: Users,
      color: 'text-info',
      bgColor: 'bg-info/10',
      trend: 12,
      subtitle: 'vs last month',
    },
    {
      title: 'Landlords',
      value: stats?.total_landlords || 0,
      icon: Users,
      color: 'text-success',
      bgColor: 'bg-success/10',
      trend: 8,
      subtitle: 'vs last month',
    },
    {
      title: 'Active Properties',
      value: stats?.active_properties || 0,
      icon: Home,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      trend: -3,
      subtitle: 'vs last month',
    },
    {
      title: 'Pending Verifications',
      value: stats?.pending_verifications || 0,
      icon: ShieldCheck,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      subtitle: 'Needs attention',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight animate-fade-down">
          {getGreeting()}
        </h1>
        <p className="text-lg text-muted-foreground animate-fade-in">
          Here's what's happening with your platform today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <StatCard key={stat.title} stat={stat} index={index} />
        ))}
      </div>

      {/* Alert Card for Pending Verifications */}
      {stats && stats.pending_verifications > 0 && (
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
                  You have <span className="font-bold text-warning text-lg">{stats.pending_verifications}</span> pending landlord verification{stats.pending_verifications !== 1 ? 's' : ''} awaiting review.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click below to review and process them
                </p>
              </div>
              <Link to="/admin/verifications">
                <Button 
                  className="bg-gradient-to-r from-warning to-warning/80 hover:from-warning/90 hover:to-warning/70 text-warning-foreground shadow-glow hover:shadow-glow-lg transition-all duration-300 hover:scale-105"
                >
                  Review Now
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
              </Link>
            </CardContent>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[
          { title: 'Manage Users', desc: 'View and manage all platform users', icon: Users, link: '/admin/users', color: 'info' },
          { title: 'Review Listings', desc: 'Approve or reject property listings', icon: Home, link: '/admin/listings', color: 'primary' },
          { title: 'Verifications', desc: 'Process landlord verification requests', icon: ShieldCheck, link: '/admin/verifications', color: 'warning' },
        ].map((action, index) => (
          <Link 
            key={action.title}
            to={action.link}
            className="group"
          >
            <Card className="h-full border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer animate-fade-up"
              style={{ animationDelay: `${(index + 4) * 100}ms` }}
            >
              <CardHeader>
                <div className={`inline-flex p-3 rounded-xl bg-${action.color}/10 w-fit mb-2 group-hover:scale-110 transition-transform duration-300`}>
                  <action.icon className={`h-6 w-6 text-${action.color}`} />
                </div>
                <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
                  {action.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {action.desc}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-primary group-hover:gap-2 transition-all">
                  <span>Go to page</span>
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

