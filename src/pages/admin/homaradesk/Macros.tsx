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
  Zap,
  RefreshCw,
  MoreVertical,
  Search,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { format } from 'date-fns';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions } from '@/hooks/usePermissions';

interface Macro {
  id: string;
  name: string;
  description?: string;
  actions: any[];
  is_shared: boolean;
  is_active: boolean;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export default function Macros() {
  const { user } = useAdmin();
  const permissions = usePermissions();
  const [macros, setMacros] = useState<Macro[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMacro, setEditingMacro] = useState<Macro | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    actions: [] as any[],
    is_shared: false,
    is_active: true,
  });

  useEffect(() => {
    fetchMacros();
  }, []);

  const fetchMacros = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_macros')
        .select('*')
        .order('usage_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setMacros([]);
          return;
        }
        throw error;
      }

      setMacros(data || []);
    } catch (error: any) {
      logger.error('Error fetching macros:', error);
      toast.error('Error', {
        description: error.message || 'Failed to fetch macros',
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
        { type: 'update_status', value: '', is_internal: false },
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
    if (!permissions.canEditMacros) {
      toast.error('You do not have permission to create or edit macros');
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

      const macroData = {
        name: form.name,
        description: form.description || null,
        actions: form.actions,
        is_shared: form.is_shared,
        is_active: form.is_active,
        created_by: admin?.id || null,
        updated_at: new Date().toISOString(),
      };

      if (editingMacro) {
        const { error } = await supabase
          .from('homaradesk_macros')
          .update(macroData)
          .eq('id', editingMacro.id);

        if (error) throw error;
        toast.success('Success', {
          description: 'Macro updated',
        });
      } else {
        const { error } = await supabase
          .from('homaradesk_macros')
          .insert(macroData);

        if (error) throw error;
        toast.success('Success', {
          description: 'Macro created',
        });
      }

      setDialogOpen(false);
      setEditingMacro(null);
      setForm({
        name: '',
        description: '',
        actions: [],
        is_shared: false,
        is_active: true,
      });
      fetchMacros();
    } catch (error: any) {
      logger.error('Error saving macro:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save macro',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!permissions.canEditMacros) {
      toast.error('You do not have permission to delete macros');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this macro?')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_macros')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Success', {
        description: 'Macro deleted',
      });
      fetchMacros();
    } catch (error: any) {
      logger.error('Error deleting macro:', error);
      toast.error('Error', {
        description: error.message || 'Failed to delete macro',
      });
    }
  };

  const openCreateDialog = () => {
    setEditingMacro(null);
    setForm({
      name: '',
      description: '',
      actions: [],
      is_shared: false,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (macro: Macro) => {
    setEditingMacro(macro);
    setForm({
      name: macro.name,
      description: macro.description || '',
      actions: Array.isArray(macro.actions) ? macro.actions : [],
      is_shared: macro.is_shared,
      is_active: macro.is_active,
    });
    setDialogOpen(true);
  };

  const filteredMacros = macros.filter((macro) => {
    const matchesSearch = search === '' ||
      macro.name.toLowerCase().includes(search.toLowerCase()) ||
      macro.description?.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Macros</h1>
          <p className="text-muted-foreground">
            Automated action sequences for common ticket operations
          </p>
        </div>
        {permissions.canEditMacros && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Macro
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search macros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchMacros} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Macros Table */}
      <Card>
        <CardHeader>
          <CardTitle>Macros ({filteredMacros.length})</CardTitle>
          <CardDescription>
            Manage your automated action sequences
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMacros.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">No macros found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {macros.length === 0
                  ? 'Create your first macro to automate common actions.'
                  : 'Try adjusting your search.'}
              </p>
              {macros.length === 0 && permissions.canEditMacros && (
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Macro
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMacros.map((macro) => (
                  <TableRow key={macro.id}>
                    <TableCell className="font-medium">{macro.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {macro.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {Array.isArray(macro.actions) ? macro.actions.length : 0} actions
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={macro.is_active ? 'default' : 'secondary'}>
                        {macro.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{macro.usage_count}</TableCell>
                    <TableCell>
                      {macro.last_used_at
                        ? format(new Date(macro.last_used_at), 'MMM d, yyyy')
                        : 'Never'}
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
                          {permissions.canEditMacros && (
                            <>
                              <DropdownMenuItem onClick={() => openEditDialog(macro)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(macro.id)}
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMacro ? 'Edit Macro' : 'Create Macro'}
            </DialogTitle>
            <DialogDescription>
              {editingMacro
                ? 'Update your macro configuration.'
                : 'Create a new automated action sequence.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Resolve and Close Ticket"
                required
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What does this macro do?"
                rows={2}
              />
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
                      {action.type === 'add_comment' && (
                        <div>
                          <Label className="text-xs">Internal Comment</Label>
                          <Checkbox
                            checked={action.is_internal || false}
                            onCheckedChange={(checked: boolean) =>
                              updateAction(index, 'is_internal', checked)
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_shared"
                checked={form.is_shared}
                onCheckedChange={(checked: boolean) => setForm((prev) => ({ ...prev, is_shared: checked }))}
              />
              <Label htmlFor="is_shared">Share with team</Label>
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
              {editingMacro ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

