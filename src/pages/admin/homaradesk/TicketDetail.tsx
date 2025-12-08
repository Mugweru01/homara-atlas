import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ArrowLeft,
  RefreshCw,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Send,
  Edit,
  Save,
  X,
  Tag,
  ExternalLink,
  Users,
  Wrench,
  Scale,
  GitMerge,
  Eye,
  TrendingUp,
  Timer,
  Calendar,
  Mail,
  FileText,
  Activity,
  Circle,
  ArrowRight,
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
import { format, formatDistanceToNow } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  disposition?: string;
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

interface TimelineItem {
  id: string;
  type: 'comment' | 'history' | 'created';
  timestamp: string;
  author?: string;
  authorType?: string;
  content?: string;
  action?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  isInternal?: boolean;
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
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
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

      setInternalNotes(ticketData.internal_notes || '');
      setDisposition(ticketData.disposition || '');

      // Fetch comments
      const { data: commentsData } = await supabase
        .from('homaradesk_ticket_comments')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true });

      if (commentsData) {
        const authorIds = [...new Set(commentsData.map((c: any) => c.author_id).filter(Boolean))];
        const authorsMap = new Map();
        
        if (authorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, display_name')
            .in('id', authorIds);
          
          if (profiles) {
            profiles.forEach((p: any) => {
              authorsMap.set(p.id, p.display_name || p.full_name || 'Unknown');
            });
          }

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

      // Fetch available admins
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
      fetchTicketData();
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

  const handleSaveNotes = async (newDisposition?: string, newNotes?: string) => {
    if (!ticket) return;
    try {
      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (newDisposition !== undefined) {
        updates.disposition = newDisposition || null;
      } else {
        updates.disposition = disposition || null;
      }

      if (newNotes !== undefined) {
        updates.internal_notes = newNotes;
      } else {
        updates.internal_notes = internalNotes;
      }

      const { error } = await supabase
        .from('homaradesk_tickets')
        .update(updates)
        .eq('id', ticket.id);

      if (error) throw error;
      toast.success('Notes updated');
      fetchTicketData();
    } catch (error: any) {
      logger.error('Error updating notes:', error);
      toast.error('Failed to update notes', {
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
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      critical: 'bg-red-200 text-red-800 dark:bg-red-950 dark:text-red-200',
    };
    return (
      <Badge className={colors[priority] || colors.normal}>
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

  // Create unified timeline
  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    // Add created event
    if (ticket) {
      items.push({
        id: 'created',
        type: 'created',
        timestamp: ticket.created_at,
      });
    }

    // Add comments
    comments.forEach(comment => {
      items.push({
        id: comment.id,
        type: 'comment',
        timestamp: comment.created_at,
        author: comment.author_name,
        authorType: comment.author_type,
        content: comment.content,
        isInternal: comment.is_internal,
      });
    });

    // Add history
    history.forEach(item => {
      items.push({
        id: item.id,
        type: 'history',
        timestamp: item.performed_at,
        action: item.action,
        fieldName: item.field_name,
        oldValue: item.old_value,
        newValue: item.new_value,
        authorType: item.performed_by_type,
      });
    });

    // Sort by timestamp
    return items.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [ticket, comments, history]);

  // Calculate insights
  const insights = useMemo(() => {
    if (!ticket) return null;

    const created = new Date(ticket.created_at);
    const now = new Date();
    const age = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60)); // hours
    const responseTime = ticket.first_response_at 
      ? Math.floor((new Date(ticket.first_response_at).getTime() - created.getTime()) / (1000 * 60))
      : null;
    const resolutionTime = ticket.resolved_at
      ? Math.floor((new Date(ticket.resolved_at).getTime() - created.getTime()) / (1000 * 60))
      : null;

    return {
      age,
      responseTime,
      resolutionTime,
      commentCount: comments.length,
      publicComments: comments.filter(c => !c.is_internal).length,
      internalComments: comments.filter(c => c.is_internal).length,
    };
  }, [ticket, comments]);

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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-background via-muted/20 to-background border-b">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/homaradesk/tickets')}
                className="mt-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold tracking-tight">{ticket.ticket_number}</h1>
                  {getStatusBadge(ticket.status)}
                  {getPriorityBadge(ticket.priority)}
                  {isOverdue() && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Overdue
                    </Badge>
                  )}
                </div>
                <p className="text-lg text-muted-foreground mb-4">{ticket.title}</p>
                
                {/* Quick Insights */}
                {insights && (
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{insights.age}h old</span>
                    </div>
                    {insights.responseTime !== null && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        <span>First response: {insights.responseTime}m</span>
                      </div>
                    )}
                    {insights.resolutionTime !== null && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle className="h-4 w-4" />
                        <span>Resolved in: {insights.resolutionTime}m</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      <span>{insights.commentCount} comments</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                <Button
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
                  Resolve
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
        </div>
      </div>

      <div className="container mx-auto px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                  {ticket.description}
                </p>
              </CardContent>
            </Card>

            {/* Add Comment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Add Comment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Add a comment or internal note..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CannedResponseSelector
                      onSelect={(content) => setCommentContent(content)}
                      ticketType={ticket.ticket_type}
                      category={ticket.category}
                    />
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-muted-foreground">Internal note</span>
                    </label>
                  </div>
                  <Button onClick={handleAddComment} disabled={!commentContent.trim()}>
                    <Send className="mr-2 h-4 w-4" />
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Unified Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Timeline
                </CardTitle>
                <CardDescription>
                  Complete story of this ticket
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {timeline.map((item, index) => (
                    <div key={item.id} className="relative flex gap-4">
                      {/* Timeline Line */}
                      {index < timeline.length - 1 && (
                        <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
                      )}
                      
                      {/* Avatar/Icon */}
                      <div className="relative z-10">
                        {item.type === 'created' ? (
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Circle className="h-5 w-5 text-primary" fill="currentColor" />
                          </div>
                        ) : item.type === 'comment' ? (
                          <Avatar className="h-10 w-10 border-2 border-background">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {item.author ? getInitials(item.author) : 'U'}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Activity className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-6">
                        {item.type === 'created' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Ticket created</span>
                              <Badge variant="secondary" className="text-xs">
                                {ticket.requester_name || 'Unknown'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(item.timestamp), 'MMM d, yyyy HH:mm')}
                            </p>
                          </div>
                        )}

                        {item.type === 'comment' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{item.author || 'Unknown'}</span>
                              {item.isInternal && (
                                <Badge variant="outline" className="text-xs">Internal</Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {item.authorType === 'admin' ? 'Admin' : 'Customer'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                              </span>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-4">
                              <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.timestamp), 'MMM d, yyyy HH:mm')}
                            </p>
                          </div>
                        )}

                        {item.type === 'history' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {item.action?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {item.authorType}
                              </Badge>
                            </div>
                            {item.fieldName && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">{item.fieldName}:</span>{' '}
                                {item.oldValue && (
                                  <span className="line-through opacity-60">{item.oldValue}</span>
                                )}
                                {item.oldValue && item.newValue && (
                                  <ArrowRight className="inline h-3 w-3 mx-1" />
                                )}
                                {item.newValue && <span>{item.newValue}</span>}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(item.timestamp), 'MMM d, yyyy HH:mm')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {timeline.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No timeline events yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ticket Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingTicket ? (
                  <>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={editForm.status}
                        onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                      >
                        <SelectTrigger className="mt-1">
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
                      <Label className="text-xs">Priority</Label>
                      <Select
                        value={editForm.priority}
                        onValueChange={(value) => setEditForm({ ...editForm, priority: value })}
                      >
                        <SelectTrigger className="mt-1">
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
                      <Label className="text-xs">Assignee</Label>
                      <Select
                        value={editForm.assignee_id}
                        onValueChange={(value) => setEditForm({ ...editForm, assignee_id: value })}
                      >
                        <SelectTrigger className="mt-1">
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
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {getInitials(ticket.assignee_name)}
                              </AvatarFallback>
                            </Avatar>
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

            {/* Requester */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Requester
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {ticket.requester_name ? getInitials(ticket.requester_name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{ticket.requester_name || 'Unknown'}</p>
                    {ticket.requester_email && (
                      <p className="text-xs text-muted-foreground">{ticket.requester_email}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="mt-1">{format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Last Activity</Label>
                  <p className="mt-1">{format(new Date(ticket.last_activity_at), 'MMM d, yyyy HH:mm')}</p>
                </div>
                {ticket.first_response_due_at && (
                  <div>
                    <Label className="text-xs text-muted-foreground">First Response Due</Label>
                    <p className={`mt-1 ${isOverdue() ? 'text-destructive font-medium' : ''}`}>
                      {format(new Date(ticket.first_response_due_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                )}
                {ticket.resolution_due_at && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Resolution Due</Label>
                    <p className={`mt-1 ${isOverdue() ? 'text-destructive font-medium' : ''}`}>
                      {format(new Date(ticket.resolution_due_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                )}
                {ticket.resolved_at && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Resolved</Label>
                    <p className="mt-1">{format(new Date(ticket.resolved_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Minimalist Disposition */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resolution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Disposition</Label>
                  <Select
                    value={disposition || 'none'}
                    onValueChange={(value) => {
                      const newDisposition = value === 'none' ? '' : value;
                      // Only save if the value actually changed
                      if (newDisposition !== disposition) {
                        setDisposition(newDisposition);
                        handleSaveNotes(newDisposition);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
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
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Internal Notes</Label>
                  <Textarea
                    placeholder="Add notes..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    onBlur={() => {
                      // Only save if notes actually changed
                      if (internalNotes !== (ticket.internal_notes || '')) {
                        handleSaveNotes(undefined, internalNotes);
                      }
                    }}
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
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
                  <CardTitle className="text-base flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Related
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
                      className="w-full justify-start"
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

            {/* Tags */}
            {ticket.tags && ticket.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {ticket.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
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
