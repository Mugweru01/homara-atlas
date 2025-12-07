import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft,
  RefreshCw,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Paperclip,
  Send,
  Edit,
  Save,
  X,
  UserPlus,
  Tag,
  Link as LinkIcon,
  ExternalLink,
  Users,
  Wrench,
  Scale,
  GitMerge,
  Split,
  Link2,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from 'sonner';
import { TicketMergeDialog } from '@/components/homaradesk/TicketMergeDialog';
import { TicketSplitDialog } from '@/components/homaradesk/TicketSplitDialog';
import { TicketForwardDialog } from '@/components/homaradesk/TicketForwardDialog';
import { TicketRelationships } from '@/components/homaradesk/TicketRelationships';
import { TicketWatchers } from '@/components/homaradesk/TicketWatchers';
import { TimeTracking } from '@/components/homaradesk/TimeTracking';
import { CannedResponseSelector } from '@/components/homaradesk/CannedResponseSelector';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  ticket_type: string;
  category?: string;
  priority: string;
  status: string;
  requester_id?: string;
  requester_name?: string;
  requester_email?: string;
  assignee_id?: string;
  assignee_name?: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  first_response_due_at?: string;
  resolution_due_at?: string;
  first_response_at?: string;
  resolved_at?: string;
  tags?: string[];
  internal_notes?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  crm_contact_id?: string;
  total_time_spent_minutes?: number;
  billable_time_minutes?: number;
  merged_into_ticket_id?: string;
}

interface Comment {
  id: string;
  ticket_id: string;
  content: string;
  author_id?: string;
  author_type: string;
  author_name?: string;
  is_internal: boolean;
  created_at: string;
  edited?: boolean;
}

