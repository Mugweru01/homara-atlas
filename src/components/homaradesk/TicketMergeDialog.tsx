import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { GitMerge, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
}

interface TicketMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTicket: Ticket;
  onMergeComplete: () => void;
}

export function TicketMergeDialog({
  open,
  onOpenChange,
  sourceTicket,
  onMergeComplete,
}: TicketMergeDialogProps) {
  const [targetTicketId, setTargetTicketId] = useState('');
  const [targetTicket, setTargetTicket] = useState<Ticket | null>(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Ticket[]>([]);
  const [mergeReason, setMergeReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (ticketSearch.length >= 3) {
      searchTickets();
    } else {
      setSearchResults([]);
    }
  }, [ticketSearch]);

  const searchTickets = async () => {
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('homaradesk_tickets')
        .select('id, ticket_number, title, status')
        .or(`ticket_number.ilike.%${ticketSearch}%,title.ilike.%${ticketSearch}%`)
        .neq('id', sourceTicket.id)
        .is('merged_into_ticket_id', null) // Don't show already merged tickets
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error: any) {
      logger.error('Error searching tickets:', error);
      toast.error('Error', {
        description: 'Failed to search tickets',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleMerge = async () => {
    if (!targetTicketId) {
      toast.error('Error', {
        description: 'Please select a target ticket',
      });
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('merge_tickets', {
        p_source_ticket_id: sourceTicket.id,
        p_target_ticket_id: targetTicketId,
        p_merge_reason: mergeReason || null,
      });

      if (error) throw error;

      toast.success('Success', {
        description: `Ticket ${sourceTicket.ticket_number} merged into ${targetTicket?.ticket_number}`,
      });

      onMergeComplete();
      onOpenChange(false);
      setTargetTicketId('');
      setTargetTicket(null);
      setTicketSearch('');
      setMergeReason('');
    } catch (error: any) {
      logger.error('Error merging tickets:', error);
      toast.error('Error', {
        description: error.message || 'Failed to merge tickets',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = (ticket: Ticket) => {
    setTargetTicketId(ticket.id);
    setTargetTicket(ticket);
    setTicketSearch(ticket.ticket_number);
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Merge Tickets
          </DialogTitle>
          <DialogDescription>
            Merge ticket <strong>{sourceTicket.ticket_number}</strong> into another ticket.
            All comments, attachments, and history will be moved to the target ticket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Source Ticket</Label>
            <div className="p-3 bg-muted rounded-md">
              <div className="font-medium">{sourceTicket.ticket_number}</div>
              <div className="text-sm text-muted-foreground">{sourceTicket.title}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Target Ticket *</Label>
            <div className="relative">
              <Input
                placeholder="Search by ticket number or title..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
              />
              {searching && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {searchResults.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-2 hover:bg-accent cursor-pointer"
                      onClick={() => handleSelectTicket(ticket)}
                    >
                      <div className="font-medium">{ticket.ticket_number}</div>
                      <div className="text-sm text-muted-foreground truncate">{ticket.title}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {targetTicket && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                <div className="font-medium text-primary">{targetTicket.ticket_number}</div>
                <div className="text-sm text-muted-foreground">{targetTicket.title}</div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Merge Reason (Optional)</Label>
            <Textarea
              placeholder="Why are you merging these tickets?"
              value={mergeReason}
              onChange={(e) => setMergeReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> This action cannot be undone. The source ticket will be closed
              and all its data will be moved to the target ticket.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={loading || !targetTicketId}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge className="mr-2 h-4 w-4" />
                Merge Tickets
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

