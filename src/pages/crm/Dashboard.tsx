import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Contact,
  Target,
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';

export default function CrmDashboard() {
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalLeads: 0,
    totalActivities: 0,
    activeLeads: 0,
    pipelineValue: 0,
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch contacts count
      const { count: contactsCount } = await supabase
        .from('crm_contacts')
        .select('*', { count: 'exact', head: true });

      // Fetch leads count and stats
      const { data: leadsStats } = await supabase.rpc('get_lead_pipeline_stats' as any);

      // Fetch activities count
      const { count: activitiesCount } = await supabase
        .from('crm_activities')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalContacts: contactsCount || 0,
        totalLeads: leadsStats?.total_leads || 0,
        totalActivities: activitiesCount || 0,
        activeLeads: leadsStats?.qualified_leads || 0,
        pipelineValue: leadsStats?.total_pipeline_value || 0,
        conversionRate: leadsStats?.conversion_rate || 0,
      });
    } catch (error) {
      console.error('Error fetching CRM stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickLinks = [
    {
      title: 'Contacts',
      description: 'Manage all your contacts',
      href: '/crm/contacts',
      icon: Contact,
      color: 'bg-blue-500',
    },
    {
      title: 'Leads',
      description: 'Track your sales pipeline',
      href: '/crm/leads',
      icon: Target,
      color: 'bg-green-500',
    },
    {
      title: 'Activities',
      description: 'View all interactions',
      href: '/crm/activities',
      icon: Activity,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CRM Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your Customer Relationship Management system
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Contact className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All contacts in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Leads in pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActivities.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All tracked activities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeLeads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Qualified leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KSh {stats.pipelineValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Expected revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.conversionRate?.toFixed(1) || '0'}%
            </div>
            <p className="text-xs text-muted-foreground">Leads converted</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Access</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Card key={link.href} className="hover:shadow-lg transition-shadow cursor-pointer">
                <Link to={link.href}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${link.color} text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{link.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{link.description}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                </Link>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