interface History {
  id: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  performed_by_type: string;
  performed_at: string;
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [editingTicket, setEditingTicket] = useState(false);
  const [editForm, setEditForm] = useState({
    status: '',
    priority: '',
    assignee_id: '',
  });
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [relationshipsDialogOpen, setRelationshipsDialogOpen] = useState(false);
  const [disposition, setDisposition] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    if (id) {
      fetchTicketData();
    }
  }, [id]);

  const fetchTicketData = async () => {
    try {
      setLoading(true);
      
      // Fetch ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from('homaradesk_tickets')
        .select('*')
        .eq('id', id)
        .single();

      if (ticketError) {
        if (ticketError.code === '42P01' || ticketError.code === 'PGRST116' || 
            ticketError.message?.includes('does not exist') || ticketError.message?.includes('schema cache')) {
          setTicket(null);
          return;
        }
        throw ticketError;
      }

      if (!ticketData) {
        setTicket(null);
        return;
      }

      // Fetch requester and assignee names
      const requesterId = ticketData.requester_id;
      const assigneeId = ticketData.assignee_id;
      
      let requesterName = ticketData.requester_name;
      let assigneeName = null;

      if (requesterId) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', requesterId)
            .single();
          if (profile) {
            requesterName = profile.full_name;
          }
        } catch (e) {
          // Ignore
        }
      }

      if (assigneeId) {
        try {
          const { data: admin } = await supabase
            .from('admins')
            .select('id, user_id')
            .eq('id', assigneeId)
            .single();
          if (admin) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', admin.user_id)
              .single();
            if (profile) {
              assigneeName = profile.full_name;
            }
          }
        } catch (e) {
          // Ignore
        }
      }

      setTicket({
        ...ticketData,
        requester_name: requesterName,
        assignee_name: assigneeName,
      });

      setEditForm({
        status: ticketData.status,
        priority: ticketData.priority,
        assignee_id: ticketData.assignee_id || '',
      });

      // Set internal notes and disposition
      setInternalNotes(ticketData.internal_notes || '');
      setDisposition(ticketData.disposition || 'none');

      // Fetch comments
      const { data: commentsData } = await supabase
        .from('homaradesk_ticket_comments')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true });

      if (commentsData) {
        // Fetch comment author names
        const authorIds = [...new Set(commentsData.map((c: any) => c.author_id).filter(Boolean))];
        const authorsMap = new Map();
        
        if (authorIds.length > 0) {
          // Get profiles for all authors
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, display_name')
            .in('id', authorIds);
          
          if (profiles) {
            profiles.forEach((p: any) => {
              authorsMap.set(p.id, p.display_name || p.full_name || 'Unknown');
            });
          }

          // For any missing names, try to get from admins table
          const missingIds = authorIds.filter(id => !authorsMap.has(id));
          if (missingIds.length > 0) {
            const { data: admins } = await supabase
              .from('admins')
              .select('user_id')
              .in('user_id', missingIds);
            
            if (admins) {
              const adminUserIds = admins.map(a => a.user_id);
              const { data: adminProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, display_name')
                .in('id', adminUserIds);
              
              if (adminProfiles) {
                adminProfiles.forEach((p: any) => {
                  if (!authorsMap.has(p.id)) {
                    authorsMap.set(p.id, p.display_name || p.full_name || 'Admin');
                  }
                });
              }
            }
          }
        }

        const processedComments = commentsData.map((comment: any) => ({
          ...comment,
          author_name: comment.author_id ? (authorsMap.get(comment.author_id) || 'Unknown') : (comment.author_name || 'Unknown'),
        }));

        setComments(processedComments);
      }

      // Fetch history
      const { data: historyData } = await supabase
        .from('homaradesk_ticket_history')
        .select('*')
        .eq('ticket_id', id)
        .order('performed_at', { ascending: false })
        .limit(50);

      if (historyData) {
        setHistory(historyData);
      }

      // Fetch available admins for assignment
      const { data: adminsData } = await supabase
        .from('admins')
        .select('id, user_id, status')
        .eq('status', 'active');

      if (adminsData) {
        const adminUserIds = adminsData.map((a: any) => a.user_id);
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', adminUserIds);

        if (adminProfiles) {
          const adminIdToUserId = new Map(adminsData.map((a: any) => [a.user_id, a.id]));
          const adminsWithNames = adminProfiles.map((p: any) => {
            const adminId = adminIdToUserId.get(p.id);
            return {
              id: adminId,
              name: p.full_name,
            };
          }).filter((a: any) => a.id);

          setAvailableAdmins(adminsWithNames);
        }
      }
    } catch (error: any) {
      logger.error('Error fetching ticket data:', error);
      console.error('Ticket fetch error:', error);
      toast.error('Failed to fetch ticket data', {
        description: error.message || 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentContent.trim() || !ticket) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to add comments');
        return;
      }

      // Check if user is admin
      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      const { data, error } = await supabase
        .from('homaradesk_ticket_comments')
        .insert({
          ticket_id: ticket.id,
          content: commentContent,
          author_id: user.id,
          author_type: admin ? 'admin' : 'user',
          is_internal: isInternalNote,
          is_public: !isInternalNote,
        })
        .select()
        .single();

      if (error) throw error;

      // Get author name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, display_name')
        .eq('id', user.id)
        .single();

      setComments([...comments, {
        ...data,
        author_name: profile?.display_name || profile?.full_name || 'Unknown',
      }]);

      setCommentContent('');
      setIsInternalNote(false);
      
      toast.success('Comment added successfully');

      fetchTicketData(); // Refresh to get updated last_activity_at
    } catch (error: any) {
      logger.error('Error adding comment:', error);
      toast.error('Failed to add comment', {
        description: error.message || 'Unknown error',
      });
    }
  };

  const handleUpdateTicket = async () => {
    if (!ticket) return;

    try {
      const updates: any = {
        status: editForm.status,
        priority: editForm.priority,
      };

      if (editForm.assignee_id !== ticket.assignee_id) {
        updates.assignee_id = editForm.assignee_id || null;
      }

      if (editForm.status === 'resolved' && ticket.status !== 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      if (editForm.status === 'closed' && ticket.status !== 'closed') {
        updates.closed_at = new Date().toISOString();
      }

      if (editForm.status === 'open' && ticket.status !== 'open') {
        updates.resolved_at = null;
        updates.closed_at = null;
      }

      const { error } = await supabase
        .from('homaradesk_tickets')
        .update(updates)
        .eq('id', ticket.id);

      if (error) throw error;

      toast.success('Ticket updated successfully');

      setEditingTicket(false);
      fetchTicketData();
    } catch (error: any) {
      logger.error('Error updating ticket:', error);
      toast.error('Failed to update ticket', {
        description: error.message || 'Unknown error',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      open: 'secondary',
      assigned: 'default',
      in_progress: 'default',
      waiting_customer: 'outline',
      resolved: 'default',
      closed: 'secondary',
      cancelled: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'secondary',
      normal: 'default',
      high: 'outline',
      urgent: 'destructive',
      critical: 'destructive',
    };
    return (
      <Badge variant={variants[priority] || 'default'}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const isOverdue = () => {
    if (!ticket) return false;
    if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
    const now = new Date();
    if (ticket.first_response_due_at && new Date(ticket.first_response_due_at) < now) return true;
    if (ticket.resolution_due_at && new Date(ticket.resolution_due_at) < now) return true;
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/homaradesk/tickets')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tickets
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Ticket not found</p>
            <p className="text-sm text-muted-foreground mt-2">
              The ticket you're looking for doesn't exist or has been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/homaradesk/tickets')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{ticket.ticket_number}</h1>
              {isOverdue() && (
                <Badge variant="destructive">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Overdue
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{ticket.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Actions */}
          {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
            <Button
              variant="default"
              onClick={async () => {
                if (!ticket) return;
                try {
                  const { error } = await supabase
                    .from('homaradesk_tickets')
                    .update({
                      status: 'resolved',
                      resolved_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', ticket.id);

                  if (error) throw error;
                  toast.success('Ticket marked as resolved');
                  fetchTicketData();
                } catch (error: any) {
                  toast.error('Failed to resolve ticket', {
                    description: error.message || 'Unknown error',
                  });
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Resolved
            </Button>
          )}
          {ticket.status !== 'closed' && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!ticket) return;
                try {
                  const { error } = await supabase
                    .from('homaradesk_tickets')
                    .update({
                      status: 'closed',
                      closed_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', ticket.id);

                  if (error) throw error;
                  toast.success('Ticket closed');
                  fetchTicketData();
                } catch (error: any) {
                  toast.error('Failed to close ticket', {
                    description: error.message || 'Unknown error',
                  });
                }
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Close Ticket
            </Button>
          )}
          {ticket.status === 'closed' && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!ticket) return;
                try {
                  const { error } = await supabase
                    .from('homaradesk_tickets')
                    .update({
                      status: 'open',
                      closed_at: null,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', ticket.id);

                  if (error) throw error;
                  toast.success('Ticket reopened');
                  fetchTicketData();
                } catch (error: any) {
                  toast.error('Failed to reopen ticket', {
                    description: error.message || 'Unknown error',
                  });
                }
              }}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Reopen
            </Button>
          )}
          <TicketWatchers
            ticketId={ticket.id}
            isWatching={isWatching}
            onWatchChange={setIsWatching}
          />
          <Button variant="outline" size="icon" onClick={fetchTicketData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            onClick={() => setMergeDialogOpen(true)}
            disabled={!!ticket.merged_into_ticket_id}
          >
            <GitMerge className="mr-2 h-4 w-4" />
            Merge
          </Button>
          {!editingTicket ? (
            <Button variant="outline" onClick={() => setEditingTicket(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => {
                setEditingTicket(false);
                setEditForm({
                  status: ticket.status,
                  priority: ticket.priority,
                  assignee_id: ticket.assignee_id || '',
                });
              }}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleUpdateTicket}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          <Tabs defaultValue="comments" className="w-full">
            <TabsList>
              <TabsTrigger value="comments">
                Comments ({comments.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                History ({history.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Add Comment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Textarea
                      placeholder="Add a comment or internal note... Use @username to mention someone"
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CannedResponseSelector
                        onSelect={(content) => setCommentContent(content)}
                        ticketType={ticket.ticket_type}
                        category={ticket.category}
                      />
                      <input
                        type="checkbox"
                        id="internal"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="internal" className="text-sm cursor-pointer">
                        Internal note (not visible to customer)
                      </Label>
                    </div>
                    <Button onClick={handleAddComment} disabled={!commentContent.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      Add Comment
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {comments.map((comment) => (
                  <Card key={comment.id} className={comment.is_internal ? 'border-dashed' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {comment.author_name || 'Unknown'}
                          </span>
                          {comment.is_internal && (
                            <Badge variant="outline" className="text-xs">Internal</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {comment.author_type === 'admin' ? 'Admin' : 'User'}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
                    </CardContent>
                  </Card>
                ))}
                {comments.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No comments yet</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ticket History</CardTitle>
                  <CardDescription>
                    Complete audit trail of all changes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {history.map((item) => (
                      <div key={item.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                        <div className="rounded-full bg-muted p-2">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {item.action.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {item.performed_by_type}
                            </Badge>
                          </div>
                          {item.field_name && (
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">{item.field_name}:</span>{' '}
                              {item.old_value && (
                                <span className="line-through">{item.old_value}</span>
                              )}
                              {item.old_value && item.new_value && ' → '}
                              {item.new_value && <span>{item.new_value}</span>}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(item.performed_at), 'MMM d, yyyy HH:mm:ss')}
                          </div>
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No history available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingTicket ? (
                <>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="assigned">Assigned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting_customer">Waiting Customer</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select
                      value={editForm.priority}
                      onValueChange={(value) => setEditForm({ ...editForm, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assignee</Label>
                    <Select
                      value={editForm.assignee_id}
                      onValueChange={(value) => setEditForm({ ...editForm, assignee_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {availableAdmins.map((admin) => (
                          <SelectItem key={admin.id} value={admin.id}>
                            {admin.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(ticket.status)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <div className="mt-1">{getPriorityBadge(ticket.priority)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <div className="mt-1">
                      <Badge variant="outline">{ticket.ticket_type.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Assignee</Label>
                    <div className="mt-1">
                      {ticket.assignee_name ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{ticket.assignee_name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requester</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {ticket.requester_name || 'Unknown'}
                  </span>
                </div>
                {ticket.requester_email && (
                  <div className="text-sm text-muted-foreground">
                    {ticket.requester_email}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Created</Label>
                <div className="text-sm mt-1">
                  {format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Last Activity</Label>
                <div className="text-sm mt-1">
                  {format(new Date(ticket.last_activity_at), 'MMM d, yyyy HH:mm')}
                </div>
              </div>
              {ticket.first_response_due_at && (
                <div>
                  <Label className="text-xs text-muted-foreground">First Response Due</Label>
                  <div className={`text-sm mt-1 ${isOverdue() ? 'text-destructive' : ''}`}>
                    {format(new Date(ticket.first_response_due_at), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              )}
              {ticket.resolution_due_at && (
                <div>
                  <Label className="text-xs text-muted-foreground">Resolution Due</Label>
                  <div className={`text-sm mt-1 ${isOverdue() ? 'text-destructive' : ''}`}>
                    {format(new Date(ticket.resolution_due_at), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              )}
              {ticket.resolved_at && (
                <div>
                  <Label className="text-xs text-muted-foreground">Resolved</Label>
                  <div className="text-sm mt-1">
                    {format(new Date(ticket.resolved_at), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CRM Integration */}
          {ticket.crm_contact_id && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  CRM Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/crm/contacts/${ticket.crm_contact_id}`)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in CRM
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notes and Disposition */}
          <Card>
            <CardHeader>
              <CardTitle>Notes & Disposition</CardTitle>
              <CardDescription>
                Internal notes and resolution disposition
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="internal-notes">Internal Notes</Label>
                <Textarea
                  id="internal-notes"
                  placeholder="Add notes about what the customer was talking about..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  These notes are only visible to agents, not customers
                </p>
              </div>
              <div>
                <Label htmlFor="disposition">Disposition</Label>
                <Select
                  value={disposition || undefined}
                  onValueChange={(value) => setDisposition(value === 'none' ? '' : value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select disposition..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="solved">Solved</SelectItem>
                    <SelectItem value="not_solved">Not Solved</SelectItem>
                    <SelectItem value="duplicate">Duplicate</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_response">No Response</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={async () => {
                  if (!ticket) return;
                  try {
                    const { error } = await supabase
                      .from('homaradesk_tickets')
                      .update({
                        internal_notes: internalNotes,
                        disposition: disposition === 'none' || !disposition ? null : disposition,
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', ticket.id);

                    if (error) throw error;

                    toast.success('Notes and disposition updated');

                    fetchTicketData();
                  } catch (error: any) {
                    logger.error('Error updating notes:', error);
                    toast.error('Failed to update notes', {
                      description: error.message || 'Unknown error',
                    });
                  }
                }}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Notes & Disposition
              </Button>
            </CardContent>
          </Card>

          {/* Time Tracking */}
          <TimeTracking
            ticketId={ticket.id}
            totalTimeSpent={ticket.total_time_spent_minutes || 0}
            billableTime={ticket.billable_time_minutes || 0}
          />

          {/* Relationships */}
          <TicketRelationships ticketId={ticket.id} />

          {/* Related Entities */}
          {ticket.related_entity_type && ticket.related_entity_id && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Related Entity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {ticket.related_entity_type === 'dispute' && <Scale className="h-4 w-4 text-muted-foreground" />}
                    {ticket.related_entity_type === 'work_order' && <Wrench className="h-4 w-4 text-muted-foreground" />}
                    <Badge variant="outline">{ticket.related_entity_type.replace('_', ' ')}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (ticket.related_entity_type === 'dispute') {
                        navigate(`/admin/disputes/${ticket.related_entity_id}`);
                      } else if (ticket.related_entity_type === 'work_order') {
                        navigate(`/admin/maintenance/work-orders/${ticket.related_entity_id}`);
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View {ticket.related_entity_type.replace('_', ' ')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {ticket.tags && ticket.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {ticket.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary">
                      <Tag className="mr-1 h-3 w-3" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Merge Dialog */}
      <TicketMergeDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        sourceTicket={{
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          title: ticket.title,
          status: ticket.status,
        }}
        onMergeComplete={() => {
          fetchTicketData();
          navigate('/homaradesk/tickets');
        }}
      />

      {/* Split Dialog */}
      <TicketSplitDialog
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        sourceTicket={{
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          title: ticket.title,
        }}
        onSplitComplete={() => {
          fetchTicketData();
        }}
      />

      {/* Forward Dialog */}
      <TicketForwardDialog
        open={forwardDialogOpen}
        onOpenChange={setForwardDialogOpen}
        ticket={{
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          title: ticket.title,
          description: ticket.description,
        }}
        onForwardComplete={() => {
          fetchTicketData();
        }}
      />
    </div>
  );
}

