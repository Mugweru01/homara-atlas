import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  BookOpen,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  Eye,
  Search,
  Link as LinkIcon,
  Split,
  FileText,
  Monitor,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { useAdmin } from '@/hooks/useAdmin';

interface KBArticle {
  id: string;
  title: string;
  summary?: string;
  content: string;
  category?: string;
  tags?: string[];
  slug?: string;
  is_published: boolean;
  is_featured: boolean;
  view_count: number;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export default function KnowledgeBaseManagement() {
  const { user, isSuperAdmin } = useAdmin();
  
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null);
  const [previewArticle, setPreviewArticle] = useState<KBArticle | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');
  const [form, setForm] = useState({
    title: '',
    summary: '',
    content: '',
    category: '',
    tags: '',
    is_published: false,
    is_featured: false,
  });

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('homaradesk_kb_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setArticles([]);
          return;
        }
        throw error;
      }

      setArticles(data || []);
    } catch (error: any) {
      logger.error('Error fetching KB articles:', error);
      console.error('KB fetch error:', error);
      toast.error('Error', {
        description: error.message || 'Failed to fetch articles',
      });
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArticle = () => {
    setEditingArticle(null);
    setForm({
      title: '',
      summary: '',
      content: '',
      category: '',
      tags: '',
      is_published: false,
      is_featured: false,
    });
    setDialogOpen(true);
  };

  const handleEditArticle = (article: KBArticle) => {
    setEditingArticle(article);
    setForm({
      title: article.title,
      summary: article.summary || '',
      content: article.content,
      category: article.category || '',
      tags: Array.isArray(article.tags) ? article.tags.join(', ') : '',
      is_published: article.is_published,
      is_featured: article.is_featured,
    });
    setDialogOpen(true);
  };

  const handlePreviewArticle = (article: KBArticle) => {
    setPreviewArticle(article);
    setPreviewDialogOpen(true);
  };

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleSaveArticle = async () => {
    if (!isSuperAdmin) {
      toast.error('Only super admins can create or edit knowledge base articles');
      return;
    }
    try {
      // Generate slug only for new articles or if title changed significantly
      const slug = editingArticle?.slug || generateSlug(form.title);
      const articleData: any = {
        title: form.title,
        summary: form.summary || null,
        content: form.content,
        category: form.category || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
        is_published: form.is_published,
        is_featured: form.is_featured,
        slug: slug,
        updated_at: new Date().toISOString(),
      };

      // Only set author_id for new articles
      if (!editingArticle) {
        // Get admin ID for author_id
        if (user) {
          const { data: admin } = await supabase
            .from('admins')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();
          articleData.author_id = admin?.id || null;
        }
        articleData.published_at = form.is_published ? new Date().toISOString() : null;
      }

      if (editingArticle) {
        const { error } = await supabase
          .from('homaradesk_kb_articles')
          .update(articleData)
          .eq('id', editingArticle.id);

        if (error) throw error;
        toast.success('Article updated successfully', {
          description: 'Both knowledge base tables have been synchronized.',
        });
      } else {
        const { error } = await supabase
          .from('homaradesk_kb_articles')
          .insert(articleData);

        if (error) throw error;
        toast.success('Article created successfully', {
          description: 'Both knowledge base tables have been synchronized.',
        });
      }

      setDialogOpen(false);
      fetchArticles();
    } catch (error: any) {
      logger.error('Error saving article:', error);
      toast.error('Error saving article', {
        description: error.message || 'Failed to save article',
      });
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!isSuperAdmin) {
      toast.error('Only super admins can delete knowledge base articles');
      return;
    }
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_kb_articles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Article deleted successfully');

      fetchArticles();
    } catch (error: any) {
      logger.error('Error deleting article:', error);
      toast.error('Error deleting article', {
        description: error.message || 'Failed to delete article',
      });
    }
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = search === '' || 
      article.title.toLowerCase().includes(search.toLowerCase()) ||
      article.summary?.toLowerCase().includes(search.toLowerCase()) ||
      article.content.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || article.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(articles.map(a => a.category).filter(Boolean))];
  const stats = {
    total: articles.length,
    published: articles.filter(a => a.is_published).length,
    featured: articles.filter(a => a.is_featured).length,
    totalViews: articles.reduce((sum, a) => sum + (a.view_count || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base Management</h1>
          <p className="text-muted-foreground">
            Create and manage knowledge base articles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchArticles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {isSuperAdmin && (
            <Button onClick={handleCreateArticle}>
              <Plus className="mr-2 h-4 w-4" />
              Create Article
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.published}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Featured</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.featured}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat || 'all'}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Articles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Articles ({filteredArticles.length})</CardTitle>
          <CardDescription>
            Knowledge base articles for customer self-service
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No articles found</p>
              <p className="text-sm mt-2">
                {articles.length === 0 
                  ? 'Create your first knowledge base article'
                  : 'Try adjusting your filters'}
              </p>
              {articles.length === 0 && isSuperAdmin && (
                <Button onClick={handleCreateArticle} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Article
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Helpful</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArticles.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{article.title}</div>
                          {article.summary && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {article.summary}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {article.category ? (
                          <Badge variant="outline">{article.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {Array.isArray(article.tags) && article.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {article.tags.slice(0, 2).map((tag, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {article.tags.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{article.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {article.is_published ? (
                            <Badge variant="default" className="w-fit">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Published
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="w-fit">Draft</Badge>
                          )}
                          {article.is_featured && (
                            <Badge variant="outline" className="w-fit text-xs">Featured</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          {article.view_count || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{article.helpful_count || 0}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(article.updated_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreviewArticle(article)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditArticle(article)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteArticle(article.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingArticle ? 'Edit Knowledge Base Article' : 'Create Knowledge Base Article'}
            </DialogTitle>
            <DialogDescription>
              Create helpful articles for customer self-service. Changes sync to both knowledge base systems.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Basic Info Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kb_title">Title *</Label>
                <Input
                  id="kb_title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., How to reset your password"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="kb_category">Category</Label>
                <Input
                  id="kb_category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g., Account, Billing, Technical"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="kb_summary">Summary</Label>
              <Textarea
                id="kb_summary"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="Brief summary of the article (shown in listings)"
                rows={2}
                className="mt-1"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center justify-between border-b pb-2">
              <Label>Content Editor *</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'editor' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('editor')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Editor
                </Button>
                <Button
                  variant={viewMode === 'split' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('split')}
                >
                  <Split className="h-4 w-4 mr-2" />
                  Split
                </Button>
                <Button
                  variant={viewMode === 'preview' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('preview')}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>
            </div>

            {/* Content Editor with Split View */}
            <div className="flex-1 min-h-0 grid gap-4" style={{
              gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr'
            }}>
              {(viewMode === 'editor' || viewMode === 'split') && (
                <div className="flex flex-col min-h-0">
                  <Label htmlFor="kb_content" className="mb-2">Markdown Content</Label>
                  <ScrollArea className="flex-1 border rounded-md">
                    <Textarea
                      id="kb_content"
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      placeholder="# Article Title

Write your article content here using **Markdown** syntax.

## Features
- Lists
- **Bold** and *italic* text
- Code blocks
- And more!"
                      className="min-h-[500px] font-mono text-sm border-0 resize-none"
                    />
                  </ScrollArea>
                </div>
              )}
              
              {(viewMode === 'preview' || viewMode === 'split') && (
                <div className="flex flex-col min-h-0">
                  <Label className="mb-2">Live Preview</Label>
                  <ScrollArea className="flex-1 border rounded-md p-4 bg-muted/30">
                    {form.content ? (
                      <div className="prose prose-slate dark:prose-invert max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw, rehypeHighlight]}
                        >
                          {form.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-center py-12">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Start typing to see the preview</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>

            {/* Metadata Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kb_tags">Tags (comma-separated)</Label>
                <Input
                  id="kb_tags"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="password, reset, account"
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="kb_is_published"
                    checked={form.is_published}
                    onCheckedChange={(checked) => setForm({ ...form, is_published: checked as boolean })}
                  />
                  <Label htmlFor="kb_is_published" className="cursor-pointer">
                    Published (visible to customers)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="kb_is_featured"
                    checked={form.is_featured}
                    onCheckedChange={(checked) => setForm({ ...form, is_featured: checked as boolean })}
                  />
                  <Label htmlFor="kb_is_featured" className="cursor-pointer">
                    Featured
                  </Label>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDialogOpen(false);
              setViewMode('split');
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveArticle} disabled={!form.title.trim() || !form.content.trim()}>
              {editingArticle ? 'Update Article' : 'Create Article'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewArticle?.title}</DialogTitle>
            <DialogDescription>
              Preview of knowledge base article as customers will see it
            </DialogDescription>
          </DialogHeader>
          {previewArticle && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {previewArticle.summary && (
                  <div className="p-4 bg-muted rounded-lg border">
                    <Label className="text-sm font-semibold mb-2 block">Summary</Label>
                    <p className="text-muted-foreground">{previewArticle.summary}</p>
                  </div>
                )}
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeHighlight]}
                  >
                    {previewArticle.content}
                  </ReactMarkdown>
                </div>
                <div className="flex items-center gap-4 pt-4 border-t">
                  {previewArticle.category && (
                    <Badge variant="outline">{previewArticle.category}</Badge>
                  )}
                  {Array.isArray(previewArticle.tags) && previewArticle.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {previewArticle.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

