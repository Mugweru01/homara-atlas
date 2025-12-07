import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Edit,
  Trash,
  Settings,
  RefreshCw,
  MoreVertical,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  field_options?: any;
  is_required: boolean;
  is_visible_to_customer: boolean;
  is_editable_by_customer: boolean;
  default_value?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function CustomFields() {
  const permissions = usePermissions();
  
  if (!permissions.canViewCustomFields) {
    return null; // ProtectedRoute will handle redirect
  }
  
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [form, setForm] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text',
    field_options: '',
    is_required: false,
    is_visible_to_customer: false,
    is_editable_by_customer: false,
    default_value: '',
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_custom_fields')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setFields([]);
          return;
        }
        throw error;
      }

      setFields(data || []);
    } catch (error: any) {
      logger.error('Error fetching custom fields:', error);
      toast.error('Error', {
        description: error.message || 'Failed to fetch custom fields',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const fieldData: any = {
        field_name: form.field_name,
        field_label: form.field_label,
        field_type: form.field_type,
        is_required: form.is_required,
        is_visible_to_customer: form.is_visible_to_customer,
        is_editable_by_customer: form.is_editable_by_customer,
        default_value: form.default_value || null,
        display_order: form.display_order,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      // Parse field options for dropdown/multi_select
      if (['dropdown', 'multi_select', 'radio'].includes(form.field_type)) {
        fieldData.field_options = form.field_options
          .split(',')
          .map((opt: string) => opt.trim())
          .filter(Boolean);
      } else {
        fieldData.field_options = null;
      }

      if (editingField) {
        const { error } = await supabase
          .from('homaradesk_custom_fields')
          .update(fieldData)
          .eq('id', editingField.id);

        if (error) throw error;
        toast.success('Success', {
          description: 'Custom field updated',
        });
      } else {
        const { error } = await supabase
          .from('homaradesk_custom_fields')
          .insert(fieldData);

        if (error) throw error;
        toast.success('Success', {
          description: 'Custom field created',
        });
      }

      setDialogOpen(false);
      setEditingField(null);
      setForm({
        field_name: '',
        field_label: '',
        field_type: 'text',
        field_options: '',
        is_required: false,
        is_visible_to_customer: false,
        is_editable_by_customer: false,
        default_value: '',
        display_order: 0,
        is_active: true,
      });
      fetchFields();
    } catch (error: any) {
      logger.error('Error saving custom field:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save custom field',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this custom field? This will remove all values for this field.')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_custom_fields')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Success', {
        description: 'Custom field deleted',
      });
      fetchFields();
    } catch (error: any) {
      logger.error('Error deleting custom field:', error);
      toast.error('Error', {
        description: error.message || 'Failed to delete custom field',
      });
    }
  };

  const openCreateDialog = () => {
    setEditingField(null);
    setForm({
      field_name: '',
      field_label: '',
      field_type: 'text',
      field_options: '',
      is_required: false,
      is_visible_to_customer: false,
      is_editable_by_customer: false,
      default_value: '',
      display_order: fields.length,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (field: CustomField) => {
    setEditingField(field);
    setForm({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      field_options: Array.isArray(field.field_options)
        ? field.field_options.join(', ')
        : '',
      is_required: field.is_required,
      is_visible_to_customer: field.is_visible_to_customer,
      is_editable_by_customer: field.is_editable_by_customer,
      default_value: field.default_value || '',
      display_order: field.display_order,
      is_active: field.is_active,
    });
    setDialogOpen(true);
  };

  const filteredFields = fields.filter((field) => {
    const matchesSearch = search === '' ||
      field.field_name.toLowerCase().includes(search.toLowerCase()) ||
      field.field_label.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Textarea' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date & Time' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'multi_select', label: 'Multi-Select' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'radio', label: 'Radio' },
    { value: 'file', label: 'File Upload' },
    { value: 'url', label: 'URL' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Custom Fields</h1>
          <p className="text-muted-foreground">
            Define custom fields for tickets
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Field
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchFields} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Fields Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fields ({filteredFields.length})</CardTitle>
          <CardDescription>
            Custom fields available for tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">No custom fields found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {fields.length === 0
                  ? 'Create your first custom field.'
                  : 'Try adjusting your search.'}
              </p>
              {fields.length === 0 && (
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Field
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.field_label}</TableCell>
                    <TableCell className="font-mono text-xs">{field.field_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{field.field_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {field.is_required ? (
                        <Badge variant="destructive">Required</Badge>
                      ) : (
                        <span className="text-muted-foreground">Optional</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {field.is_visible_to_customer && (
                          <Badge variant="secondary" className="text-xs">Visible</Badge>
                        )}
                        {field.is_editable_by_customer && (
                          <Badge variant="secondary" className="text-xs">Editable</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{field.display_order}</TableCell>
                    <TableCell>
                      <Badge variant={field.is_active ? 'default' : 'secondary'}>
                        {field.is_active ? 'Active' : 'Inactive'}
                      </Badge>
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
                          <DropdownMenuItem onClick={() => openEditDialog(field)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(field.id)}
                            className="text-destructive"
                          >
                            <Trash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingField ? 'Edit Custom Field' : 'Create Custom Field'}
            </DialogTitle>
            <DialogDescription>
              {editingField
                ? 'Update your custom field configuration.'
                : 'Create a new custom field for tickets.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Field Label *</Label>
              <Input
                value={form.field_label}
                onChange={(e) => setForm((prev) => ({ ...prev, field_label: e.target.value }))}
                placeholder="e.g., Order Number"
                required
              />
            </div>

            <div>
              <Label>Field Name *</Label>
              <Input
                value={form.field_name}
                onChange={(e) => setForm((prev) => ({ ...prev, field_name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                placeholder="e.g., order_number"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Internal field name (lowercase, underscores)
              </p>
            </div>

            <div>
              <Label>Field Type *</Label>
              <Select
                value={form.field_type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, field_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {['dropdown', 'multi_select', 'radio'].includes(form.field_type) && (
              <div>
                <Label>Options (comma-separated) *</Label>
                <Input
                  value={form.field_options}
                  onChange={(e) => setForm((prev) => ({ ...prev, field_options: e.target.value }))}
                  placeholder="e.g., Option 1, Option 2, Option 3"
                  required
                />
              </div>
            )}

            <div>
              <Label>Default Value</Label>
              <Input
                value={form.default_value}
                onChange={(e) => setForm((prev) => ({ ...prev, default_value: e.target.value }))}
                placeholder="Default value (optional)"
              />
            </div>

            <div>
              <Label>Display Order</Label>
              <Input
                type="number"
                min="0"
                value={form.display_order}
                onChange={(e) => setForm((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_required"
                  checked={form.is_required}
                  onCheckedChange={(checked: boolean) => setForm((prev) => ({ ...prev, is_required: checked }))}
                />
                <Label htmlFor="is_required">Required Field</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_visible_to_customer"
                  checked={form.is_visible_to_customer}
                  onCheckedChange={(checked: boolean) => setForm((prev) => ({ ...prev, is_visible_to_customer: checked }))}
                />
                <Label htmlFor="is_visible_to_customer">Visible to Customer</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_editable_by_customer"
                  checked={form.is_editable_by_customer}
                  onCheckedChange={(checked: boolean) => setForm((prev) => ({ ...prev, is_editable_by_customer: checked }))}
                />
                <Label htmlFor="is_editable_by_customer">Editable by Customer</Label>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.field_name.trim() || !form.field_label.trim()}>
              {editingField ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

