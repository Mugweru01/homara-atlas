import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tag,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Search,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';

interface ContactTag {
  id: string;
  name: string;
  color: string;
  category: string | null;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export default function Tags() {
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<ContactTag | null>(null);
  
  const [tagForm, setTagForm] = useState({
    name: '',
    color: '#3b82f6',
    category: '',
    description: '',
  });

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_tags' as any);

      if (error) throw error;

      setTags(data || []);
    } catch (error: any) {
      logger.error('Error fetching tags', { error });
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!tagForm.name.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      const { error } = await supabase.rpc('create_tag' as any, {
        p_name: tagForm.name.trim(),
        p_color: tagForm.color,
        p_category: tagForm.category || null,
        p_description: tagForm.description || null,
      });

      if (error) throw error;

      toast.success('Tag created successfully');
      setCreateDialogOpen(false);
      setTagForm({
        name: '',
        color: '#3b82f6',
        category: '',
        description: '',
      });
      fetchTags();
    } catch (error: any) {
      logger.error('Error creating tag', { error });
      toast.error(error?.message || 'Failed to create tag');
    }
  };

  const handleUpdateTag = async () => {
    if (!selectedTag) return;

    if (!tagForm.name.trim()) {
      toast.error('Tag name is required');
      return;
    }

    if (selectedTag.is_system) {
      toast.error('System tags cannot be updated');
      return;
    }

    try {
      const { error } = await supabase.rpc('update_tag' as any, {
        p_tag_id: selectedTag.id,
        p_name: tagForm.name.trim(),
        p_color: tagForm.color,
        p_category: tagForm.category || null,
        p_description: tagForm.description || null,
      });

      if (error) throw error;

      toast.success('Tag updated successfully');
      setEditDialogOpen(false);
      setSelectedTag(null);
      setTagForm({
        name: '',
        color: '#3b82f6',
        category: '',
        description: '',
      });
      fetchTags();
    } catch (error: any) {
      logger.error('Error updating tag', { error });
      toast.error(error?.message || 'Failed to update tag');
    }
  };

  const handleDeleteTag = async () => {
    if (!selectedTag) return;

    if (selectedTag.is_system) {
      toast.error('System tags cannot be deleted');
      return;
    }

    try {
      const { error } = await supabase
        .from('crm_contact_tags')
        .delete()
        .eq('id', selectedTag.id);

      if (error) throw error;

      toast.success('Tag deleted successfully');
      setDeleteDialogOpen(false);
      fetchTags();
    } catch (error: any) {
      logger.error('Error deleting tag', { error });
      toast.error('Failed to delete tag');
    }
  };

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase()) ||
    (tag.category && tag.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contact Tags</h1>
          <p className="text-muted-foreground">
            Manage tags for categorizing and organizing contacts
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Tag
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tags Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tags ({filteredTags.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchTags}>
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
          ) : filteredTags.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No tags found</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Tag
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <Badge
                          style={{
                            backgroundColor: tag.color + '20',
                            color: tag.color,
                            borderColor: tag.color,
                          }}
                        >
                          <Tag className="mr-1 h-3 w-3" />
                          {tag.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tag.category || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tag.description || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tag.is_system ? (
                          <Badge variant="secondary">System</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(tag.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {!tag.is_system && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTag(tag);
                                  setTagForm({
                                    name: tag.name,
                                    color: tag.color,
                                    category: tag.category || '',
                                    description: tag.description || '',
                                  });
                                  setEditDialogOpen(true);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTag(tag);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Tag Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>
              Create a new tag for categorizing contacts
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tag Name *</Label>
              <Input
                value={tagForm.name}
                onChange={(e) =>
                  setTagForm({ ...tagForm, name: e.target.value })
                }
                placeholder="e.g., VIP, Hot Lead"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={tagForm.color}
                    onChange={(e) =>
                      setTagForm({ ...tagForm, color: e.target.value })
                    }
                    className="h-10 w-20"
                  />
                  <Input
                    value={tagForm.color}
                    onChange={(e) =>
                      setTagForm({ ...tagForm, color: e.target.value })
                    }
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={tagForm.category}
                  onChange={(e) =>
                    setTagForm({ ...tagForm, category: e.target.value })
                  }
                  placeholder="e.g., Priority, Status"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={tagForm.description}
                onChange={(e) =>
                  setTagForm({ ...tagForm, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTag}>Create Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the tag information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tag Name *</Label>
              <Input
                value={tagForm.name}
                onChange={(e) =>
                  setTagForm({ ...tagForm, name: e.target.value })
                }
                placeholder="e.g., VIP, Hot Lead"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={tagForm.color}
                    onChange={(e) =>
                      setTagForm({ ...tagForm, color: e.target.value })
                    }
                    className="h-10 w-20"
                  />
                  <Input
                    value={tagForm.color}
                    onChange={(e) =>
                      setTagForm({ ...tagForm, color: e.target.value })
                    }
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={tagForm.category}
                  onChange={(e) =>
                    setTagForm({ ...tagForm, category: e.target.value })
                  }
                  placeholder="e.g., Priority, Status"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={tagForm.description}
                onChange={(e) =>
                  setTagForm({ ...tagForm, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false);
              setSelectedTag(null);
              setTagForm({
                name: '',
                color: '#3b82f6',
                category: '',
                description: '',
              });
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTag}>Update Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tag Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedTag?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTag}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

