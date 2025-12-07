import { Outlet, Link, useLocation } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Target, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BusinessIntelligenceLayout() {
  const location = useLocation();

  const getActiveTab = () => {
    if (location.pathname.includes('/executive')) return 'executive';
    if (location.pathname.includes('/customers')) return 'customers';
    return 'financial';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Intelligence</h1>
          <p className="text-muted-foreground">
            Comprehensive business analytics and insights
          </p>
        </div>
      </div>

      <Tabs value={getActiveTab()} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="financial" asChild>
            <Link to="/admin/business-intelligence/financial" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financial
            </Link>
          </TabsTrigger>
          <TabsTrigger value="executive" asChild>
            <Link to="/admin/business-intelligence/executive" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Executive
            </Link>
          </TabsTrigger>
          <TabsTrigger value="customers" asChild>
            <Link to="/admin/business-intelligence/customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customers
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Outlet />
    </div>
  );
}

