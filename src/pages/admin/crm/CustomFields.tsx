import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Plus,
  Edit,
  Trash2,
  Search,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';

interface CustomFieldDefinition {
  id: string;
  name: string;
  field_key: string;
  field_type: string;
  field_options: any;
  is_required: boolean;
  default_value: string | null;
  placeholder: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export default function CustomFields() {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<CustomFieldDefinition | null>(null);
  
  const [fieldForm, setFieldForm] = useState({
    name: '',
    field_key: '',
    field_type: 'text',
    field_options: '',
    is_required: false,
    default_value: '',
    placeholder: '',
    description: '',
    display_order: 0,
  });

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_custom_field_definitions' as any);

      if (error) throw error;

      setFields(data || []);
    } catch (error: any) {
      logger.error('Error fetching custom fields', { error });
      toast.error('Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateField = async () => {
    if (!fieldForm.name.trim() || !fieldForm.field_key.trim()) {
      toast.error('Name and field key are required');
      return;
    }

    // Validate field_key format (lowercase, numbers, underscore only)
    if (!/^[a-z0-9_]+$/.test(fieldForm.field_key)) {
      toast.error('Field key must contain only lowercase letters, numbers, and underscores');
      return;
    }

    try {
      let fieldOptions = null;
      if (fieldForm.field_type === 'dropdown' && fieldForm.field_options) {
        // Parse dropdown options
        const options = fieldForm.field_options
          .split(',')
          .map((opt) => opt.trim())
          .filter(Boolean);
        fieldOptions = { options };
      }

      const { error } = await supabase.rpc('create_custom_field_definition' as any, {
        p_name: fieldForm.name.trim(),
        p_field_key: fieldForm.field_key.trim(),
        p_field_type: fieldForm.field_type,
        p_field_options: fieldOptions,
        p_is_required: fieldForm.is_required,
        p_default_value: fieldForm.default_value || null,
        p_placeholder: fieldForm.placeholder || null,
        p_description: fieldForm.description || null,
        p_display_order: fieldForm.display_order || 0,
      });

      if (error) throw error;

      toast.success('Custom field created successfully');
      setCreateDialogOpen(false);
      setFieldForm({
        name: '',
        field_key: '',
        field_type: 'text',
        field_options: '',
        is_required: false,
        default_value: '',
        placeholder: '',
        description: '',
        display_order: 0,
      });
      fetchFields();
    } catch (error: any) {
      logger.error('Error creating custom field', { error });
      toast.error(error?.message || 'Failed to create custom field');
    }
  };

  const handleDeleteField = async () => {
    if (!selectedField) return;

    try {
      const { error } = await supabase
        .from('crm_contact_custom_field_definitions')
        .update({ is_active: false })
        .eq('id', selectedField.id);

      if (error) throw error;

      toast.success('Custom field deactivated successfully');
      setDeleteDialogOpen(false);
      fetchFields();
    } catch (error: any) {
      logger.error('Error deleting custom field', { error });
      toast.error('Failed to deactivate custom field');
    }
  };

  const filteredFields = fields.filter((field) =>
    field.name.toLowerCase().includes(search.toLowerCase()) ||
    field.field_key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Custom Fields</h1>
          <p className="text-muted-foreground">
            Define custom fields to capture additional information about contacts
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Field
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search custom fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Fields Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Custom Fields ({filteredFields.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchFields}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No custom fields found</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Field
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Field Key</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFields.map((field) => (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">{field.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {field.field_key}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{field.field_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {field.is_required ? (
                          <Badge variant="default">Required</Badge>
                        ) : (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell>{field.display_order}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedField(field);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Field Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Custom Field</DialogTitle>
            <DialogDescription>
              Define a new custom field for contacts
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field Name *</Label>
                <Input
                  value={fieldForm.name}
                  onChange={(e) =>
                    setFieldForm({ ...fieldForm, name: e.target.value })
                  }
                  placeholder="e.g., Budget Range"
                />
              </div>
              <div className="space-y-2">
                <Label>Field Key *</Label>
                <Input
                  value={fieldForm.field_key}
                  onChange={(e) =>
                    setFieldForm({
                      ...fieldForm,
                      field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                    })
                  }
                  placeholder="e.g., budget_range"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase, numbers, and underscores only
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field Type *</Label>
                <Select
                  value={fieldForm.field_type}
                  onValueChange={(value) =>
                    setFieldForm({ ...fieldForm, field_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="datetime">Date & Time</SelectItem>
                    <SelectItem value="textarea">Textarea</SelectItem>
                    <SelectItem value="dropdown">Dropdown</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={fieldForm.display_order}
                  onChange={(e) =>
                    setFieldForm({
                      ...fieldForm,
                      display_order: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            {fieldForm.field_type === 'dropdown' && (
              <div className="space-y-2">
                <Label>Dropdown Options *</Label>
                <Input
                  value={fieldForm.field_options}
                  onChange={(e) =>
                    setFieldForm({ ...fieldForm, field_options: e.target.value })
                  }
                  placeholder="Option 1, Option 2, Option 3"
                />
                <p className="text-xs text-muted-foreground">
                  Separate options with commas
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={fieldForm.placeholder}
                  onChange={(e) =>
                    setFieldForm({ ...fieldForm, placeholder: e.target.value })
                  }
                  placeholder="Enter placeholder text"
                />
              </div>
              <div className="space-y-2">
                <Label>Default Value</Label>
                <Input
                  value={fieldForm.default_value}
                  onChange={(e) =>
                    setFieldForm({ ...fieldForm, default_value: e.target.value })
                  }
                  placeholder="Default value"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={fieldForm.description}
                onChange={(e) =>
                  setFieldForm({ ...fieldForm, description: e.target.value })
                }
                placeholder="Field description"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_required"
                checked={fieldForm.is_required}
                onChange={(e) =>
                  setFieldForm({ ...fieldForm, is_required: e.target.checked })
                }
              />
              <Label htmlFor="is_required" className="cursor-pointer">
                Required field
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateField}>Create Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Field Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Custom Field</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate "{selectedField?.name}"? This will hide it from new contacts but existing values will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteField}>
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

