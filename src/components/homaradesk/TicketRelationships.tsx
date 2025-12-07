import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Link2, Plus, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';

interface Relationship {
  id: string;
  source_ticket_id: string;
  target_ticket_id: string;
  relationship_type: string;
  target_ticket_number?: string;
  target_title?: string;
}

interface TicketRelationshipsProps {
  ticketId: string;
}

export function TicketRelationships({ ticketId }: TicketRelationshipsProps) {
  const navigate = useNavigate();
  const { user } = useAdmin();
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetTicketSearch, setTargetTicketSearch] = useState('');
  const [targetTicketId, setTargetTicketId] = useState('');
  const [targetTicket, setTargetTicket] = useState<any>(null);
  const [relationshipType, setRelationshipType] = useState('related');

  useEffect(() => {
    fetchRelationships();
  }, [ticketId]);

  const fetchRelationships = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_ticket_relationships')
        .select('*')
        .or(`source_ticket_id.eq.${ticketId},target_ticket_id.eq.${ticketId}`);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setRelationships([]);
          return;
        }
        throw error;
      }

      // Fetch ticket details for related tickets
      const ticketIds = [
        ...(data || []).map((r: any) => r.source_ticket_id),
        ...(data || []).map((r: any) => r.target_ticket_id),
      ].filter(id => id !== ticketId);

      if (ticketIds.length > 0) {
        const { data: tickets } = await supabase
          .from('homaradesk_tickets')
          .select('id, ticket_number, title')
          .in('id', ticketIds);

        const ticketsMap = new Map((tickets || []).map((t: any) => [t.id, t]));

        const processed = (data || []).map((rel: any) => {
          const relatedTicketId = rel.source_ticket_id === ticketId
            ? rel.target_ticket_id
            : rel.source_ticket_id;
          const ticket = ticketsMap.get(relatedTicketId);
          return {
            ...rel,
            target_ticket_number: ticket?.ticket_number,
            target_title: ticket?.title,
          };
        });

        setRelationships(processed);
      } else {
        setRelationships(data || []);
      }
    } catch (error: any) {
      logger.error('Error fetching relationships:', error);
      toast.error('Error', {
        description: 'Failed to fetch relationships',
      });
    } finally {
      setLoading(false);
    }
  };

  const searchTickets = async () => {
    if (targetTicketSearch.length < 3) {
      setTargetTicket(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('homaradesk_tickets')
        .select('id, ticket_number, title')
        .or(`ticket_number.ilike.%${targetTicketSearch}%,title.ilike.%${targetTicketSearch}%`)
        .neq('id', ticketId)
        .limit(10);

      if (error) throw error;

      if (data && data.length > 0) {
        setTargetTicket(data[0]);
        setTargetTicketId(data[0].id);
      } else {
        setTargetTicket(null);
      }
    } catch (error: any) {
      logger.error('Error searching tickets:', error);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (targetTicketSearch) searchTickets();
    }, 500);
    return () => clearTimeout(timeout);
  }, [targetTicketSearch]);

  const handleCreateRelationship = async () => {
    if (!targetTicketId) {
      toast.error('Error', {
        description: 'Please select a target ticket',
      });
      return;
    }

    try {
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

      const { error } = await supabase
        .from('homaradesk_ticket_relationships')
        .insert({
          source_ticket_id: ticketId,
          target_ticket_id: targetTicketId,
          relationship_type: relationshipType,
          created_by: admin?.id || null,
        });

      if (error) throw error;

      toast.success('Success', {
        description: 'Relationship created',
      });

      setDialogOpen(false);
      setTargetTicketSearch('');
      setTargetTicketId('');
      setTargetTicket(null);
      fetchRelationships();
    } catch (error: any) {
      logger.error('Error creating relationship:', error);
      toast.error('Error', {
        description: error.message || 'Failed to create relationship',
      });
    }
  };

  const handleDeleteRelationship = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this relationship?')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_ticket_relationships')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Success', {
        description: 'Relationship removed',
      });

      fetchRelationships();
    } catch (error: any) {
      logger.error('Error deleting relationship:', error);
      toast.error('Error', {
        description: 'Failed to remove relationship',
      });
    }
  };

  const getRelationshipLabel = (type: string) => {
    const labels: Record<string, string> = {
      parent: 'Parent Ticket',
      child: 'Child Ticket',
      related: 'Related',
      duplicate: 'Duplicate',
      blocked_by: 'Blocked By',
      blocks: 'Blocks',
      follows_up: 'Follows Up',
      followed_by: 'Followed By',
    };
    return labels[type] || type;
  };

  const getRelationshipBadgeVariant = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      parent: 'default',
      child: 'secondary',
      related: 'outline',
      duplicate: 'destructive',
      blocked_by: 'destructive',
      blocks: 'destructive',
      follows_up: 'outline',
      followed_by: 'outline',
    };
    return variants[type] || 'outline';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Relationships
            </CardTitle>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Relationship
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : relationships.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No relationships</p>
            </div>
          ) : (
            <div className="space-y-2">
              {relationships.map((rel) => (
                <div
                  key={rel.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={getRelationshipBadgeVariant(rel.relationship_type)}>
                      {getRelationshipLabel(rel.relationship_type)}
                    </Badge>
                    <div>
                      <div className="font-medium">
                        {rel.target_ticket_number || 'Unknown Ticket'}
                      </div>
                      {rel.target_title && (
                        <div className="text-sm text-muted-foreground truncate max-w-md">
                          {rel.target_title}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rel.target_ticket_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/homaradesk/tickets/${rel.target_ticket_id}`)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRelationship(rel.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Relationship Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Relationship</DialogTitle>
            <DialogDescription>
              Link this ticket to another ticket
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Relationship Type</Label>
              <Select value={relationshipType} onValueChange={setRelationshipType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="related">Related</SelectItem>
                  <SelectItem value="parent">Parent Ticket</SelectItem>
                  <SelectItem value="child">Child Ticket</SelectItem>
                  <SelectItem value="duplicate">Duplicate</SelectItem>
                  <SelectItem value="blocked_by">Blocked By</SelectItem>
                  <SelectItem value="blocks">Blocks</SelectItem>
                  <SelectItem value="follows_up">Follows Up</SelectItem>
                  <SelectItem value="followed_by">Followed By</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Target Ticket</Label>
              <Input
                placeholder="Search by ticket number or title..."
                value={targetTicketSearch}
                onChange={(e) => setTargetTicketSearch(e.target.value)}
              />
              {targetTicket && (
                <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-md">
                  <div className="font-medium text-primary">{targetTicket.ticket_number}</div>
                  <div className="text-sm text-muted-foreground">{targetTicket.title}</div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRelationship} disabled={!targetTicketId}>
              Add Relationship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

