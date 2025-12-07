import { useState } from 'react';
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
import { Split, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { useAdmin } from '@/hooks/useAdmin';

interface TicketSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTicket: {
    id: string;
    ticket_number: string;
    title: string;
  };
  onSplitComplete: () => void;
}

export function TicketSplitDialog({
  open,
  onOpenChange,
  sourceTicket,
  onSplitComplete,
}: TicketSplitDialogProps) {
  const { user } = useAdmin();
  const [splitTickets, setSplitTickets] = useState([
    { title: '', description: '' },
  ]);
  const [loading, setLoading] = useState(false);

  const addSplitTicket = () => {
    setSplitTickets([...splitTickets, { title: '', description: '' }]);
  };

  const removeSplitTicket = (index: number) => {
    setSplitTickets(splitTickets.filter((_, i) => i !== index));
  };

  const updateSplitTicket = (index: number, field: string, value: string) => {
    setSplitTickets(
      splitTickets.map((ticket, i) =>
        i === index ? { ...ticket, [field]: value } : ticket
      )
    );
  };

  const handleSplit = async () => {
    if (splitTickets.length === 0 || splitTickets.some(t => !t.title.trim())) {
      toast.error('Error', {
        description: 'All split tickets must have a title',
      });
      return;
    }

    try {
      setLoading(true);
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

      // Get source ticket details
      const { data: sourceTicketData } = await supabase
        .from('homaradesk_tickets')
        .select('*')
        .eq('id', sourceTicket.id)
        .single();

      if (!sourceTicketData) {
        throw new Error('Source ticket not found');
      }

      // Create new tickets from split
      const newTickets = [];
      for (const splitTicket of splitTickets) {
        const { data: newTicket, error } = await supabase
          .from('homaradesk_tickets')
          .insert({
            title: splitTicket.title,
            description: splitTicket.description || `Split from ticket ${sourceTicket.ticket_number}`,
            ticket_type: sourceTicketData.ticket_type,
            category: sourceTicketData.category,
            priority: sourceTicketData.priority,
            requester_id: sourceTicketData.requester_id,
            requester_email: sourceTicketData.requester_email,
            requester_name: sourceTicketData.requester_name,
            assignee_id: sourceTicketData.assignee_id,
            source: 'split',
            created_by: admin?.id || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Create relationship
        await supabase
          .from('homaradesk_ticket_relationships')
          .insert({
            source_ticket_id: sourceTicket.id,
            target_ticket_id: newTicket.id,
            relationship_type: 'child',
            created_by: admin?.id || null,
          });

        newTickets.push(newTicket);
      }

      // Add comment to source ticket
      await supabase
        .from('homaradesk_ticket_comments')
        .insert({
          ticket_id: sourceTicket.id,
          content: `Ticket split into ${splitTickets.length} tickets: ${newTickets.map(t => t.ticket_number).join(', ')}`,
          author_type: 'admin',
          author_id: admin?.id || null,
          is_internal: true,
        });

      toast.success('Success', {
        description: `Ticket split into ${splitTickets.length} tickets`,
      });

      onSplitComplete();
      onOpenChange(false);
      setSplitTickets([{ title: '', description: '' }]);
    } catch (error: any) {
      logger.error('Error splitting ticket:', error);
      toast.error('Error', {
        description: error.message || 'Failed to split ticket',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5" />
            Split Ticket
          </DialogTitle>
          <DialogDescription>
            Split ticket <strong>{sourceTicket.ticket_number}</strong> into multiple tickets.
            Each split ticket will be linked to the original as a child ticket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-md">
            <div className="font-medium">Source Ticket</div>
            <div className="text-sm text-muted-foreground">{sourceTicket.title}</div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Split Tickets</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSplitTicket}>
                <Plus className="h-4 w-4 mr-2" />
                Add Ticket
              </Button>
            </div>

            {splitTickets.map((ticket, index) => (
              <div key={index} className="p-4 border rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Ticket {index + 1}</Label>
                  {splitTickets.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSplitTicket(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={ticket.title}
                    onChange={(e) => updateSplitTicket(index, 'title', e.target.value)}
                    placeholder="Enter ticket title"
                    required
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={ticket.description}
                    onChange={(e) => updateSplitTicket(index, 'description', e.target.value)}
                    placeholder="Enter ticket description"
                    rows={3}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSplit} disabled={loading || splitTickets.length === 0}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Splitting...
              </>
            ) : (
              <>
                <Split className="mr-2 h-4 w-4" />
                Split Ticket
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

