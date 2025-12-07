import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/business-intelligence/KPICard';
import { TrendIndicator } from '@/components/business-intelligence/TrendIndicator';
import {
  DollarSign,
  Users,
  TrendingUp,
  Home,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { ExportButton } from '@/components/admin/ExportButton';

interface ExecutiveKPIs {
  financial: {
    total_revenue: number;
    revenue_growth: number;
    profit_margin: number;
    arpu: number;
  };
  customers: {
    total_customers: number;
    new_customers: number;
    churn_rate: number;
    ltv: number;
  };
  operational: {
    active_listings: number;
    bookings: number;
    occupancy_rate: number;
  };
  period_type: string;
  periods: number;
  generated_at: string;
}

interface KPIStatus {
  kpi_code: string;
  kpi_name: string;
  current_value: number;
  target_value: number;
  status: 'on_target' | 'warning' | 'critical' | 'excellent';
  period_start: string;
  period_end: string;
}

export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<ExecutiveKPIs | null>(null);
  const [kpiStatuses, setKpiStatuses] = useState<KPIStatus[]>([]);

  useEffect(() => {
    fetchExecutiveData();
  }, []);

  const fetchExecutiveData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchExecutiveKPIs(), fetchKPIStatuses()]);
    } catch (error: any) {
      console.error('Error fetching executive data:', error);
      toast.error('Failed to load executive dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutiveKPIs = async () => {
    const { data, error } = await supabase.rpc('get_executive_dashboard', {
      p_period_type: 'monthly',
      p_periods: 12,
    });

    if (error) {
      console.error('Error fetching executive KPIs:', error);
      // Set default values if function doesn't exist
      setKpis({
        financial: {
          total_revenue: 0,
          revenue_growth: 0,
          profit_margin: 0,
          arpu: 0,
        },
        customers: {
          total_customers: 0,
          new_customers: 0,
          churn_rate: 0,
          ltv: 0,
        },
        operational: {
          active_listings: 0,
          bookings: 0,
          occupancy_rate: 0,
        },
        period_type: 'monthly',
        periods: 12,
        generated_at: new Date().toISOString(),
      });
      return;
    }

    if (data) {
      setKpis(data as ExecutiveKPIs);
    }
  };

  const fetchKPIStatuses = async () => {
    const { data, error } = await supabase.rpc('get_kpi_status', {
      p_kpi_codes: null,
    });

    if (error) {
      console.error('Error fetching KPI statuses:', error);
      setKpiStatuses([]);
      return;
    }

    if (data) {
      setKpiStatuses(data as KPIStatus[]);
    }
  };

  const exportData = () => {
    return {
      executive_kpis: kpis,
      kpi_statuses: kpiStatuses,
      generated_at: new Date().toISOString(),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Executive Dashboard</h2>
          <p className="text-muted-foreground">
            High-level business KPIs and strategic insights for leadership
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={exportData()}
            filename="executive-dashboard"
            label="Export"
          />
          <Button onClick={fetchExecutiveData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Financial Performance</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Revenue"
            value={kpis?.financial?.total_revenue || 0}
            subtitle="All revenue streams"
            trend={{
              value: kpis?.financial?.revenue_growth || 0,
              label: 'growth rate',
              isPositive: (kpis?.financial?.revenue_growth || 0) > 0,
            }}
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
            status={
              (kpis?.financial?.revenue_growth || 0) > 10
                ? 'excellent'
                : (kpis?.financial?.revenue_growth || 0) > 0
                ? 'on_target'
                : 'warning'
            }
          />
          <KPICard
            title="Revenue Growth"
            value={`${(kpis?.financial?.revenue_growth || 0).toFixed(1)}%`}
            subtitle="Period over period"
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
            status={
              (kpis?.financial?.revenue_growth || 0) > 10
                ? 'excellent'
                : (kpis?.financial?.revenue_growth || 0) > 0
                ? 'on_target'
                : 'warning'
            }
          />
          <KPICard
            title="Profit Margin"
            value={`${(kpis?.financial?.profit_margin || 0).toFixed(1)}%`}
            subtitle="Net profit margin"
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="ARPU"
            value={kpis?.financial?.arpu || 0}
            subtitle="Average Revenue Per User"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Customer KPIs */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Customer Metrics</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Customers"
            value={kpis?.customers?.total_customers || 0}
            subtitle="All active customers"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="New Customers"
            value={kpis?.customers?.new_customers || 0}
            subtitle="This period"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="Churn Rate"
            value={`${(kpis?.customers?.churn_rate || 0).toFixed(2)}%`}
            subtitle="Customer churn"
            icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
            status={
              (kpis?.customers?.churn_rate || 0) < 2
                ? 'excellent'
                : (kpis?.customers?.churn_rate || 0) < 5
                ? 'on_target'
                : 'warning'
            }
          />
          <KPICard
            title="Customer LTV"
            value={kpis?.customers?.ltv || 0}
            subtitle="Lifetime Value"
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Operational KPIs */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Operational Metrics</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <KPICard
            title="Active Listings"
            value={kpis?.operational?.active_listings || 0}
            subtitle="Properties on platform"
            icon={<Home className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="Bookings"
            value={kpis?.operational?.bookings || 0}
            subtitle="Total bookings"
            icon={<Home className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="Occupancy Rate"
            value={`${(kpis?.operational?.occupancy_rate || 0).toFixed(1)}%`}
            subtitle="Property occupancy"
            icon={<Home className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* KPI Status Table */}
      {kpiStatuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>KPI Status Overview</CardTitle>
            <CardDescription>Current status of all defined KPIs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">KPI</th>
                    <th className="text-right p-2">Current Value</th>
                    <th className="text-right p-2">Target</th>
                    <th className="text-center p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiStatuses.map((kpi) => (
                    <tr key={kpi.kpi_code} className="border-b">
                      <td className="p-2 font-medium">{kpi.kpi_name}</td>
                      <td className="text-right p-2">{kpi.current_value.toLocaleString()}</td>
                      <td className="text-right p-2 text-muted-foreground">
                        {kpi.target_value?.toLocaleString() || 'N/A'}
                      </td>
                      <td className="text-center p-2">
                        {kpi.status === 'excellent' && (
                          <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                        )}
                        {kpi.status === 'on_target' && (
                          <CheckCircle2 className="h-5 w-5 text-blue-600 mx-auto" />
                        )}
                        {kpi.status === 'warning' && (
                          <AlertTriangle className="h-5 w-5 text-yellow-600 mx-auto" />
                        )}
                        {kpi.status === 'critical' && (
                          <AlertTriangle className="h-5 w-5 text-red-600 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

