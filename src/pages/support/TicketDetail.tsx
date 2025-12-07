import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft,
  RefreshCw,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Send,
  Star,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
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
  assignee_name?: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  first_response_at?: string;
  resolved_at?: string;
  customer_satisfaction_rating?: number;
}

interface Comment {
  id: string;
  ticket_id: string;
  content: string;
  author_type: string;
  author_name?: string;
  is_internal: boolean;
  created_at: string;
}

export default function SupportTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [satisfactionDialogOpen, setSatisfactionDialogOpen] = useState(false);
  const [satisfactionRating, setSatisfactionRating] = useState(0);
  const [satisfactionFeedback, setSatisfactionFeedback] = useState('');

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId && id) {
      fetchTicketData();
    }
  }, [currentUserId, id]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      } else {
        navigate('/admin/login');
      }
    } catch (error) {
      logger.error('Error fetching current user:', error);
    }
  };

  const fetchTicketData = async () => {
    if (!id || !currentUserId) return;

    try {
      setLoading(true);
      
      // Fetch ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from('homaradesk_tickets')
        .select('*')
        .eq('id', id)
        .eq('requester_id', currentUserId) // Ensure user can only see their own tickets
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

      // Fetch assignee name
      let assigneeName = null;
      if (ticketData.assignee_id) {
        try {
          const { data: admin } = await supabase
            .from('admins')
            .select('id, user_id')
            .eq('id', ticketData.assignee_id)
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
        assignee_name: assigneeName,
      });

      // Fetch comments (only public comments for customers)
      const { data: commentsData } = await supabase
        .from('homaradesk_ticket_comments')
        .select('*')
        .eq('ticket_id', id)
        .eq('is_public', true) // Only show public comments
        .order('created_at', { ascending: true });

      if (commentsData) {
        // Fetch comment author names
        const authorIds = [...new Set(commentsData.map((c: any) => c.author_id).filter(Boolean))];
        const authorsMap = new Map();
        
        if (authorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', authorIds);
          
          if (profiles) {
            profiles.forEach((p: any) => {
              authorsMap.set(p.id, p.full_name);
            });
          }
        }

        const processedComments = commentsData.map((comment: any) => ({
          ...comment,
          author_name: comment.author_id ? authorsMap.get(comment.author_id) : comment.author_name,
        }));

        setComments(processedComments);
      }
    } catch (error: any) {
      logger.error('Error fetching ticket data:', error);
      console.error('Ticket fetch error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch ticket data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentContent.trim() || !ticket || !currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('homaradesk_ticket_comments')
        .insert({
          ticket_id: ticket.id,
          content: commentContent,
          author_id: currentUserId,
          author_type: 'user',
          is_internal: false,
          is_public: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Get author name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .single();

      setComments([...comments, {
        ...data,
        author_name: profile?.full_name || 'You',
      }]);

      setCommentContent('');
      
      toast({
        title: 'Success',
        description: 'Comment added successfully',
      });

      fetchTicketData(); // Refresh to get updated last_activity_at
    } catch (error: any) {
      logger.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add comment',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitSatisfaction = async () => {
    if (!ticket || satisfactionRating === 0) return;

    try {
      const { error } = await supabase
        .from('homaradesk_satisfaction_surveys')
        .insert({
          ticket_id: ticket.id,
          rating: satisfactionRating,
          feedback: satisfactionFeedback || null,
          submitted_by: currentUserId,
        });

      if (error) throw error;

      // Update ticket with satisfaction rating
      await supabase
        .from('homaradesk_tickets')
        .update({
          customer_satisfaction_rating: satisfactionRating,
          customer_satisfaction_feedback: satisfactionFeedback || null,
        })
        .eq('id', ticket.id);

      toast({
        title: 'Thank you!',
        description: 'Your feedback has been recorded',
      });

      setSatisfactionDialogOpen(false);
      setSatisfactionRating(0);
      setSatisfactionFeedback('');
      fetchTicketData();
    } catch (error: any) {
      logger.error('Error submitting satisfaction:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit feedback',
        variant: 'destructive',
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
        <Link to="/support/tickets">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tickets
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Ticket not found</p>
            <p className="text-sm text-muted-foreground mt-2">
              The ticket you're looking for doesn't exist or you don't have access to it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/support/tickets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{ticket.ticket_number}</h1>
            </div>
            <p className="text-muted-foreground">{ticket.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchTicketData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {ticket.status === 'resolved' && !ticket.customer_satisfaction_rating && (
            <Button onClick={() => setSatisfactionDialogOpen(true)}>
              <Star className="mr-2 h-4 w-4" />
              Rate Experience
            </Button>
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

          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <CardDescription>
                All communication about this ticket
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Comments */}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-4">
                    <div className="rounded-full bg-muted p-2 h-10 w-10 shrink-0 flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {comment.author_name || 'Support Team'}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {comment.author_type === 'admin' ? 'Support Agent' : 'You'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No comments yet</p>
                    <p className="text-sm mt-2">Support will respond here</p>
                  </div>
                )}
              </div>

              {/* Add Comment */}
              {ticket.status !== 'closed' && ticket.status !== 'cancelled' && (
                <div className="border-t pt-4 space-y-4">
                  <div>
                    <Label htmlFor="comment">Add a comment</Label>
                    <Textarea
                      id="comment"
                      placeholder="Type your message here..."
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                  <Button onClick={handleAddComment} disabled={!commentContent.trim()}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Comment
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Label className="text-xs text-muted-foreground">Assigned To</Label>
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
              {ticket.first_response_at && (
                <div>
                  <Label className="text-xs text-muted-foreground">First Response</Label>
                  <div className="text-sm mt-1">
                    {format(new Date(ticket.first_response_at), 'MMM d, yyyy HH:mm')}
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
              <div>
                <Label className="text-xs text-muted-foreground">Last Activity</Label>
                <div className="text-sm mt-1">
                  {format(new Date(ticket.last_activity_at), 'MMM d, yyyy HH:mm')}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Satisfaction Dialog */}
      <Dialog open={satisfactionDialogOpen} onOpenChange={setSatisfactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate Your Experience</DialogTitle>
            <DialogDescription>
              How would you rate your experience with this support ticket?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setSatisfactionRating(rating)}
                    className={`p-2 rounded-lg transition-all ${
                      satisfactionRating >= rating
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    <Star className={`h-6 w-6 ${
                      satisfactionRating >= rating ? 'fill-current' : ''
                    }`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="feedback">Feedback (Optional)</Label>
              <Textarea
                id="feedback"
                placeholder="Tell us more about your experience..."
                value={satisfactionFeedback}
                onChange={(e) => setSatisfactionFeedback(e.target.value)}
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSatisfactionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitSatisfaction} disabled={satisfactionRating === 0}>
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

