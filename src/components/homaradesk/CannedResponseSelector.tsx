import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

interface CannedResponseSelectorProps {
  onSelect: (content: string) => void;
  ticketType?: string;
  category?: string;
}

export function CannedResponseSelector({
  onSelect,
  ticketType,
  category,
}: CannedResponseSelectorProps) {
  const [open, setOpen] = useState(false);
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchResponses();
    }
  }, [open, ticketType, category]);

  const fetchResponses = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('homaradesk_canned_responses')
        .select('*')
        .order('usage_count', { ascending: false })
        .limit(50);

      // Filter by category if provided
      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

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
        description: 'Failed to load canned responses',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (response: CannedResponse) => {
    try {
      // Increment usage
      await supabase.rpc('increment_canned_response_usage', {
        p_response_id: response.id,
      });

      onSelect(response.content);
      setOpen(false);
    } catch (error: any) {
      logger.error('Error incrementing usage:', error);
      // Still select the response even if usage increment fails
      onSelect(response.content);
      setOpen(false);
    }
  };

  const filteredResponses = responses.filter((response) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      response.title.toLowerCase().includes(searchLower) ||
      response.content.toLowerCase().includes(searchLower) ||
      response.category?.toLowerCase().includes(searchLower)
    );
  });

  const categories = [...new Set(responses.map((r) => r.category).filter(Boolean))];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Canned Response
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search responses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No canned responses found</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {categories.length > 0 && !search && (
                <>
                  {categories.map((cat) => {
                    const categoryResponses = filteredResponses.filter((r) => r.category === cat);
                    if (categoryResponses.length === 0) return null;
                    return (
                      <div key={cat} className="mb-4">
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                          {cat}
                        </div>
                        {categoryResponses.map((response) => (
                          <div
                            key={response.id}
                            className="p-2 rounded-md hover:bg-accent cursor-pointer"
                            onClick={() => handleSelect(response)}
                          >
                            <div className="font-medium text-sm">{response.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {response.content}
                            </div>
                            {response.tags && response.tags.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {response.tags.slice(0, 2).map((tag, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
              {(!categories.length || search) && (
                <>
                  {filteredResponses.map((response) => (
                    <div
                      key={response.id}
                      className="p-2 rounded-md hover:bg-accent cursor-pointer"
                      onClick={() => handleSelect(response)}
                    >
                      <div className="font-medium text-sm">{response.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {response.content}
                      </div>
                      {response.category && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {response.category}
                        </Badge>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

