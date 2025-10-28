import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  BookOpen, 
  Download, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  Search,
  Copy,
  Check,
  Menu,
  ChevronRight,
  Sparkles,
  FileText,
  Info,
  Lightbulb,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import 'highlight.js/styles/atom-one-dark.css';

interface DocumentationViewerProps {
  file: string;
  onClose: () => void;
}

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function DocumentationViewer({ file, onClose }: DocumentationViewerProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string>('');
  const [showToc, setShowToc] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMarkdown();
  }, [file]);

  useEffect(() => {
    if (content) {
      extractHeadings();
    }
  }, [content]);

  useEffect(() => {
    // Listen for internal documentation link clicks
    const handleOpenDoc = (e: any) => {
      const filename = e.detail;
      // Close current viewer and reopen with new file
      onClose();
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openDocInViewer', { detail: filename }));
      }, 100);
    };

    window.addEventListener('openDoc', handleOpenDoc);
    return () => window.removeEventListener('openDoc', handleOpenDoc);
  }, [onClose]);

  const loadMarkdown = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/docs/${file}`);
      
      if (!response.ok) {
        throw new Error('Documentation file not found');
      }
      
      const text = await response.text();
      setContent(text);
    } catch (err) {
      console.error('Error loading documentation:', err);
      setError('Failed to load documentation. The file may not exist yet.');
    } finally {
      setLoading(false);
    }
  };

  const extractHeadings = () => {
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const matches = [...content.matchAll(headingRegex)];
    const extracted = matches.map((match, index) => ({
      id: `heading-${index}`,
      text: match[2].replace(/[📚🎯✅⚡🔒💾📊👥💻⚙️📖🚀]/g, '').trim(),
      level: match[1].length
    }));
    setHeadings(extracted);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const scrollToHeading = (headingId: string) => {
    const element = document.getElementById(headingId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeading(headingId);
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file;
    a.click();
    URL.revokeObjectURL(url);
  };

  const highlightedContent = searchTerm
    ? content.replace(
        new RegExp(searchTerm, 'gi'),
        (match) => `<mark class="bg-yellow-200 dark:bg-yellow-800">${match}</mark>`
      )
    : content;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[1600px] h-[95vh] flex gap-6">
        
        {/* Main Content Card */}
        <Card className="flex-1 flex flex-col shadow-2xl border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          {/* Premium Header */}
          <div className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="hover:bg-primary/10"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">{file.replace('.md', '').replace(/_/g, ' ')}</h2>
                    <p className="text-xs text-muted-foreground">Documentation</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowToc(!showToc)}
                  className="hidden lg:flex"
                >
                  <Menu className="h-4 w-4 mr-2" />
                  {showToc ? 'Hide' : 'Show'} Contents
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadMarkdown}
                  disabled={loading || !!error}
                  className="border-slate-300 dark:border-slate-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Search Bar */}
            {!loading && !error && (
              <div className="px-4 pb-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search in document..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="relative mb-6">
                      <div className="h-16 w-16 mx-auto">
                        <Loader2 className="h-16 w-16 animate-spin text-primary" />
                        <div className="absolute inset-0 h-16 w-16 animate-pulse rounded-full bg-primary/10" />
                      </div>
                    </div>
                    <p className="text-muted-foreground font-medium">Loading documentation...</p>
                    <p className="text-sm text-muted-foreground/60 mt-2">Please wait</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center h-full p-8">
                  <Card className="max-w-md border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950 dark:to-slate-900">
                    <div className="p-8 text-center">
                      <div className="mb-4 inline-flex p-4 rounded-full bg-orange-100 dark:bg-orange-900">
                        <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Documentation Not Available</h3>
                      <p className="text-muted-foreground mb-4">{error}</p>
                      <p className="text-sm text-muted-foreground mb-6">
                        This document is planned but not yet fully written. Check back soon!
                      </p>
                      <Button onClick={onClose} className="w-full">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Go Back
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {!loading && !error && (
                <div ref={contentRef} className="max-w-5xl mx-auto px-12 py-16">
                  {/* Premium Content Styling */}
                  <div className="premium-docs-content">
                    <style>{`
                      .premium-docs-content h1 {
                        font-size: 3.5rem;
                        font-weight: 800;
                        line-height: 1.2;
                        margin-bottom: 3rem;
                        margin-top: 0;
                        padding-bottom: 2rem;
                        border-bottom: 3px solid hsl(var(--primary) / 0.2);
                        background: linear-gradient(to right, hsl(var(--primary)), hsl(var(--primary) / 0.6));
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                        display: flex;
                        align-items: center;
                        gap: 1.5rem;
                      }

                      .premium-docs-content h2 {
                        font-size: 2.25rem;
                        font-weight: 700;
                        line-height: 1.3;
                        margin-top: 5rem;
                        margin-bottom: 2rem;
                        color: hsl(var(--foreground));
                        position: relative;
                        padding-left: 1.5rem;
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                      }

                      .premium-docs-content h2::before {
                        content: '';
                        position: absolute;
                        left: 0;
                        top: 0;
                        bottom: 0;
                        width: 5px;
                        background: linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--primary) / 0.4));
                        border-radius: 999px;
                      }

                      .premium-docs-content h3 {
                        font-size: 1.75rem;
                        font-weight: 600;
                        line-height: 1.4;
                        margin-top: 3.5rem;
                        margin-bottom: 1.5rem;
                        color: hsl(var(--foreground) / 0.9);
                      }

                      .premium-docs-content h4 {
                        font-size: 1.35rem;
                        font-weight: 600;
                        line-height: 1.5;
                        margin-top: 2.5rem;
                        margin-bottom: 1.25rem;
                        color: hsl(var(--foreground) / 0.85);
                      }

                      .premium-docs-content p {
                        font-size: 1.125rem;
                        line-height: 2;
                        margin-bottom: 2rem;
                        color: hsl(var(--foreground) / 0.8);
                      }

                      .premium-docs-content strong {
                        font-weight: 600;
                        color: hsl(var(--foreground));
                      }

                      .premium-docs-content a {
                        color: hsl(var(--primary));
                        text-decoration: none;
                        font-weight: 500;
                        transition: all 0.2s;
                        border-bottom: 1px solid hsl(var(--primary) / 0.3);
                      }

                      .premium-docs-content a:hover {
                        border-bottom-color: hsl(var(--primary));
                      }

                      .premium-docs-content code {
                        background: hsl(var(--primary) / 0.1);
                        color: hsl(var(--primary));
                        padding: 0.25rem 0.5rem;
                        border-radius: 0.375rem;
                        font-size: 0.95em;
                        font-family: 'Monaco', 'Menlo', monospace;
                        border: 1px solid hsl(var(--primary) / 0.2);
                      }

                      .premium-docs-content pre {
                        margin: 2.5rem 0;
                        border-radius: 1rem;
                        overflow: hidden;
                        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                      }

                      .premium-docs-content pre code {
                        background: transparent;
                        color: inherit;
                        padding: 0;
                        border: none;
                        border-radius: 0;
                        font-size: 0.95rem;
                        line-height: 1.8;
                      }

                      .premium-docs-content ul, .premium-docs-content ol {
                        margin: 2rem 0;
                        padding-left: 0;
                        list-style: none;
                      }

                      .premium-docs-content li {
                        margin: 1.25rem 0;
                        padding-left: 2.5rem;
                        position: relative;
                        font-size: 1.125rem;
                        line-height: 1.8;
                        color: hsl(var(--foreground) / 0.8);
                      }

                      .premium-docs-content ul > li::before {
                        content: '';
                        position: absolute;
                        left: 0.75rem;
                        top: 0.75em;
                        width: 8px;
                        height: 8px;
                        background: hsl(var(--primary));
                        border-radius: 50%;
                        box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
                      }

                      .premium-docs-content ol {
                        counter-reset: list-counter;
                      }

                      .premium-docs-content ol > li {
                        counter-increment: list-counter;
                      }

                      .premium-docs-content ol > li::before {
                        content: counter(list-counter);
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 2rem;
                        height: 2rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7));
                        color: white;
                        border-radius: 50%;
                        font-size: 0.875rem;
                        font-weight: 600;
                      }

                      .premium-docs-content blockquote {
                        margin: 2.5rem 0;
                        padding: 1.75rem 2rem;
                        border-left: 4px solid hsl(var(--primary));
                        background: linear-gradient(to right, hsl(var(--primary) / 0.05), transparent);
                        border-radius: 0 0.75rem 0.75rem 0;
                        font-style: italic;
                        font-size: 1.125rem;
                        line-height: 1.8;
                      }

                      .premium-docs-content table {
                        width: 100%;
                        margin: 3rem 0;
                        border-collapse: separate;
                        border-spacing: 0;
                        border-radius: 1rem;
                        overflow: hidden;
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                      }

                      .premium-docs-content thead {
                        background: linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05));
                      }

                      .premium-docs-content th {
                        padding: 1.25rem 1.5rem;
                        text-align: left;
                        font-weight: 700;
                        font-size: 1rem;
                        color: hsl(var(--foreground));
                        border-bottom: 2px solid hsl(var(--primary) / 0.2);
                      }

                      .premium-docs-content td {
                        padding: 1.25rem 1.5rem;
                        border-bottom: 1px solid hsl(var(--border));
                        font-size: 1rem;
                        line-height: 1.6;
                      }

                      .premium-docs-content tbody tr {
                        transition: background-color 0.2s;
                      }

                      .premium-docs-content tbody tr:hover {
                        background: hsl(var(--primary) / 0.03);
                      }

                      .premium-docs-content hr {
                        margin: 4rem 0;
                        border: none;
                        height: 1px;
                        background: linear-gradient(to right, transparent, hsl(var(--border)), transparent);
                      }

                      .premium-docs-content img {
                        margin: 3rem 0;
                        border-radius: 1rem;
                        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                        border: 1px solid hsl(var(--border));
                      }

                      .premium-docs-content input[type="checkbox"] {
                        width: 1.25rem;
                        height: 1.25rem;
                        margin-right: 0.75rem;
                        accent-color: hsl(var(--primary));
                        cursor: pointer;
                      }

                      /* Callout boxes */
                      .premium-docs-content .callout {
                        margin: 2.5rem 0;
                        padding: 1.75rem 2rem;
                        border-radius: 0.75rem;
                        border-left: 4px solid;
                        display: flex;
                        gap: 1rem;
                        align-items: flex-start;
                      }

                      .premium-docs-content .callout-info {
                        background: linear-gradient(to right, hsl(221 83% 53% / 0.05), transparent);
                        border-left-color: hsl(221 83% 53%);
                      }

                      .premium-docs-content .callout-tip {
                        background: linear-gradient(to right, hsl(142 76% 36% / 0.05), transparent);
                        border-left-color: hsl(142 76% 36%);
                      }

                      .premium-docs-content .callout-warning {
                        background: linear-gradient(to right, hsl(38 92% 50% / 0.05), transparent);
                        border-left-color: hsl(38 92% 50%);
                      }
                    `}</style>

                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeHighlight]}
                      components={{
                        h1: ({ children, ...props }) => {
                          const id = `heading-${headings.findIndex(h => h.text === String(children).replace(/[📚🎯✅⚡🔒💾📊👥💻⚙️📖🚀]/g, '').trim())}`;
                          return (
                            <h1 id={id} {...props}>
                              <Sparkles className="h-12 w-12 text-primary flex-shrink-0" />
                              {children}
                            </h1>
                          );
                        },
                        h2: ({ children, ...props }) => {
                          const id = `heading-${headings.findIndex(h => h.text === String(children).replace(/[📚🎯✅⚡🔒💾📊👥💻⚙️📖🚀]/g, '').trim())}`;
                          return <h2 id={id} {...props}>{children}</h2>;
                        },
                        h3: ({ children, ...props }) => {
                          const id = `heading-${headings.findIndex(h => h.text === String(children).replace(/[📚🎯✅⚡🔒💾📊👥💻⚙️📖🚀]/g, '').trim())}`;
                          return <h3 id={id} {...props}>{children}</h3>;
                        },
                        code: ({ inline, className, children, ...props }: any) => {
                          const code = String(children).replace(/\n$/, '');
                          if (inline) {
                            return <code className={className} {...props}>{children}</code>;
                          }
                          return (
                            <div className="relative group my-8">
                              <div className="absolute top-0 right-0 m-4 z-10">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                                  onClick={() => copyCode(code)}
                                >
                                  {copiedCode === code ? (
                                    <>
                                      <Check className="h-3 w-3 mr-2" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3 mr-2" />
                                      Copy
                                    </>
                                  )}
                                </Button>
                              </div>
                              <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 rounded-t-xl border-b border-slate-600">
                                <span className="text-sm font-mono text-slate-300 font-medium">
                                  {className?.replace('language-', '').toUpperCase() || 'CODE'}
                                </span>
                              </div>
                              <div className="p-6 overflow-x-auto bg-slate-900">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </div>
                            </div>
                          );
                        },
                        blockquote: ({ children }) => {
                          const text = String(children);
                          let type = 'info';
                          let Icon = Info;
                          
                          if (text.toLowerCase().includes('tip') || text.toLowerCase().includes('💡')) {
                            type = 'tip';
                            Icon = Lightbulb;
                          } else if (text.toLowerCase().includes('warning') || text.toLowerCase().includes('⚠')) {
                            type = 'warning';
                            Icon = AlertTriangle;
                          } else if (text.toLowerCase().includes('success') || text.toLowerCase().includes('✅')) {
                            type = 'success';
                            Icon = CheckCircle2;
                          }
                          
                          return (
                            <div className={`callout callout-${type}`}>
                              <Icon className="h-6 w-6 flex-shrink-0 mt-1" />
                              <div className="flex-1">{children}</div>
                            </div>
                          );
                        },
                        input: ({ checked, ...props }) => {
                          if (props.type === 'checkbox') {
                            return <input {...props} type="checkbox" checked={checked} readOnly />;
                          }
                          return <input {...props} />;
                        },
                        a: ({ href, children }) => {
                          // Check if it's an internal documentation link
                          if (href?.endsWith('.md')) {
                            return (
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  // Extract just the filename
                                  const filename = href.split('/').pop() || href;
                                  // Reload with the new file
                                  window.dispatchEvent(new CustomEvent('openDoc', { detail: filename }));
                                }}
                                className="inline-flex items-center gap-1 group cursor-pointer"
                              >
                                {children}
                                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            );
                          }
                          // External links
                          return (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {highlightedContent}
                    </ReactMarkdown>

                    {/* End Badge */}
                    <div className="mt-24 pt-12 border-t-2 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="px-6 py-3 text-base">
                          <BookOpen className="h-4 w-4 mr-2" />
                          End of document
                        </Badge>
                        <Button variant="outline" size="lg" onClick={onClose}>
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back to Knowledge Base
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </Card>

        {/* Premium Table of Contents Sidebar */}
        {showToc && !loading && !error && headings.length > 0 && (
          <Card className="hidden lg:block w-80 shadow-2xl border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-br from-primary/5 to-transparent">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Menu className="h-5 w-5 text-primary" />
                Table of Contents
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {headings.length} sections
              </p>
            </div>
            <ScrollArea className="h-[calc(95vh-100px)]">
              <nav className="p-4 space-y-1">
                {headings.map((heading, index) => (
                  <button
                    key={index}
                    onClick={() => scrollToHeading(heading.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg transition-all text-sm group hover:bg-primary/10",
                      heading.level === 1 && "font-semibold text-base",
                      heading.level === 2 && "pl-6 font-medium",
                      heading.level === 3 && "pl-10 text-muted-foreground",
                      activeHeading === heading.id && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <ChevronRight className={cn(
                        "h-3 w-3 transition-transform",
                        activeHeading === heading.id && "rotate-90 text-primary"
                      )} />
                      {heading.text}
                    </span>
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  );
}
