import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft,
  RefreshCw,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Calendar,
  Tag,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

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

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [helpfulClicked, setHelpfulClicked] = useState(false);
  const [notHelpfulClicked, setNotHelpfulClicked] = useState(false);

  useEffect(() => {
    if (id) {
      fetchArticle();
    }
  }, [id]);

  const fetchArticle = async () => {
    if (!id) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('homaradesk_kb_articles')
        .select('*')
        .eq('id', id)
        .eq('is_published', true)
        .single();

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setArticle(null);
          return;
        }
        throw error;
      }

      if (data) {
        setArticle(data);
        
        // Increment view count
        await supabase
          .from('homaradesk_kb_articles')
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq('id', id);
      }
    } catch (error: any) {
      logger.error('Error fetching article:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch article',
        variant: 'destructive',
      });
      setArticle(null);
    } finally {
      setLoading(false);
    }
  };

  const handleHelpful = async () => {
    if (!article || helpfulClicked) return;

    try {
      await supabase
        .from('homaradesk_kb_articles')
        .update({ helpful_count: (article.helpful_count || 0) + 1 })
        .eq('id', article.id);

      setHelpfulClicked(true);
      setArticle({
        ...article,
        helpful_count: (article.helpful_count || 0) + 1,
      });

      toast({
        title: 'Thank you!',
        description: 'Your feedback helps us improve',
      });
    } catch (error: any) {
      logger.error('Error updating helpful count:', error);
    }
  };

  const handleNotHelpful = async () => {
    if (!article || notHelpfulClicked) return;

    setNotHelpfulClicked(true);
    toast({
      title: 'Feedback received',
      description: 'We\'ll work on improving this article',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="space-y-6">
        <Link to="/support/kb">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Knowledge Base
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Article not found</p>
            <p className="text-sm text-muted-foreground mt-2">
              The article you're looking for doesn't exist or is not published.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/support/kb">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Knowledge Base
          </Button>
        </Link>
        <Button variant="outline" size="icon" onClick={fetchArticle} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Article Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                {article.is_featured && (
                  <Badge variant="default">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Featured
                  </Badge>
                )}
                {article.category && (
                  <Badge variant="outline">{article.category}</Badge>
                )}
              </div>
              <CardTitle className="text-3xl mb-3">{article.title}</CardTitle>
              {article.summary && (
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {article.summary}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span>{article.view_count || 0} views</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Updated {format(new Date(article.updated_at), 'MMM d, yyyy')}</span>
            </div>
            {article.helpful_count > 0 && (
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4" />
                <span>{article.helpful_count} found helpful</span>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Article Content */}
      <Card>
        <CardContent className="pt-6">
          <div className="prose prose-slate dark:prose-invert max-w-none kb-article-content">
            <style>{`
              .kb-article-content h1 {
                font-size: 2.5rem;
                font-weight: 800;
                line-height: 1.2;
                margin-bottom: 2rem;
                margin-top: 0;
                padding-bottom: 1.5rem;
                border-bottom: 2px solid hsl(var(--border));
                color: hsl(var(--foreground));
              }

              .kb-article-content h2 {
                font-size: 2rem;
                font-weight: 700;
                line-height: 1.3;
                margin-top: 3rem;
                margin-bottom: 1.5rem;
                color: hsl(var(--foreground));
              }

              .kb-article-content h3 {
                font-size: 1.5rem;
                font-weight: 600;
                line-height: 1.4;
                margin-top: 2.5rem;
                margin-bottom: 1rem;
                color: hsl(var(--foreground) / 0.9);
              }

              .kb-article-content h4 {
                font-size: 1.25rem;
                font-weight: 600;
                line-height: 1.5;
                margin-top: 2rem;
                margin-bottom: 0.75rem;
                color: hsl(var(--foreground) / 0.85);
              }

              .kb-article-content p {
                font-size: 1.125rem;
                line-height: 1.8;
                margin-bottom: 1.5rem;
                color: hsl(var(--foreground) / 0.8);
              }

              .kb-article-content strong {
                font-weight: 600;
                color: hsl(var(--foreground));
              }

              .kb-article-content a {
                color: hsl(var(--primary));
                text-decoration: none;
                font-weight: 500;
                border-bottom: 1px solid hsl(var(--primary) / 0.3);
                transition: border-color 0.2s;
              }

              .kb-article-content a:hover {
                border-bottom-color: hsl(var(--primary));
              }

              .kb-article-content code {
                background: hsl(var(--primary) / 0.1);
                color: hsl(var(--primary));
                padding: 0.2rem 0.4rem;
                border-radius: 0.375rem;
                font-size: 0.9em;
                font-family: 'Monaco', 'Menlo', monospace;
                border: 1px solid hsl(var(--primary) / 0.2);
              }

              .kb-article-content pre {
                margin: 1.5rem 0;
                border-radius: 0.75rem;
                overflow-x: auto;
                background: hsl(var(--muted));
                padding: 1.5rem;
                border: 1px solid hsl(var(--border));
              }

              .kb-article-content pre code {
                background: transparent;
                color: inherit;
                padding: 0;
                border: none;
                border-radius: 0;
                font-size: 0.9rem;
                line-height: 1.6;
              }

              .kb-article-content ul, .kb-article-content ol {
                margin: 1.5rem 0;
                padding-left: 2rem;
              }

              .kb-article-content li {
                margin: 0.75rem 0;
                font-size: 1.125rem;
                line-height: 1.8;
                color: hsl(var(--foreground) / 0.8);
              }

              .kb-article-content blockquote {
                margin: 1.5rem 0;
                padding: 1rem 1.5rem;
                border-left: 4px solid hsl(var(--primary));
                background: hsl(var(--primary) / 0.05);
                border-radius: 0 0.5rem 0.5rem 0;
                font-style: italic;
                font-size: 1.125rem;
                line-height: 1.8;
              }

              .kb-article-content table {
                width: 100%;
                margin: 2rem 0;
                border-collapse: collapse;
                border-radius: 0.5rem;
                overflow: hidden;
                border: 1px solid hsl(var(--border));
              }

              .kb-article-content thead {
                background: hsl(var(--primary) / 0.1);
              }

              .kb-article-content th {
                padding: 1rem 1.5rem;
                text-align: left;
                font-weight: 600;
                font-size: 1rem;
                color: hsl(var(--foreground));
                border-bottom: 2px solid hsl(var(--border));
              }

              .kb-article-content td {
                padding: 1rem 1.5rem;
                border-bottom: 1px solid hsl(var(--border));
                font-size: 1rem;
                line-height: 1.6;
              }

              .kb-article-content tbody tr:hover {
                background: hsl(var(--muted) / 0.5);
              }

              .kb-article-content hr {
                margin: 2rem 0;
                border: none;
                height: 1px;
                background: hsl(var(--border));
              }

              .kb-article-content img {
                margin: 2rem 0;
                border-radius: 0.75rem;
                max-width: 100%;
                height: auto;
                border: 1px solid hsl(var(--border));
              }
            `}</style>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      {article.tags && article.tags.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Tags:</span>
              {article.tags.map((tag, idx) => (
                <Badge key={idx} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Was this article helpful?</h3>
            <div className="flex items-center gap-3">
              <Button
                variant={helpfulClicked ? "default" : "outline"}
                onClick={handleHelpful}
                disabled={helpfulClicked || notHelpfulClicked}
              >
                <ThumbsUp className="mr-2 h-4 w-4" />
                {helpfulClicked ? 'Thank you!' : 'Yes, helpful'}
              </Button>
              <Button
                variant={notHelpfulClicked ? "outline" : "outline"}
                onClick={handleNotHelpful}
                disabled={helpfulClicked || notHelpfulClicked}
              >
                <ThumbsDown className="mr-2 h-4 w-4" />
                {notHelpfulClicked ? 'Feedback received' : 'Not helpful'}
              </Button>
            </div>
            {helpfulClicked && (
              <p className="text-sm text-muted-foreground">
                Thank you for your feedback! This helps us improve our knowledge base.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

