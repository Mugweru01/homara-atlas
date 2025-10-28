import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import {
  Users, Home, ShieldCheck, TrendingUp, TrendingDown, Activity,
  Eye, Heart, DollarSign, Award
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardOverview {
  total_users: number;
  total_landlords: number;
  total_renters: number;
  total_verifications: number;
  pending_verifications: number;
  approved_verifications: number;
  total_listings: number;
  active_listings: number;
  total_flags: number;
  pending_flags: number;
  users_today: number;
  users_this_week: number;
  users_this_month: number;
  verifications_today: number;
  verifications_this_week: number;
  verifications_this_month: number;
}

export default function Analytics() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [verificationTrends, setVerificationTrends] = useState<any[]>([]);
  const [trustScoreData, setTrustScoreData] = useState<any[]>([]);
  const [listingStats, setListingStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    fetchAllData();
  }, [timeRange]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchOverview(),
        fetchUserGrowth(),
        fetchVerificationTrends(),
        fetchTrustScoreDistribution(),
        fetchListingStatistics(),
      ]);
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOverview = async () => {
    const { data, error } = await supabase.rpc('get_dashboard_overview');
    if (error) throw error;
    if (data && data.length > 0) {
      setOverview(data[0]);
    }
  };

  const fetchUserGrowth = async () => {
    const { data, error } = await supabase.rpc('get_user_growth', { p_days: timeRange });
    if (error) throw error;
    setUserGrowth(data || []);
  };

  const fetchVerificationTrends = async () => {
    const { data, error } = await supabase.rpc('get_verification_trends', { p_days: timeRange });
    if (error) throw error;
    setVerificationTrends(data || []);
  };

  const fetchTrustScoreDistribution = async () => {
    const { data, error } = await supabase.rpc('get_trust_score_distribution');
    if (error) throw error;
    setTrustScoreData(data || []);
  };

  const fetchListingStatistics = async () => {
    const { data, error } = await supabase.rpc('get_listing_statistics');
    if (error) throw error;
    if (data && data.length > 0) {
      setListingStats(data[0]);
    }
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

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
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Insights and trends across your platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview?.total_users || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +{overview?.users_this_month || 0} this month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Verifications</CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview?.total_verifications || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {overview?.pending_verifications || 0} pending
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Listings</CardTitle>
                <Home className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview?.total_listings || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {overview?.active_listings || 0} active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Price</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  Ksh {listingStats?.avg_price?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {listingStats?.total_views || 0} total views
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Verification Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Verification Trends</CardTitle>
              <CardDescription>Daily verification submissions and approvals</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={verificationTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="submitted" stroke="#3b82f6" name="Submitted" />
                  <Line type="monotone" dataKey="approved" stroke="#10b981" name="Approved" />
                  <Line type="monotone" dataKey="rejected" stroke="#ef4444" name="Rejected" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Trust Score Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Trust Score Distribution</CardTitle>
              <CardDescription>Distribution of verification trust scores</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trustScoreData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="score_range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Growth</CardTitle>
              <CardDescription>New user registrations over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={userGrowth}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="new_users" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUsers)" name="New Users" />
                  <Line type="monotone" dataKey="landlords" stroke="#10b981" name="Landlords" />
                  <Line type="monotone" dataKey="renters" stroke="#f59e0b" name="Renters" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Types</CardTitle>
                <CardDescription>Distribution by role</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Landlords', value: overview?.total_landlords || 0 },
                        { name: 'Renters', value: overview?.total_renters || 0 },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[0, 1].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Growth</CardTitle>
                <CardDescription>User acquisition metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Today</span>
                  <span className="text-2xl font-bold">{overview?.users_today || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">This Week</span>
                  <span className="text-2xl font-bold">{overview?.users_this_week || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">This Month</span>
                  <span className="text-2xl font-bold">{overview?.users_this_month || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Listings Tab */}
        <TabsContent value="listings" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
                <Home className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{listingStats?.total_listings || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{listingStats?.total_views || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Saves</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{listingStats?.total_saves || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Listings by Type</CardTitle>
              <CardDescription>Property type distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={listingStats?.listings_by_type ? 
                      Object.entries(listingStats.listings_by_type).map(([key, value]) => ({
                        name: key,
                        value: value
                      })) : []
                    }
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(listingStats?.listings_by_type ? Object.keys(listingStats.listings_by_type) : []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

