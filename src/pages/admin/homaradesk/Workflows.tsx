import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Edit,
  Trash,
  Workflow,
  RefreshCw,
  MoreVertical,
  Search,
  Play,
  Pause,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { format } from 'date-fns';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions } from '@/hooks/usePermissions';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger_type: string;
  trigger_conditions?: any;
  actions: any[];
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export default function Workflows() {
  const { user } = useAdmin();
  const permissions = usePermissions();
  
  // Workflows are Senior+ only - redirect if not authorized
  if (!permissions.canViewWorkflows) {
    return null; // ProtectedRoute will handle redirect
  }
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_type: 'ticket_created',
    trigger_conditions: {} as any,
    actions: [] as any[],
    is_active: true,
    priority: 0,
  });

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_workflows')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setWorkflows([]);
          return;
        }
        throw error;
      }

      setWorkflows(data || []);
    } catch (error: any) {
      logger.error('Error fetching workflows:', error);
      toast.error('Error', {
        description: error.message || 'Failed to fetch workflows',
      });
    } finally {
      setLoading(false);
    }
  };

  const addAction = () => {
    setForm((prev) => ({
      ...prev,
      actions: [
        ...prev.actions,
        { type: 'update_status', value: '', condition: {} },
      ],
    }));
  };

  const updateAction = (index: number, field: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.map((action, i) =>
        i === index ? { ...action, [field]: value } : action
      ),
    }));
  };

  const removeAction = (index: number) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!permissions.canEditWorkflows) {
      toast.error('You do not have permission to create or edit workflows');
      return;
    }
    if (form.actions.length === 0) {
      toast.error('Error', {
        description: 'At least one action is required',
      });
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error('Error', {
          description: 'You must be logged in',
        });
        return;
      }

      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .single();

      const workflowData = {
        name: form.name,
        description: form.description || null,
        trigger_type: form.trigger_type,
        trigger_conditions: form.trigger_conditions,
        actions: form.actions,
        is_active: form.is_active,
        priority: form.priority,
        created_by: admin?.id || null,
        updated_at: new Date().toISOString(),
      };

      if (editingWorkflow) {
        const { error } = await supabase
          .from('homaradesk_workflows')
          .update(workflowData)
          .eq('id', editingWorkflow.id);

        if (error) throw error;
        toast.success('Success', {
          description: 'Workflow updated',
        });
      } else {
        const { error } = await supabase
          .from('homaradesk_workflows')
          .insert(workflowData);

        if (error) throw error;
        toast.success('Success', {
          description: 'Workflow created',
        });
      }

      setDialogOpen(false);
      setEditingWorkflow(null);
      setForm({
        name: '',
        description: '',
        trigger_type: 'ticket_created',
        trigger_conditions: {},
        actions: [],
        is_active: true,
        priority: 0,
      });
      fetchWorkflows();
    } catch (error: any) {
      logger.error('Error saving workflow:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save workflow',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!permissions.canEditWorkflows) {
      toast.error('You do not have permission to delete workflows');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this workflow?')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Success', {
        description: 'Workflow deleted',
      });
      fetchWorkflows();
    } catch (error: any) {
      logger.error('Error deleting workflow:', error);
      toast.error('Error', {
        description: error.message || 'Failed to delete workflow',
      });
    }
  };

  const toggleWorkflow = async (workflow: Workflow) => {
    try {
      const { error } = await supabase
        .from('homaradesk_workflows')
        .update({ is_active: !workflow.is_active })
        .eq('id', workflow.id);

      if (error) throw error;
      toast.success('Success', {
        description: `Workflow ${!workflow.is_active ? 'activated' : 'deactivated'}`,
      });
      fetchWorkflows();
    } catch (error: any) {
      logger.error('Error toggling workflow:', error);
      toast.error('Error', {
        description: error.message || 'Failed to toggle workflow',
      });
    }
  };

  const openCreateDialog = () => {
    setEditingWorkflow(null);
    setForm({
      name: '',
      description: '',
      trigger_type: 'ticket_created',
      trigger_conditions: {},
      actions: [],
      is_active: true,
      priority: 0,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setForm({
      name: workflow.name,
      description: workflow.description || '',
      trigger_type: workflow.trigger_type,
      trigger_conditions: workflow.trigger_conditions || {},
      actions: Array.isArray(workflow.actions) ? workflow.actions : [],
      is_active: workflow.is_active,
      priority: workflow.priority,
    });
    setDialogOpen(true);
  };

  const filteredWorkflows = workflows.filter((workflow) => {
    const matchesSearch = search === '' ||
      workflow.name.toLowerCase().includes(search.toLowerCase()) ||
      workflow.description?.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Automate ticket processing with conditional workflows
          </p>
        </div>
        {permissions.canEditWorkflows && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchWorkflows} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Workflows Table */}
      <Card>
        <CardHeader>
          <CardTitle>Workflows ({filteredWorkflows.length})</CardTitle>
          <CardDescription>
            Manage your automated workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="text-center py-8">
              <Workflow className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">No workflows found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {workflows.length === 0
                  ? 'Create your first workflow to automate ticket processing.'
                  : 'Try adjusting your search.'}
              </p>
              {workflows.length === 0 && permissions.canEditWorkflows && (
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workflow
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">{workflow.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {workflow.trigger_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {Array.isArray(workflow.actions) ? workflow.actions.length : 0} actions
                      </Badge>
                    </TableCell>
                    <TableCell>{workflow.priority}</TableCell>
                    <TableCell>
                      <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                        {workflow.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(workflow.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleWorkflow(workflow)}>
                            {workflow.is_active ? (
                              <>
                                <Pause className="mr-2 h-4 w-4" /> Deactivate
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" /> Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          {permissions.canEditWorkflows && (
                            <>
                              <DropdownMenuItem onClick={() => openEditDialog(workflow)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(workflow.id)}
                                className="text-destructive"
                              >
                                <Trash className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWorkflow ? 'Edit Workflow' : 'Create Workflow'}
            </DialogTitle>
            <DialogDescription>
              {editingWorkflow
                ? 'Update your workflow configuration.'
                : 'Create a new automated workflow.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Auto-assign High Priority Tickets"
                required
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What does this workflow do?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Trigger Type *</Label>
                <Select
                  value={form.trigger_type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, trigger_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ticket_created">Ticket Created</SelectItem>
                    <SelectItem value="ticket_updated">Ticket Updated</SelectItem>
                    <SelectItem value="status_changed">Status Changed</SelectItem>
                    <SelectItem value="priority_changed">Priority Changed</SelectItem>
                    <SelectItem value="comment_added">Comment Added</SelectItem>
                    <SelectItem value="time_based">Time Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Higher priority workflows run first
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Actions *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addAction}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Action
                </Button>
              </div>
              {form.actions.length === 0 ? (
                <div className="p-4 border rounded-md text-center text-muted-foreground">
                  <p>No actions added. Click "Add Action" to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.actions.map((action, index) => (
                    <div key={index} className="p-3 border rounded-md space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Action {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAction(index)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={action.type}
                            onValueChange={(value) => updateAction(index, 'type', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="update_status">Update Status</SelectItem>
                              <SelectItem value="update_priority">Update Priority</SelectItem>
                              <SelectItem value="assign_to">Assign To</SelectItem>
                              <SelectItem value="add_tag">Add Tag</SelectItem>
                              <SelectItem value="add_comment">Add Comment</SelectItem>
                              <SelectItem value="send_email">Send Email</SelectItem>
                              <SelectItem value="create_ticket">Create Ticket</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Value</Label>
                          <Input
                            value={action.value || ''}
                            onChange={(e) => updateAction(index, 'value', e.target.value)}
                            placeholder="Enter value..."
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked: boolean) => setForm((prev) => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || form.actions.length === 0}>
              {editingWorkflow ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

