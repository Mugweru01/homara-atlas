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
  FileText,
  RefreshCw,
  MoreVertical,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { format } from 'date-fns';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions } from '@/hooks/usePermissions';

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  is_shared: boolean;
  is_public: boolean;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export default function CannedResponses() {
  const { user } = useAdmin();
  const permissions = usePermissions();
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: '',
    tags: '',
    is_shared: false,
    is_public: false,
  });

  useEffect(() => {
    fetchResponses();
  }, []);

  const fetchResponses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_canned_responses')
        .select('*')
        .order('usage_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setResponses([]);
          return;
        }
        throw error;
      }

      setResponses(data || []);
    } catch (error: any) {
      logger.error('Error fetching canned responses:', error);
      toast.error('Error', {
        description: error.message || 'Failed to fetch canned responses',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!permissions.canEditCannedResponses) {
      toast.error('You do not have permission to create or edit canned responses');
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

      const responseData = {
        title: form.title,
        content: form.content,
        category: form.category || null,
        tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        is_shared: form.is_shared,
        is_public: form.is_public,
        created_by: admin?.id || null,
        updated_at: new Date().toISOString(),
      };

      if (editingResponse) {
        const { error } = await supabase
          .from('homaradesk_canned_responses')
          .update(responseData)
          .eq('id', editingResponse.id);

        if (error) throw error;
        toast.success('Success', {
          description: 'Canned response updated',
        });
      } else {
        const { error } = await supabase
          .from('homaradesk_canned_responses')
          .insert(responseData);

        if (error) throw error;
        toast.success('Success', {
          description: 'Canned response created',
        });
      }

      setDialogOpen(false);
      setEditingResponse(null);
      setForm({
        title: '',
        content: '',
        category: '',
        tags: '',
        is_shared: false,
        is_public: false,
      });
      fetchResponses();
    } catch (error: any) {
      logger.error('Error saving canned response:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save canned response',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!permissions.canEditCannedResponses) {
      toast.error('You do not have permission to delete canned responses');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this canned response?')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_canned_responses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Success', {
        description: 'Canned response deleted',
      });
      fetchResponses();
    } catch (error: any) {
      logger.error('Error deleting canned response:', error);
      toast.error('Error', {
        description: error.message || 'Failed to delete canned response',
      });
    }
  };

  const openCreateDialog = () => {
    setEditingResponse(null);
    setForm({
      title: '',
      content: '',
      category: '',
      tags: '',
      is_shared: false,
      is_public: false,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (response: CannedResponse) => {
    setEditingResponse(response);
    setForm({
      title: response.title,
      content: response.content,
      category: response.category || '',
      tags: Array.isArray(response.tags) ? response.tags.join(', ') : '',
      is_shared: response.is_shared,
      is_public: response.is_public,
    });
    setDialogOpen(true);
  };

  const filteredResponses = responses.filter((response) => {
    const matchesSearch = search === '' ||
      response.title.toLowerCase().includes(search.toLowerCase()) ||
      response.content.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || response.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(responses.map((r) => r.category).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Canned Responses</h1>
          <p className="text-muted-foreground">
            Quick reply templates for common support scenarios
          </p>
        </div>
        {permissions.canEditCannedResponses && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Response
          </Button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search responses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={setCategoryFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat || ''}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchResponses} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Responses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Responses ({filteredResponses.length})</CardTitle>
          <CardDescription>
            Manage your canned response templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">No canned responses found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {responses.length === 0
                  ? 'Create your first canned response template.'
                  : 'Try adjusting your search or filters.'}
              </p>
              {responses.length === 0 && permissions.canEditCannedResponses && (
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Response
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResponses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell className="font-medium">{response.title}</TableCell>
                    <TableCell>{response.category || '-'}</TableCell>
                    <TableCell>
                      {Array.isArray(response.tags) && response.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {response.tags.slice(0, 2).map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {response.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{response.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {response.is_shared && (
                          <Badge variant="outline" className="text-xs">Shared</Badge>
                        )}
                        {response.is_public && (
                          <Badge variant="outline" className="text-xs">Public</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{response.usage_count}</TableCell>
                    <TableCell>
                      {response.last_used_at
                        ? format(new Date(response.last_used_at), 'MMM d, yyyy')
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
                          {permissions.canEditCannedResponses && (
                            <>
                              <DropdownMenuItem onClick={() => openEditDialog(response)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(response.id)}
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingResponse ? 'Edit Canned Response' : 'Create Canned Response'}
            </DialogTitle>
            <DialogDescription>
              {editingResponse
                ? 'Update your canned response template.'
                : 'Create a new quick reply template.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Account Reset Instructions"
                required
              />
            </div>

            <div>
              <Label>Content *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Enter the response content. Use {{variable}} for dynamic content."
                rows={8}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available variables: {'{{ticket_number}}'}, {'{{requester_name}}'}, {'{{agent_name}}'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Billing, Technical"
                />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="refund, account, reset"
                />
              </div>
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
                id="is_public"
                checked={form.is_public}
                onCheckedChange={(checked: boolean) => setForm((prev) => ({ ...prev, is_public: checked }))}
              />
              <Label htmlFor="is_public">Visible to customers in portal</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.title.trim() || !form.content.trim()}>
              {editingResponse ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

