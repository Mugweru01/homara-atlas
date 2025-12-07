import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, EyeOff, User, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { useAdmin } from '@/hooks/useAdmin';

interface Watcher {
  id: string;
  admin_id?: string;
  user_id?: string;
  admin_name?: string;
  user_name?: string;
}

interface TicketWatchersProps {
  ticketId: string;
  isWatching: boolean;
  onWatchChange: (watching: boolean) => void;
}

export function TicketWatchers({ ticketId, isWatching, onWatchChange }: TicketWatchersProps) {
  const { user } = useAdmin();
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchWatchers();
  }, [ticketId]);

  const fetchWatchers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_ticket_watchers')
        .select('*')
        .eq('ticket_id', ticketId);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setWatchers([]);
          return;
        }
        throw error;
      }

      // Fetch names
      const adminIds = [...new Set((data || []).map((w: any) => w.admin_id).filter(Boolean))];
      const userIds = [...new Set((data || []).map((w: any) => w.user_id).filter(Boolean))];
      const namesMap = new Map();

      if (adminIds.length > 0) {
        const { data: admins } = await supabase
          .from('admins')
          .select('id, user_id')
          .in('id', adminIds);

        if (admins) {
          const adminUserIds = admins.map((a: any) => a.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', adminUserIds);

          if (profiles) {
            const adminIdToUserId = new Map(admins.map((a: any) => [a.user_id, a.id]));
            profiles.forEach((p: any) => {
              const adminId = adminIdToUserId.get(p.id);
              if (adminId) {
                namesMap.set(adminId, { name: p.full_name, type: 'admin' });
              }
            });
          }
        }
      }

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        if (profiles) {
          profiles.forEach((p: any) => {
            namesMap.set(p.id, { name: p.full_name, type: 'user' });
          });
        }
      }

      const processedWatchers = (data || []).map((watcher: any) => ({
        ...watcher,
        admin_name: watcher.admin_id ? namesMap.get(watcher.admin_id)?.name : null,
        user_name: watcher.user_id ? namesMap.get(watcher.user_id)?.name : null,
      }));

      setWatchers(processedWatchers);

      // Check if current user is watching
      if (user) {
        const { data: admin } = await supabase
          .from('admins')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        const isWatching = processedWatchers.some(
          (w: any) => w.admin_id === admin?.id || w.user_id === user.id
        );
        onWatchChange(isWatching);
      }
    } catch (error: any) {
      logger.error('Error fetching watchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWatch = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error('Error', {
          description: 'You must be logged in',
        });
        return;
      }

      // Get admin ID if user is admin
      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .single();

      if (isWatching) {
        // Unwatch
        let query = supabase
          .from('homaradesk_ticket_watchers')
          .delete()
          .eq('ticket_id', ticketId);

        if (admin) {
          query = query.eq('admin_id', admin.id);
        } else {
          query = query.eq('user_id', authUser.id);
        }

        const { error } = await query;
        if (error) throw error;

        toast.success('Success', {
          description: 'You are no longer watching this ticket',
        });
      } else {
        // Watch
        const { error } = await supabase
          .from('homaradesk_ticket_watchers')
          .insert({
            ticket_id: ticketId,
            admin_id: admin?.id || null,
            user_id: admin ? null : authUser.id,
          });

        if (error) throw error;

        toast.success('Success', {
          description: 'You are now watching this ticket',
        });
      }

      fetchWatchers();
    } catch (error: any) {
      logger.error('Error toggling watch:', error);
      toast.error('Error', {
        description: error.message || 'Failed to update watch status',
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isWatching ? 'default' : 'outline'}
        size="sm"
        onClick={handleToggleWatch}
      >
        {isWatching ? (
          <>
            <EyeOff className="h-4 w-4 mr-2" />
            Unwatch
          </>
        ) : (
          <>
            <Eye className="h-4 w-4 mr-2" />
            Watch
          </>
        )}
      </Button>

      {watchers.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              {watchers.length} {watchers.length === 1 ? 'watcher' : 'watchers'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="end">
            <div className="p-4 border-b">
              <h4 className="font-semibold">Watchers</h4>
              <p className="text-sm text-muted-foreground">
                People watching this ticket
              </p>
            </div>
            <ScrollArea className="h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {watchers.map((watcher) => (
                    <div
                      key={watcher.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-accent"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {watcher.admin_name || watcher.user_name || 'Unknown'}
                        </span>
                        {watcher.admin_id && (
                          <Badge variant="secondary" className="text-xs">
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

