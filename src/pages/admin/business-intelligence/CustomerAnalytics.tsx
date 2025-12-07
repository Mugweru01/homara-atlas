import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KPICard } from '@/components/business-intelligence/KPICard';
import {
  Users,
  TrendingDown,
  DollarSign,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { ExportButton } from '@/components/admin/ExportButton';
import {
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

interface CustomerLTV {
  average_ltv: number;
  median_ltv: number;
  total_customers: number;
  segment: string;
  cohort: string;
  ltv_distribution: {
    high_value: number;
    medium_value: number;
    low_value: number;
  };
}

interface ChurnData {
  period_type: string;
  start_date: string;
  end_date: string;
  average_churn_rate: number;
  total_churned: number;
  churn_by_period: Record<string, number>;
  segment: string;
}

export default function CustomerAnalytics() {
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<string>('all');
  const [cohort, setCohort] = useState<string>('all');
  const [ltvData, setLtvData] = useState<CustomerLTV | null>(null);
  const [churnData, setChurnData] = useState<ChurnData | null>(null);

  useEffect(() => {
    fetchCustomerData();
  }, [segment, cohort]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchLTV(), fetchChurn()]);
    } catch (error: any) {
      console.error('Error fetching customer data:', error);
      toast.error('Failed to load customer analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchLTV = async () => {
    const { data, error } = await supabase.rpc('calculate_customer_ltv', {
      p_segment: segment === 'all' ? null : segment,
      p_cohort: cohort === 'all' ? null : cohort,
    });

    if (error) {
      console.error('Error fetching LTV:', error);
      setLtvData({
        average_ltv: 0,
        median_ltv: 0,
        total_customers: 0,
        segment: segment,
        cohort: cohort,
        ltv_distribution: {
          high_value: 0,
          medium_value: 0,
          low_value: 0,
        },
      });
      return;
    }

    if (data) {
      setLtvData(data as CustomerLTV);
    }
  };

  const fetchChurn = async () => {
    const { data, error } = await supabase.rpc('calculate_churn_rate', {
      p_period_type: 'monthly',
      p_start_date: null,
      p_end_date: null,
      p_segment: segment === 'all' ? null : segment,
    });

    if (error) {
      console.error('Error fetching churn:', error);
      setChurnData({
        period_type: 'monthly',
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        average_churn_rate: 0,
        total_churned: 0,
        churn_by_period: {},
        segment: segment,
      });
      return;
    }

    if (data) {
      setChurnData(data as ChurnData);
    }
  };

  const exportData = () => {
    return {
      ltv_data: ltvData,
      churn_data: churnData,
      segment,
      cohort,
      generated_at: new Date().toISOString(),
    };
  };

  const ltvDistributionData = ltvData?.ltv_distribution
    ? [
        {
          name: 'High Value',
          value: ltvData.ltv_distribution.high_value,
          color: '#10b981',
        },
        {
          name: 'Medium Value',
          value: ltvData.ltv_distribution.medium_value,
          color: '#3b82f6',
        },
        {
          name: 'Low Value',
          value: ltvData.ltv_distribution.low_value,
          color: '#f59e0b',
        },
      ]
    : [];

  const churnByPeriodData = churnData?.churn_by_period
    ? Object.entries(churnData.churn_by_period).map(([period, value]) => ({
        period,
        churn: value,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customer Analytics</h2>
          <p className="text-muted-foreground">
            Customer lifetime value, churn analysis, and segmentation insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value="landlords">Landlords</SelectItem>
              <SelectItem value="renters">Renters</SelectItem>
              <SelectItem value="guests">Guests</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton
            data={exportData()}
            filename="customer-analytics"
            label="Export"
          />
          <Button onClick={fetchCustomerData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* LTV KPIs */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Customer Lifetime Value</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Average LTV"
            value={ltvData?.average_ltv || 0}
            subtitle="Per customer"
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="Median LTV"
            value={ltvData?.median_ltv || 0}
            subtitle="Median value"
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="Total Customers"
            value={ltvData?.total_customers || 0}
            subtitle="In segment"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="High Value Customers"
            value={ltvData?.ltv_distribution?.high_value || 0}
            subtitle="Top 20%"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Churn KPIs */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Churn Analysis</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <KPICard
            title="Average Churn Rate"
            value={`${(churnData?.average_churn_rate || 0).toFixed(2)}%`}
            subtitle="Monthly churn"
            icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />}
            status={
              (churnData?.average_churn_rate || 0) < 2
                ? 'excellent'
                : (churnData?.average_churn_rate || 0) < 5
                ? 'on_target'
                : 'warning'
            }
          />
          <KPICard
            title="Total Churned"
            value={churnData?.total_churned || 0}
            subtitle="Customers lost"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
          <KPICard
            title="Segment"
            value={churnData?.segment || 'all'}
            subtitle="Current segment"
            icon={<UserPlus className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>LTV Distribution</CardTitle>
            <CardDescription>Customer value segmentation</CardDescription>
          </CardHeader>
          <CardContent>
            {ltvDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={ltvDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {ltvDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No LTV distribution data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Churn by Period</CardTitle>
            <CardDescription>Monthly churn trends</CardDescription>
          </CardHeader>
          <CardContent>
            {churnByPeriodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={churnByPeriodData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="churn" fill="#ef4444" name="Churned Customers" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No churn data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

