import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wrench,
  ArrowLeft,
  RefreshCw,
  User,
  Home,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserCheck,
  Calendar,
  Edit,
  Save,
  MessageSquare,
  Image as ImageIcon,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface WorkOrder {
  id: string;
  property_id: string;
  property_title?: string;
  property_address?: string;
  tenant_id?: string;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  landlord_id?: string;
  landlord_name?: string;
  landlord_email?: string;
  service_provider_id?: string;
  service_provider_name?: string;
  service_provider_email?: string;
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
  images?: string[];
  notes?: string;
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'assign' | 'status' | 'cost' | 'close' | 'reopen' | null>(null);
  const [formData, setFormData] = useState({
    service_provider_id: '',
    status: 'pending' as const,
    priority: 'normal' as const,
    estimated_cost: '',
    actual_cost: '',
    notes: '',
  });

  useEffect(() => {
    if (id) {
      fetchWorkOrder();
    }
  }, [id]);

  const fetchWorkOrder = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST301' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setWorkOrder(null);
          return;
        }
        throw error;
      }

      if (data) {
        const order: any = data;
        
        // Fetch related data separately
        const propertyIds = order.property_id ? [order.property_id] : [];
        const profileIds = [
          order.tenant_id,
          order.landlord_id,
          order.service_provider_id,
        ].filter(Boolean);
        
        // Fetch property
        let property = null;
        if (propertyIds.length > 0) {
          try {
            const { data: properties } = await supabase
              .from('properties')
              .select('id, title, location_name')
              .in('id', propertyIds)
              .single();
            property = properties;
          } catch (propError: any) {
            logger.error('Error fetching property:', propError);
          }
        }
        
        // Fetch profiles
        const profilesMap = new Map();
        if (profileIds.length > 0) {
          try {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, email, phone_e164')
              .in('id', profileIds);
            
            if (profiles) {
              profiles.forEach((p: any) => {
                profilesMap.set(p.id, p);
              });
            }
          } catch (profileError: any) {
            logger.error('Error fetching profiles:', profileError);
          }
        }
        
        const tenant = order.tenant_id ? profilesMap.get(order.tenant_id) : null;
        const landlord = order.landlord_id ? profilesMap.get(order.landlord_id) : null;
        const serviceProvider = order.service_provider_id ? profilesMap.get(order.service_provider_id) : null;
        
        setWorkOrder({
          id: order.id,
          property_id: order.property_id,
          property_title: property?.title || 'Unknown Property',
          property_address: property?.location_name || null,
          tenant_id: order.tenant_id,
          tenant_name: tenant?.full_name || null,
          tenant_email: tenant?.email || null,
          tenant_phone: tenant?.phone_e164 || null,
          landlord_id: order.landlord_id,
          landlord_name: landlord?.full_name || null,
          landlord_email: landlord?.email || null,
          service_provider_id: order.service_provider_id,
          service_provider_name: serviceProvider?.full_name || null,
          service_provider_email: serviceProvider?.email || null,
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
          images: order.images || [],
          notes: order.notes || '',
        });

        setFormData({
          service_provider_id: order.service_provider_id || '',
          status: order.status || 'pending',
          priority: order.priority || 'normal',
          estimated_cost: order.estimated_cost?.toString() || '',
          actual_cost: order.actual_cost?.toString() || '',
          notes: order.notes || '',
        });
      }
    } catch (error: any) {
      logger.error('Error fetching work order:', error);
      console.error('Work order fetch error:', error);
      setWorkOrder(null);
      // Don't show error if table doesn't exist
      if (error?.code !== '42P01' && error?.code !== 'PGRST116' && 
          !error?.message?.includes('does not exist') && !error?.message?.includes('schema cache')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch work order',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: 'assign' | 'status' | 'cost' | 'close' | 'reopen') => {
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!workOrder || !actionType) return;

    try {
      let updateData: any = {};

      switch (actionType) {
        case 'assign':
          updateData = {
            service_provider_id: formData.service_provider_id || null,
            updated_at: new Date().toISOString(),
          };
          break;

        case 'status':
          updateData = {
            status: formData.status,
            priority: formData.priority,
            updated_at: new Date().toISOString(),
          };
          if (formData.status === 'completed') {
            updateData.completed_at = new Date().toISOString();
          }
          break;

        case 'cost':
          updateData = {
            estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
            actual_cost: formData.actual_cost ? parseFloat(formData.actual_cost) : null,
            updated_at: new Date().toISOString(),
          };
          break;

        case 'close':
          updateData = {
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          break;

        case 'reopen':
          updateData = {
            status: 'in_progress',
            completed_at: null,
            updated_at: new Date().toISOString(),
          };
          break;
      }

      if (formData.notes) {
        updateData.notes = formData.notes;
      }

      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('id', workOrder.id);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST301' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          toast({
            title: 'Error',
            description: 'Work orders table not found',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'Success',
        description: `Work order ${actionType === 'close' ? 'closed' : actionType === 'reopen' ? 'reopened' : 'updated'}`,
      });

      setActionDialogOpen(false);
      setActionType(null);
      fetchWorkOrder();
    } catch (error: any) {
      logger.error('Error performing action:', error);
      console.error('Action error:', error);
      // Don't show error if table doesn't exist
      if (error?.code !== '42P01' && error?.code !== 'PGRST116' && 
          !error?.message?.includes('does not exist') && !error?.message?.includes('schema cache')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to perform action',
          variant: 'destructive',
        });
      }
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/maintenance/work-orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Work Order Not Found</h1>
            <p className="text-muted-foreground">
              The work order you're looking for doesn't exist
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/maintenance/work-orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{workOrder.title}</h1>
          <p className="text-muted-foreground">
            Work Order #{workOrder.id.substring(0, 8)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(workOrder.status)}
          {getPriorityBadge(workOrder.priority)}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Work Order Info */}
            <Card>
              <CardHeader>
                <CardTitle>Work Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Title</Label>
                  <p className="font-medium">{workOrder.title}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Description</Label>
                  <p className="text-sm whitespace-pre-wrap">{workOrder.description}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Category</Label>
                  <Badge variant="outline">{workOrder.category}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(workOrder.status)}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Priority</Label>
                    <div className="mt-1">{getPriorityBadge(workOrder.priority)}</div>
                  </div>
                </div>
                {workOrder.notes && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Notes</Label>
                    <p className="text-sm whitespace-pre-wrap">{workOrder.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Property Info */}
            <Card>
              <CardHeader>
                <CardTitle>Property Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Property</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{workOrder.property_title}</span>
                  </div>
                  {workOrder.property_address && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {workOrder.property_address}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tenant Info */}
            {workOrder.tenant_name && (
              <Card>
                <CardHeader>
                  <CardTitle>Tenant Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Name</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{workOrder.tenant_name}</span>
                    </div>
                  </div>
                  {workOrder.tenant_email && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Email</Label>
                      <p className="text-sm">{workOrder.tenant_email}</p>
                    </div>
                  )}
                  {workOrder.tenant_phone && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Phone</Label>
                      <p className="text-sm">{workOrder.tenant_phone}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Service Provider Info */}
            <Card>
              <CardHeader>
                <CardTitle>Service Provider</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {workOrder.service_provider_name ? (
                  <>
                    <div>
                      <Label className="text-sm text-muted-foreground">Name</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{workOrder.service_provider_name}</span>
                      </div>
                    </div>
                    {workOrder.service_provider_email && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Email</Label>
                        <p className="text-sm">{workOrder.service_provider_email}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>No service provider assigned</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleAction('assign')}
                    >
                      Assign Provider
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cost Information */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Estimated Cost</Label>
                    <p className="font-medium">
                      {workOrder.estimated_cost
                        ? `KES ${workOrder.estimated_cost.toLocaleString()}`
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Actual Cost</Label>
                    <p className="font-medium">
                      {workOrder.actual_cost
                        ? `KES ${workOrder.actual_cost.toLocaleString()}`
                        : 'Not set'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('cost')}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Update Costs
                </Button>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle>Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Created</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(workOrder.created_at), 'MMM d, yyyy HH:mm')}</span>
                  </div>
                </div>
                {workOrder.due_date && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Due Date</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(workOrder.due_date), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                )}
                {workOrder.completed_at && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Completed</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span>{format(new Date(workOrder.completed_at), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Images */}
          {workOrder.images && workOrder.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Images ({workOrder.images.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {workOrder.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`Work order image ${idx + 1}`}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Work Order Actions</CardTitle>
              <CardDescription>
                Manage work order status, assignment, and costs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={() => handleAction('assign')}
                  disabled={workOrder.status === 'completed'}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  {workOrder.service_provider_name ? 'Reassign Provider' : 'Assign Provider'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction('status')}
                  disabled={workOrder.status === 'completed'}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Update Status
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction('cost')}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Update Costs
                </Button>
                {workOrder.status !== 'completed' ? (
                  <Button
                    variant="default"
                    onClick={() => handleAction('close')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Close Work Order
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleAction('reopen')}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reopen Work Order
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Work Order History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>History tracking coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'assign' && 'Assign Service Provider'}
              {actionType === 'status' && 'Update Status'}
              {actionType === 'cost' && 'Update Costs'}
              {actionType === 'close' && 'Close Work Order'}
              {actionType === 'reopen' && 'Reopen Work Order'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'close' && 'This will mark the work order as completed.'}
              {actionType === 'reopen' && 'This will reopen the work order for further work.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {actionType === 'assign' && (
              <div>
                <Label>Service Provider ID</Label>
                <Input
                  value={formData.service_provider_id}
                  onChange={(e) => setFormData({ ...formData, service_provider_id: e.target.value })}
                  placeholder="Enter service provider user ID"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Note: Service provider lookup will be implemented
                </p>
              </div>
            )}

            {actionType === 'status' && (
              <>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {actionType === 'cost' && (
              <>
                <div>
                  <Label>Estimated Cost (KES)</Label>
                  <Input
                    type="number"
                    value={formData.estimated_cost}
                    onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Actual Cost (KES)</Label>
                  <Input
                    type="number"
                    value={formData.actual_cost}
                    onChange={(e) => setFormData({ ...formData, actual_cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </>
            )}

            {(actionType === 'assign' || actionType === 'status' || actionType === 'cost') && (
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes about this action..."
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAction}>
              {actionType === 'close' && 'Close Work Order'}
              {actionType === 'reopen' && 'Reopen Work Order'}
              {(actionType === 'assign' || actionType === 'status' || actionType === 'cost') && 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

