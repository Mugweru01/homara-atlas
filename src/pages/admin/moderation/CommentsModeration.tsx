import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
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
import { 
  MessageSquare,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  EyeOff,
  Trash2,
  Ban,
  AlertCircle,
  Flag,
  User,
  Clock,
  MessageCircle,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Textarea } from '@/components/ui/textarea';

interface Comment {
  id: string;
  post_id: string;
  post_title?: string;
  user_id: string;
  user_name?: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  deleted_at: string | null;
  flagged_count?: number;
  is_flagged?: boolean;
  spam_score?: number;
  toxicity_score?: number;
}

export default function CommentsModeration() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'hide' | 'delete' | 'warn' | 'ban' | null>(null);
  const [actionReason, setActionReason] = useState('');

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('social_comments')
        .select(`
          *,
          user:profiles!social_comments_user_id_fkey(id, full_name),
          post:social_messages!social_comments_post_id_fkey(id, content),
          reports:content_reports!content_reports_content_id_fkey(count)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const processedComments = (data || []).map((comment: any) => ({
        id: comment.id,
        post_id: comment.post_id,
        post_title: (comment.post as any)?.content?.substring(0, 50) || 'Unknown Post',
        user_id: comment.user_id,
        user_name: (comment.user as any)?.full_name || 'Unknown',
        content: comment.content || '',
        parent_comment_id: comment.parent_comment_id,
        created_at: comment.created_at,
        deleted_at: comment.deleted_at,
        flagged_count: (comment.reports as any)?.length || 0,
        is_flagged: (comment.reports as any)?.length > 0,
        spam_score: null,
        toxicity_score: null,
      }));

      setComments(processedComments);
    } catch (error: any) {
      logger.error('Error fetching comments:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch comments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModerationAction = async (commentId: string, action: 'approve' | 'hide' | 'delete' | 'warn' | 'ban') => {
    setSelectedComment(comments.find(c => c.id === commentId) || null);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedComment || !actionType) return;

    try {
      switch (actionType) {
        case 'approve':
          await supabase
            .from('content_reports')
            .delete()
            .eq('content_id', selectedComment.id)
            .eq('content_type', 'comment');
          toast({ title: 'Success', description: 'Comment approved' });
          break;

        case 'hide':
        case 'delete':
          await supabase
            .from('social_comments')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', selectedComment.id);
          toast({ title: 'Success', description: `Comment ${actionType === 'hide' ? 'hidden' : 'deleted'}` });
          break;

        case 'warn':
        case 'ban':
          toast({ 
            title: actionType === 'warn' ? 'Warning Sent' : 'User Banned',
            description: `User has been ${actionType === 'warn' ? 'warned' : 'banned'}`,
          });
          break;
      }

      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          action: `moderation_${actionType}_comment`,
          details: {
            comment_id: selectedComment.id,
            user_id: selectedComment.user_id,
            reason: actionReason,
          },
        });

      setActionDialogOpen(false);
      setActionType(null);
      setActionReason('');
      setSelectedComment(null);
      fetchComments();
    } catch (error: any) {
      logger.error('Error performing moderation action:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to perform action',
        variant: 'destructive',
      });
    }
  };

  const filteredComments = comments.filter(comment => {
    const matchesSearch = search === '' || 
      comment.content.toLowerCase().includes(search.toLowerCase()) ||
      comment.user_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'flagged' && comment.is_flagged) ||
      (statusFilter === 'deleted' && comment.deleted_at) ||
      (statusFilter === 'active' && !comment.deleted_at);

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: comments.length,
    flagged: comments.filter(c => c.is_flagged).length,
    deleted: comments.filter(c => c.deleted_at).length,
    active: comments.filter(c => !c.deleted_at).length,
    inQueue: comments.filter(c => c.is_flagged && !c.deleted_at).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comments Moderation</h1>
          <p className="text-muted-foreground">
            Review and moderate user comments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchComments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <ExportButton data={filteredComments} filename="comments-moderation" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Queue</CardTitle>
            <Flag className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.inQueue}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flagged</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.flagged}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deleted</CardTitle>
            <Trash2 className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.deleted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search comments or users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Comments</SelectItem>
                <SelectItem value="flagged">Flagged Only</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="deleted">Deleted Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Comments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Comments ({filteredComments.length})</CardTitle>
          <CardDescription>
            Review and moderate user comments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Post</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No comments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredComments.map((comment) => (
                      <TableRow key={comment.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{comment.user_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md truncate">{comment.content}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate text-sm text-muted-foreground">
                            {comment.post_title}
                          </div>
                        </TableCell>
                        <TableCell>
                          {comment.flagged_count && comment.flagged_count > 0 ? (
                            <Badge variant="destructive">{comment.flagged_count}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(comment.created_at), 'MMM d, yyyy HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {comment.deleted_at ? (
                            <Badge variant="destructive">Deleted</Badge>
                          ) : comment.is_flagged ? (
                            <Badge variant="warning">Flagged</Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(comment.id, 'approve')}
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4 text-success" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(comment.id, 'hide')}
                              title="Hide"
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(comment.id, 'delete')}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(comment.id, 'warn')}
                              title="Warn User"
                            >
                              <AlertCircle className="h-4 w-4 text-warning" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(comment.id, 'ban')}
                              title="Ban User"
                            >
                              <Ban className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Comment'}
              {actionType === 'hide' && 'Hide Comment'}
              {actionType === 'delete' && 'Delete Comment'}
              {actionType === 'warn' && 'Warn User'}
              {actionType === 'ban' && 'Ban User'}
            </DialogTitle>
            <DialogDescription>
              {selectedComment && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm"><strong>User:</strong> {selectedComment.user_name}</p>
                  <p className="text-sm"><strong>Comment:</strong> {selectedComment.content.substring(0, 100)}...</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(actionType === 'warn' || actionType === 'ban' || actionType === 'delete') && (
              <div>
                <label className="text-sm font-medium">Reason (optional)</label>
                <Textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Enter reason for this action..."
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              variant={actionType === 'delete' || actionType === 'ban' ? 'destructive' : 'default'}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

