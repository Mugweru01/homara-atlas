import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search,
  BookOpen,
  FileText,
  RefreshCw,
  ArrowRight,
  HelpCircle,
  Eye,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { Link } from 'react-router-dom';

interface KBArticle {
  id: string;
  title: string;
  summary?: string;
  content: string;
  category?: string;
  tags?: string[];
  is_published: boolean;
  is_featured: boolean;
  view_count: number;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('homaradesk_kb_articles')
        .select('*')
        .eq('is_published', true)
        .order('is_featured', { ascending: false })
        .order('view_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST301' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setArticles([]);
          return;
        }
        throw error;
      }

      setArticles(data || []);
    } catch (error: any) {
      logger.error('Error fetching KB articles:', error);
      setArticles([]);
    } finally {
      setLoading(false);
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

  const featuredArticles = filteredArticles.filter(a => a.is_featured);
  const regularArticles = filteredArticles.filter(a => !a.is_featured);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Find answers to common questions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchArticles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search knowledge base..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                variant={categoryFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter('all')}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter(cat || 'all')}
                >
                  {cat}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Featured Articles */}
      {featuredArticles.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Featured Articles</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featuredArticles.map((article) => (
              <Link key={article.id} to={`/support/kb/${article.id}`}>
                <Card className="hover:shadow-lg transition-all cursor-pointer border-primary/20 hover:border-primary/40">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg leading-tight">{article.title}</CardTitle>
                      <Badge variant="default" className="shrink-0">
                        <BookOpen className="mr-1 h-3 w-3" />
                        Featured
                      </Badge>
                    </div>
                    {article.category && (
                      <Badge variant="outline" className="w-fit mt-2">
                        {article.category}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    {article.summary && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">
                        {article.summary}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.view_count || 0}
                        </span>
                        {article.helpful_count > 0 && (
                          <span className="flex items-center gap-1">
                            <span>👍</span>
                            {article.helpful_count}
                          </span>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Articles */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {featuredArticles.length > 0 ? 'All Articles' : 'Articles'}
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredArticles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-lg font-medium">No articles found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {articles.length === 0 
                  ? 'Knowledge base articles will appear here once published'
                  : 'Try adjusting your search or filters'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {regularArticles.map((article) => (
              <Link key={article.id} to={`/support/kb/${article.id}`}>
                <Card className="hover:shadow-lg transition-all cursor-pointer hover:border-primary/30">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg leading-tight mb-2">{article.title}</CardTitle>
                        {article.summary && (
                          <CardDescription className="mt-2 line-clamp-2 leading-relaxed">
                            {article.summary}
                          </CardDescription>
                        )}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {article.category && (
                            <Badge variant="outline" className="text-xs">
                              {article.category}
                            </Badge>
                          )}
                          {article.tags && article.tags.length > 0 && (
                            <>
                              {article.tags.slice(0, 3).map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {article.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{article.tags.length - 3} more
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.view_count || 0} views
                        </span>
                        {article.helpful_count > 0 && (
                          <span className="flex items-center gap-1">
                            <span>👍</span>
                            {article.helpful_count} helpful
                          </span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="gap-2">
                        Read Article
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

