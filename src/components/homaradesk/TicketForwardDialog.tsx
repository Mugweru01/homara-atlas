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
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { useAdmin } from '@/hooks/useAdmin';

interface TicketForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: {
    id: string;
    ticket_number: string;
    title: string;
    description: string;
  };
  onForwardComplete: () => void;
}

export function TicketForwardDialog({
  open,
  onOpenChange,
  ticket,
  onForwardComplete,
}: TicketForwardDialogProps) {
  const { user } = useAdmin();
  const [form, setForm] = useState({
    to_email: '',
    cc_emails: '',
    bcc_emails: '',
    subject: `Fwd: ${ticket.ticket_number} - ${ticket.title}`,
    message: '',
  });
  const [loading, setLoading] = useState(false);

  const handleForward = async () => {
    if (!form.to_email.trim()) {
      toast.error('Error', {
        description: 'Recipient email is required',
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

      // Create email message record
      const { error } = await supabase
        .from('homaradesk_email_messages')
        .insert({
          ticket_id: ticket.id,
          to_email: form.to_email,
          cc_emails: form.cc_emails.split(',').map(e => e.trim()).filter(Boolean),
          bcc_emails: form.bcc_emails.split(',').map(e => e.trim()).filter(Boolean),
          subject: form.subject,
          body_text: form.message || `Forwarded ticket: ${ticket.ticket_number}\n\n${ticket.description}`,
          direction: 'outbound',
          status: 'pending',
        });

      if (error) throw error;

      // Add comment to ticket
      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .single();

      await supabase
        .from('homaradesk_ticket_comments')
        .insert({
          ticket_id: ticket.id,
          content: `Ticket forwarded to ${form.to_email}${form.cc_emails ? ` (CC: ${form.cc_emails})` : ''}`,
          author_type: 'admin',
          author_id: admin?.id || null,
          is_internal: true,
        });

      toast.success('Success', {
        description: 'Ticket forwarded successfully',
      });

      onForwardComplete();
      onOpenChange(false);
      setForm({
        to_email: '',
        cc_emails: '',
        bcc_emails: '',
        subject: `Fwd: ${ticket.ticket_number} - ${ticket.title}`,
        message: '',
      });
    } catch (error: any) {
      logger.error('Error forwarding ticket:', error);
      toast.error('Error', {
        description: error.message || 'Failed to forward ticket',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Forward Ticket
          </DialogTitle>
          <DialogDescription>
            Forward ticket <strong>{ticket.ticket_number}</strong> to an external email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>To Email *</Label>
            <Input
              type="email"
              value={form.to_email}
              onChange={(e) => setForm((prev) => ({ ...prev, to_email: e.target.value }))}
              placeholder="recipient@example.com"
              required
            />
          </div>

          <div>
            <Label>CC (comma-separated)</Label>
            <Input
              type="text"
              value={form.cc_emails}
              onChange={(e) => setForm((prev) => ({ ...prev, cc_emails: e.target.value }))}
              placeholder="cc1@example.com, cc2@example.com"
            />
          </div>

          <div>
            <Label>BCC (comma-separated)</Label>
            <Input
              type="text"
              value={form.bcc_emails}
              onChange={(e) => setForm((prev) => ({ ...prev, bcc_emails: e.target.value }))}
              placeholder="bcc@example.com"
            />
          </div>

          <div>
            <Label>Subject *</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Optional message to include with the forwarded ticket"
              rows={5}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleForward} disabled={loading || !form.to_email.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Forwarding...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Forward Ticket
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

