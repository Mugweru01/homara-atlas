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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  FileText,
  Search,
  RefreshCw,
  Plus,
  Edit,
  Eye,
  Trash2,
  Globe,
  Clock,
  Copy,
  History,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CMSPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  created_at?: string;
  updated_at: string;
}

export default function CMSPages() {
  const [pages, setPages] = useState<CMSPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPage, setSelectedPage] = useState<CMSPage | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
  });

  useEffect(() => {
    fetchPages();
    const interval = setInterval(fetchPages, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cms_pages')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error && error.code !== '42P01') {
        throw error;
      }

      const processedPages = (data || []).map((page: any) => ({
        id: page.id,
        title: page.title || 'Untitled Page',
        slug: page.slug || '',
        content: page.content || '',
        created_at: page.created_at,
        updated_at: page.updated_at,
      }));

      setPages(processedPages);
    } catch (error: any) {
      logger.error('Error fetching CMS pages:', error);
      if (error.code !== '42P01') {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch CMS pages',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedPage(null);
    setFormData({
      title: '',
      slug: '',
      content: '',
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (page: CMSPage) => {
    setSelectedPage(page);
    setFormData({
      title: page.title,
      slug: page.slug,
      content: page.content,
    });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.title.trim()) {
        toast({
          title: 'Error',
          description: 'Title is required',
          variant: 'destructive',
        });
        return;
      }

      if (!formData.slug.trim()) {
        toast({
          title: 'Error',
          description: 'Slug is required',
          variant: 'destructive',
        });
        return;
      }

      const pageData: any = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        content: formData.content,
        updated_at: new Date().toISOString(),
      };

      if (selectedPage) {
        // Update existing page
        const { error } = await supabase
          .from('cms_pages')
          .update(pageData)
          .eq('id', selectedPage.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'CMS page updated',
        });
      } else {
        // Create new page
        const { error } = await supabase
          .from('cms_pages')
          .insert(pageData);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'CMS page created',
        });
      }

      setEditDialogOpen(false);
      fetchPages();
    } catch (error: any) {
      logger.error('Error saving CMS page:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save CMS page',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this CMS page?')) return;

    try {
      const { error } = await supabase
        .from('cms_pages')
        .delete()
        .eq('id', pageId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'CMS page deleted',
      });

      fetchPages();
    } catch (error: any) {
      logger.error('Error deleting CMS page:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete CMS page',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (page: CMSPage) => {
    try {
      const { error } = await supabase
        .from('cms_pages')
        .insert({
          title: `${page.title} (Copy)`,
          slug: `${page.slug}-copy`,
          content: page.content,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'CMS page duplicated',
      });

      fetchPages();
    } catch (error: any) {
      logger.error('Error duplicating CMS page:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate CMS page',
        variant: 'destructive',
      });
    }
  };

  const filteredPages = pages.filter(page => {
    const matchesSearch = search === '' || 
      page.title.toLowerCase().includes(search.toLowerCase()) ||
      page.slug.toLowerCase().includes(search.toLowerCase()) ||
      page.content.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CMS Pages</h1>
          <p className="text-muted-foreground">
            Manage static pages and content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchPages} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Page
          </Button>
          <ExportButton data={filteredPages} filename="cms-pages" />
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Pages</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pages.length}</div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search pages by title, slug, or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pages Table */}
      <Card>
        <CardHeader>
          <CardTitle>CMS Pages ({filteredPages.length})</CardTitle>
          <CardDescription>
            All static pages and content
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No CMS pages found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPages.map((page) => (
                      <TableRow key={page.id}>
                        <TableCell>
                          <div className="max-w-md">
                            <div className="font-medium truncate">{page.title}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {page.content.substring(0, 50)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              /{page.slug}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(page.updated_at), 'MMM d, yyyy HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/${page.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="icon" title="View">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(page)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDuplicate(page)}
                              title="Duplicate"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(page.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPage ? 'Edit CMS Page' : 'Create New CMS Page'}
            </DialogTitle>
            <DialogDescription>
              {selectedPage ? 'Update page content' : 'Create a new static page'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter page title"
                />
              </div>
              <div>
                <Label>Slug *</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="page-url-slug"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL: /{formData.slug || 'slug'}
                </p>
              </div>
            </div>

            <div>
              <Label>Content *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Enter page content... (Page builder will be implemented)"
                rows={20}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Note: Page builder and version control coming soon
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {selectedPage ? 'Update Page' : 'Create Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

