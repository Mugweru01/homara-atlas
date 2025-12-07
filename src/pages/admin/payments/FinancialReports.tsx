import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  BarChart3,
  PieChart,
  RefreshCw,
  CreditCard,
  Users,
  Building,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';

interface RevenueData {
  date: string;
  amount: number;
  count: number;
}

interface PaymentTypeStats {
  type: string;
  amount: number;
  count: number;
  percentage: number;
}

interface FinancialStats {
  total_revenue: number;
  today_revenue: number;
  week_revenue: number;
  month_revenue: number;
  year_revenue: number;
  total_transactions: number;
  average_transaction: number;
  growth_rate: number;
}

export default function FinancialReports() {
  const [stats, setStats] = useState<FinancialStats>({
    total_revenue: 0,
    today_revenue: 0,
    week_revenue: 0,
    month_revenue: 0,
    year_revenue: 0,
    total_transactions: 0,
    average_transaction: 0,
    growth_rate: 0,
  });
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [paymentTypeStats, setPaymentTypeStats] = useState<PaymentTypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const fetchFinancialData = async () => {
    try {
      setLoading(true);

      // Fetch all successful transactions from all payment tables
      const [paymentsResult, subscriptionsResult, shortStayResult, rentResult, maintenanceResult, marketplaceResult] = await Promise.all([
        supabase.from('payments').select('amount, created_at, payment_method').in('status', ['completed', 'success']),
        supabase.from('subscription_payments').select('amount, created_at, payment_method').in('status', ['completed', 'success']),
        supabase.from('short_stay_payments').select('amount, created_at, payment_method').in('status', ['completed', 'success']),
        supabase.from('rent_payments').select('amount, created_at, payment_method').in('status', ['completed', 'success']),
        supabase.from('maintenance_payments').select('amount, created_at, payment_method').in('status', ['completed', 'success']),
        supabase.from('marketplace_transactions').select('amount, created_at, payment_method').in('status', ['completed', 'success']),
      ]);

      const allTransactions: Array<{ amount: number; created_at: string; type: string }> = [];

      // Process each result set
      const processResults = (results: any[], type: string) => {
        if (results) {
          results.forEach((t: any) => {
            allTransactions.push({
              amount: t.amount || 0,
              created_at: t.created_at,
              type: type,
            });
          });
        }
      };

      processResults(paymentsResult.data || [], 'payment');
      processResults(subscriptionsResult.data || [], 'subscription');
      processResults(shortStayResult.data || [], 'short_stay');
      processResults(rentResult.data || [], 'rent');
      processResults(maintenanceResult.data || [], 'maintenance');
      processResults(marketplaceResult.data || [], 'marketplace');

      // Calculate stats
      const now = new Date();
      const today = startOfDay(now);
      const weekAgo = subDays(now, 7);
      const monthAgo = subDays(now, 30);
      const yearAgo = subDays(now, 365);

      const todayTransactions = allTransactions.filter(t => new Date(t.created_at) >= today);
      const weekTransactions = allTransactions.filter(t => new Date(t.created_at) >= weekAgo);
      const monthTransactions = allTransactions.filter(t => new Date(t.created_at) >= monthAgo);
      const yearTransactions = allTransactions.filter(t => new Date(t.created_at) >= yearAgo);

      const totalRevenue = allTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const todayRevenue = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const weekRevenue = weekTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const monthRevenue = monthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const yearRevenue = yearTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

      // Calculate growth rate (month over month)
      const previousMonthStart = subDays(monthAgo, 30);
      const previousMonthTransactions = allTransactions.filter(t => {
        const date = new Date(t.created_at);
        return date >= previousMonthStart && date < monthAgo;
      });
      const previousMonthRevenue = previousMonthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const growthRate = previousMonthRevenue > 0 
        ? ((monthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
        : 0;

      setStats({
        total_revenue: totalRevenue,
        today_revenue: todayRevenue,
        week_revenue: weekRevenue,
        month_revenue: monthRevenue,
        year_revenue: yearRevenue,
        total_transactions: allTransactions.length,
        average_transaction: allTransactions.length > 0 ? totalRevenue / allTransactions.length : 0,
        growth_rate: growthRate,
      });

      // Calculate revenue by date for chart
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const startDate = subDays(now, days);
      const periodTransactions = allTransactions.filter(t => new Date(t.created_at) >= startDate);

      const revenueByDate = new Map<string, { amount: number; count: number }>();
      periodTransactions.forEach(t => {
        const date = format(new Date(t.created_at), 'yyyy-MM-dd');
        const existing = revenueByDate.get(date) || { amount: 0, count: 0 };
        revenueByDate.set(date, {
          amount: existing.amount + (t.amount || 0),
          count: existing.count + 1,
        });
      });

      const revenueDataArray: RevenueData[] = Array.from(revenueByDate.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setRevenueData(revenueDataArray);

      // Calculate payment type stats
      const typeStats = new Map<string, { amount: number; count: number }>();
      allTransactions.forEach(t => {
        const existing = typeStats.get(t.type) || { amount: 0, count: 0 };
        typeStats.set(t.type, {
          amount: existing.amount + (t.amount || 0),
          count: existing.count + 1,
        });
      });

      const totalForPercentage = Array.from(typeStats.values()).reduce((sum, s) => sum + s.amount, 0);
      const paymentTypeArray: PaymentTypeStats[] = Array.from(typeStats.entries())
        .map(([type, data]) => ({
          type,
          ...data,
          percentage: totalForPercentage > 0 ? (data.amount / totalForPercentage) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      setPaymentTypeStats(paymentTypeArray);
    } catch (error) {
      logger.error('Error fetching financial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load financial data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, [period]);

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      payment: 'Payment',
      subscription: 'Subscription',
      short_stay: 'Short Stay',
      rent: 'Rent',
      maintenance: 'Maintenance',
      marketplace: 'Marketplace',
    };
    return typeMap[type] || type;
  };

  const exportData = () => {
    const exportData = {
      stats,
      revenueData,
      paymentTypeStats,
      period,
      generated_at: new Date().toISOString(),
    };
    return exportData;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground">
            Revenue analytics, trends, and financial insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v: '7d' | '30d' | '90d' | '1y') => setPeriod(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton
            data={exportData()}
            filename="financial-report"
            label="Export Report"
          />
          <Button onClick={fetchFinancialData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {stats.total_revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {stats.today_revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Revenue today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {stats.month_revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {stats.growth_rate >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              {stats.growth_rate >= 0 ? '+' : ''}{stats.growth_rate.toFixed(1)}% vs last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Transaction</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {stats.average_transaction.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_transactions.toLocaleString()} total transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>
            Revenue over the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : revenueData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No revenue data for this period
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-[300px] flex items-end justify-between gap-1">
                {revenueData.map((data, index) => {
                  const maxAmount = Math.max(...revenueData.map(d => d.amount));
                  const height = maxAmount > 0 ? (data.amount / maxAmount) * 100 : 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                        style={{ height: `${height}%`, minHeight: '4px' }}
                        title={`${format(new Date(data.date), 'MMM dd')}: KES ${data.amount.toLocaleString()}`}
                      />
                      {index % Math.ceil(revenueData.length / 10) === 0 && (
                        <span className="text-xs text-muted-foreground rotate-45 origin-left">
                          {format(new Date(data.date), 'MMM dd')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-sm text-muted-foreground text-center">
                Total: KES {revenueData.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Type Breakdown</CardTitle>
          <CardDescription>
            Revenue distribution by payment type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : paymentTypeStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payment type data available
            </div>
          ) : (
            <div className="space-y-4">
              {paymentTypeStats.map((stat, index) => (
                <div key={stat.type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{
                          backgroundColor: `hsl(${(index * 60) % 360}, 70%, 50%)`,
                        }}
                      />
                      <span className="font-medium">{getTypeLabel(stat.type)}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">KES {stat.amount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        {stat.percentage.toFixed(1)}% • {stat.count} transactions
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

