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
import { RevenueChart } from '@/components/business-intelligence/RevenueChart';
import { TrendIndicator } from '@/components/business-intelligence/TrendIndicator';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Building,
  RefreshCw,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { ExportButton } from '@/components/admin/ExportButton';

interface RevenueMetrics {
  total_revenue: number;
  transaction_count: number;
  average_transaction: number;
  revenue_by_product: Record<string, number>;
  revenue_by_location: Record<string, number>;
  period_type: string;
  start_date: string;
  end_date: string;
}

interface RevenueTrend {
  period_start: string;
  period_end: string;
  revenue: number;
  growth_rate: number;
  moving_average: number;
}

export default function FinancialDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);
  const [revenueTrends, setRevenueTrends] = useState<RevenueTrend[]>([]);
  const [revenueByPeriod, setRevenueByPeriod] = useState<any[]>([]);

  useEffect(() => {
    fetchFinancialData();
  }, [period]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRevenueMetrics(),
        fetchRevenueTrends(),
        fetchRevenueByPeriod(),
      ]);
    } catch (error: any) {
      console.error('Error fetching financial data:', error);
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueMetrics = async () => {
    const { data, error } = await supabase.rpc('calculate_revenue_metrics', {
      p_period_type: period,
      p_start_date: null,
      p_end_date: null,
    });

    if (error) {
      console.error('Error fetching revenue metrics:', error);
      // If function doesn't exist yet, set default values
      setRevenueMetrics({
        total_revenue: 0,
        transaction_count: 0,
        average_transaction: 0,
        revenue_by_product: {},
        revenue_by_location: {},
        period_type: period,
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
      });
      return;
    }

    if (data) {
      setRevenueMetrics(data as RevenueMetrics);
    }
  };

  const fetchRevenueTrends = async () => {
    const { data, error } = await supabase.rpc('get_revenue_trends', {
      p_periods: period === 'monthly' ? 12 : period === 'weekly' ? 12 : 30,
      p_period_type: period,
    });

    if (error) {
      console.error('Error fetching revenue trends:', error);
      setRevenueTrends([]);
      return;
    }

    if (data) {
      setRevenueTrends(data as RevenueTrend[]);
    }
  };

  const fetchRevenueByPeriod = async () => {
    const { data, error } = await supabase.rpc('get_revenue_by_period', {
      p_period_type: period,
      p_start_date: null,
      p_end_date: null,
      p_dimensions: null,
    });

    if (error) {
      console.error('Error fetching revenue by period:', error);
      setRevenueByPeriod([]);
      return;
    }

    if (data) {
      setRevenueByPeriod(data);
    }
  };

  const calculateGrowthRate = (): number => {
    if (revenueTrends.length < 2) return 0;
    const current = revenueTrends[revenueTrends.length - 1];
    const previous = revenueTrends[revenueTrends.length - 2];
    return current.growth_rate || 0;
  };

  const exportData = () => {
    return {
      revenue_metrics: revenueMetrics,
      revenue_trends: revenueTrends,
      revenue_by_period: revenueByPeriod,
      period,
      generated_at: new Date().toISOString(),
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Financial Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive revenue analytics and financial insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={period}
            onValueChange={(v: any) => setPeriod(v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton
            data={exportData()}
            filename="financial-dashboard"
            label="Export"
          />
          <Button onClick={fetchFinancialData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={revenueMetrics?.total_revenue || 0}
          subtitle={`${revenueMetrics?.transaction_count || 0} transactions`}
          trend={{
            value: calculateGrowthRate(),
            label: 'vs previous period',
            isPositive: calculateGrowthRate() > 0,
          }}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <KPICard
          title="Average Transaction"
          value={revenueMetrics?.average_transaction || 0}
          subtitle="Per transaction"
          icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
        />
        <KPICard
          title="Revenue Growth"
          value={`${calculateGrowthRate().toFixed(1)}%`}
          subtitle="Period over period"
          trend={{
            value: calculateGrowthRate(),
            label: 'growth rate',
            isPositive: calculateGrowthRate() > 0,
          }}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          status={
            calculateGrowthRate() > 10
              ? 'excellent'
              : calculateGrowthRate() > 0
              ? 'on_target'
              : calculateGrowthRate() < -5
              ? 'critical'
              : 'warning'
          }
        />
        <KPICard
          title="Transaction Count"
          value={revenueMetrics?.transaction_count || 0}
          subtitle="Total transactions"
          icon={<Building className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Revenue Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart
          data={revenueByPeriod.map((item) => ({
            period_start: item.period_start,
            period_end: item.period_end,
            total_revenue: item.total_revenue || 0,
            transaction_count: item.transaction_count || 0,
            average_transaction: item.average_transaction || 0,
          }))}
          type="area"
          title="Revenue Trend"
          description={`Revenue over time (${period})`}
          height={300}
        />
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Product</CardTitle>
            <CardDescription>Revenue breakdown by product/service</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueMetrics?.revenue_by_product &&
            Object.keys(revenueMetrics.revenue_by_product).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(revenueMetrics.revenue_by_product).map(([product, revenue]) => (
                  <div key={product} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{product}</span>
                      <span className="font-bold">
                        KES {Number(revenue).toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{
                          width: `${
                            revenueMetrics.total_revenue > 0
                              ? (Number(revenue) / revenueMetrics.total_revenue) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No product data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trends Table */}
      {revenueTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
            <CardDescription>Detailed revenue trends with growth rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Period</th>
                    <th className="text-right p-2">Revenue</th>
                    <th className="text-right p-2">Growth Rate</th>
                    <th className="text-right p-2">Moving Average</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueTrends.slice(-12).map((trend, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">
                        {new Date(trend.period_start).toLocaleDateString()}
                      </td>
                      <td className="text-right p-2 font-medium">
                        KES {trend.revenue.toLocaleString()}
                      </td>
                      <td className="text-right p-2">
                        <TrendIndicator value={trend.growth_rate} />
                      </td>
                      <td className="text-right p-2 text-muted-foreground">
                        KES {trend.moving_average.toLocaleString()}
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

