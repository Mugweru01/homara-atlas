import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface RevenueChartProps {
  data: Array<{
    period_start: string;
    period_end: string;
    total_revenue: number;
    transaction_count?: number;
    average_transaction?: number;
  }>;
  type?: 'line' | 'area' | 'bar';
  title?: string;
  description?: string;
  height?: number;
  showComparison?: boolean;
  comparisonData?: Array<{
    period_start: string;
    total_revenue: number;
  }>;
}

export function RevenueChart({
  data,
  type = 'area',
  title = 'Revenue Trend',
  description = 'Revenue over time',
  height = 300,
  showComparison = false,
  comparisonData,
}: RevenueChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    date: format(new Date(item.period_start), 'MMM dd'),
    month: format(new Date(item.period_start), 'MMM yyyy'),
  }));

  const ChartComponent = type === 'line' ? LineChart : type === 'bar' ? BarChart : AreaChart;
  const renderSeries = (comparison = false) => {
    const props = {
      dataKey: comparison ? 'previous_revenue' : 'total_revenue',
      stroke: comparison ? '#94a3b8' : '#3b82f6',
      fill: comparison ? '#94a3b8' : '#3b82f6',
      name: comparison ? 'Previous Period' : 'Revenue',
    };
    if (type === 'bar') return <Bar {...props} />;
    if (type === 'line') return <Line {...props} type="monotone" />;
    return <Area {...props} type="monotone" fillOpacity={comparison ? 0.3 : 0.6} />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <ChartComponent data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={data.length > 30 ? 'month' : 'date'}
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `KES ${(value / 1000).toFixed(1)}K`;
                  return `KES ${value}`;
                }}
              />
              <Tooltip
                formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                labelFormatter={(label) => `Period: ${label}`}
              />
              <Legend />
              {renderSeries()}
              {showComparison && comparisonData && renderSeries(true)}
            </ChartComponent>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
