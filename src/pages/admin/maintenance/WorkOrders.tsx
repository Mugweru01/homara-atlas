import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Wrench,
  Search,
  RefreshCw,
  Eye,
  User,
  Home,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserCheck,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Link } from 'react-router-dom';

interface WorkOrder {
  id: string;
  property_id: string;
  property_title?: string;
  tenant_id?: string;
  tenant_name?: string;
  landlord_id?: string;
  landlord_name?: string;
  service_provider_id?: string;
  service_provider_name?: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  estimated_cost?: number;
  actual_cost?: number;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at?: string;
}

export default function WorkOrders() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    fetchWorkOrders();
    const interval = setInterval(fetchWorkOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      
      // Fetch work orders - use select('*') to avoid relationship issues
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        // Handle missing table gracefully
        if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST301' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setWorkOrders([]);
          return;
        }
        throw error;
      }

      let orders = data || [];
      
      // Fetch related data separately
      if (orders.length > 0) {
        const propertyIds = [...new Set(orders.map((o: any) => o.property_id).filter(Boolean))];
        const tenantIds = [...new Set(orders.map((o: any) => o.tenant_id).filter(Boolean))];
        const landlordIds = [...new Set(orders.map((o: any) => o.landlord_id).filter(Boolean))];
        const serviceProviderIds = [...new Set(orders.map((o: any) => o.service_provider_id).filter(Boolean))];
        
        // Fetch properties
        const propertiesMap = new Map();
        if (propertyIds.length > 0) {
          try {
            const { data: properties } = await supabase
              .from('properties')
              .select('id, title, location_name')
              .in('id', propertyIds);
            
            if (properties) {
              properties.forEach((p: any) => {
                propertiesMap.set(p.id, p);
              });
            }
          } catch (propError: any) {
            logger.error('Error fetching properties:', propError);
          }
        }
        
        // Fetch profiles (tenants, landlords, service providers)
        const allProfileIds = [...new Set([...tenantIds, ...landlordIds, ...serviceProviderIds])];
        const profilesMap = new Map();
        if (allProfileIds.length > 0) {
          try {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', allProfileIds);
            
            if (profiles) {
              profiles.forEach((p: any) => {
                profilesMap.set(p.id, p.full_name);
              });
            }
          } catch (profileError: any) {
            logger.error('Error fetching profiles:', profileError);
          }
        }
        
        // Merge all data
        orders = orders.map((order: any) => {
          const property = propertiesMap.get(order.property_id);
          return {
            id: order.id,
            property_id: order.property_id,
            property_title: property?.title || 'Unknown Property',
            tenant_id: order.tenant_id,
            tenant_name: order.tenant_id ? profilesMap.get(order.tenant_id) || null : null,
            landlord_id: order.landlord_id,
            landlord_name: order.landlord_id ? profilesMap.get(order.landlord_id) || null : null,
            service_provider_id: order.service_provider_id,
            service_provider_name: order.service_provider_id ? profilesMap.get(order.service_provider_id) || null : null,
            title: order.title || 'Untitled Work Order',
            description: order.description || '',
            category: order.category || 'general',
            priority: order.priority || 'normal',
            status: order.status || 'pending',
            estimated_cost: order.estimated_cost,
            actual_cost: order.actual_cost,
            due_date: order.due_date,
            completed_at: order.completed_at,
            created_at: order.created_at,
            updated_at: order.updated_at,
          };
        });
      }

      setWorkOrders(orders);
    } catch (error: any) {
      logger.error('Error fetching work orders:', error);
      console.error('Work orders fetch error:', error);
      setWorkOrders([]);
      // Don't show error if table doesn't exist yet
      if (error?.code !== '42P01' && error?.code !== 'PGRST116' && 
          !error?.message?.includes('does not exist') && !error?.message?.includes('schema cache')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch work orders',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = workOrders.filter(order => {
    const matchesSearch = search === '' || 
      order.title.toLowerCase().includes(search.toLowerCase()) ||
      order.description.toLowerCase().includes(search.toLowerCase()) ||
      order.property_title?.toLowerCase().includes(search.toLowerCase()) ||
      order.tenant_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || order.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    total: workOrders.length,
    pending: workOrders.filter(o => o.status === 'pending').length,
    inProgress: workOrders.filter(o => o.status === 'in_progress').length,
    completed: workOrders.filter(o => o.status === 'completed').length,
    cancelled: workOrders.filter(o => o.status === 'cancelled').length,
    urgent: workOrders.filter(o => o.priority === 'urgent').length,
    totalCost: workOrders
      .filter(o => o.actual_cost)
      .reduce((sum, o) => sum + (o.actual_cost || 0), 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="default">In Progress</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning">High</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">Normal</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Work Orders</h1>
          <p className="text-muted-foreground">
            Manage maintenance work orders and requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchWorkOrders} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Link to="/admin/maintenance/analytics">
            <Button variant="outline">
              Analytics
            </Button>
          </Link>
          <ExportButton data={filteredOrders} filename="work-orders" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.urgent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {stats.totalCost.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search work orders, properties, or tenants..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Work Orders ({filteredOrders.length})</CardTitle>
          <CardDescription>
            All maintenance work orders and requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : workOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No work orders found</p>
              <p className="text-sm mt-2">
                Work orders will appear here once the database tables are created
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Service Provider</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <div className="font-medium truncate">{order.title}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {order.description.substring(0, 50)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <span className="max-w-xs truncate">{order.property_title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.tenant_name ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{order.tenant_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.service_provider_name ? (
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                            <span>{order.service_provider_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        {order.actual_cost ? (
                          <span className="font-medium">KES {order.actual_cost.toLocaleString()}</span>
                        ) : order.estimated_cost ? (
                          <span className="text-muted-foreground">
                            ~KES {order.estimated_cost.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.due_date ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(order.due_date), 'MMM d, yyyy')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No due date</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(order.created_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/admin/maintenance/work-orders/${order.id}`}>
                          <Button variant="ghost" size="icon" title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

