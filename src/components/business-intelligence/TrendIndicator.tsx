import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendIndicatorProps {
  value: number;
  label?: string;
  showArrow?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TrendIndicator({
  value,
  label,
  showArrow = true,
  size = 'md',
  className,
}: TrendIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  const sizeClasses = {
    sm: 'h-3 w-3 text-xs',
    md: 'h-4 w-4 text-sm',
    lg: 'h-5 w-5 text-base',
  };

  const Icon = showArrow
    ? isPositive
      ? ArrowUpRight
      : isNegative
      ? ArrowDownRight
      : Minus
    : isPositive
    ? TrendingUp
    : isNegative
    ? TrendingDown
    : Minus;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Icon
        className={cn(
          sizeClasses[size],
          isPositive && 'text-green-600',
          isNegative && 'text-red-600',
          isNeutral && 'text-gray-600'
        )}
      />
      <span
        className={cn(
          'font-medium',
          sizeClasses[size],
          isPositive && 'text-green-600',
          isNegative && 'text-red-600',
          isNeutral && 'text-gray-600'
        )}
      >
        {isPositive ? '+' : ''}
        {value.toFixed(1)}%
      </span>
      {label && (
        <span className={cn('text-muted-foreground', sizeClasses[size])}>
          {label}
        </span>
      )}
    </div>
  );
}

