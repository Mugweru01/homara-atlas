import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  status?: 'on_target' | 'warning' | 'critical' | 'excellent';
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  status,
  icon,
  className,
}: KPICardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `KES ${(val / 1000000).toFixed(2)}M`;
      } else if (val >= 1000) {
        return `KES ${(val / 1000).toFixed(2)}K`;
      }
      return `KES ${val.toLocaleString()}`;
    }
    return val;
  };

  const getStatusColor = () => {
    switch (status) {
      case 'excellent':
        return 'border-green-500 bg-green-50 dark:bg-green-950';
      case 'on_target':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-950';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'excellent':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <Card className={cn('relative', getStatusColor(), className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {status && getStatusIcon()}
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.value > 0 ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : trend.value < 0 ? (
              <TrendingDown className="h-3 w-3 text-red-600" />
            ) : (
              <Minus className="h-3 w-3 text-gray-600" />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                trend.value > 0
                  ? 'text-green-600'
                  : trend.value < 0
                  ? 'text-red-600'
                  : 'text-gray-600'
              )}
            >
              {trend.value > 0 ? '+' : ''}
              {trend.value.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

