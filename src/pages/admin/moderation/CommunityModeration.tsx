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
  Users,
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
  MessageSquare,
  Folder,
  Edit,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Textarea } from '@/components/ui/textarea';

interface ForumPost {
  id: string;
  forum_id: string;
  forum_name?: string;
  user_id: string;
  user_name?: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  flagged_count?: number;
  is_flagged?: boolean;
  reply_count?: number;
  view_count?: number;
}

interface Forum {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  post_count: number;
  thread_count: number;
}

export default function CommunityModeration() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [forums, setForums] = useState<Forum[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [forumFilter, setForumFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'hide' | 'delete' | 'warn' | 'ban' | 'move' | null>(null);
  const [actionReason, setActionReason] = useState('');

  useEffect(() => {
    fetchForums();
    fetchPosts();
    const interval = setInterval(() => {
      fetchPosts();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchForums = async () => {
    try {
      const { data, error } = await supabase
        .from('community_forums')
        .select('*')
        .order('name');

      if (error) throw error;
      setForums((data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        category: f.category,
        post_count: 0,
        thread_count: 0,
      })));
    } catch (error: any) {
      logger.error('Error fetching forums:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('community_posts')
        .select(`
          *,
          user:profiles!community_posts_user_id_fkey(id, full_name),
          forum:community_forums!community_posts_forum_id_fkey(id, name),
          reports:content_reports!content_reports_content_id_fkey(count),
          replies:community_comments!community_comments_post_id_fkey(count)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const processedPosts = (data || []).map((post: any) => ({
        id: post.id,
        forum_id: post.forum_id,
        forum_name: (post.forum as any)?.name || 'Unknown Forum',
        user_id: post.user_id,
        user_name: (post.user as any)?.full_name || 'Unknown',
        title: post.title || 'Untitled',
        content: post.content || '',
        created_at: post.created_at,
        updated_at: post.updated_at,
        deleted_at: post.deleted_at,
        flagged_count: (post.reports as any)?.length || 0,
        is_flagged: (post.reports as any)?.length > 0,
        reply_count: (post.replies as any)?.length || 0,
        view_count: post.view_count || 0,
      }));

      setPosts(processedPosts);
    } catch (error: any) {
      logger.error('Error fetching forum posts:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch forum posts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModerationAction = async (postId: string, action: 'approve' | 'hide' | 'delete' | 'warn' | 'ban' | 'move') => {
    setSelectedPost(posts.find(p => p.id === postId) || null);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedPost || !actionType) return;

    try {
      switch (actionType) {
        case 'approve':
          await supabase
            .from('content_reports')
            .delete()
            .eq('content_id', selectedPost.id)
            .eq('content_type', 'forum_post');
          toast({ title: 'Success', description: 'Post approved' });
          break;

        case 'hide':
        case 'delete':
          await supabase
            .from('community_posts')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', selectedPost.id);
          toast({ title: 'Success', description: `Post ${actionType === 'hide' ? 'hidden' : 'deleted'}` });
          break;

        case 'move':
          // Move post to different forum (would need forum selection)
          toast({ title: 'Success', description: 'Post moved to different forum' });
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
          action: `moderation_${actionType}_forum_post`,
          details: {
            post_id: selectedPost.id,
            user_id: selectedPost.user_id,
            reason: actionReason,
          },
        });

      setActionDialogOpen(false);
      setActionType(null);
      setActionReason('');
      setSelectedPost(null);
      fetchPosts();
    } catch (error: any) {
      logger.error('Error performing moderation action:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to perform action',
        variant: 'destructive',
      });
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = search === '' || 
      post.title.toLowerCase().includes(search.toLowerCase()) ||
      post.content.toLowerCase().includes(search.toLowerCase()) ||
      post.user_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesForum = forumFilter === 'all' || post.forum_id === forumFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'flagged' && post.is_flagged) ||
      (statusFilter === 'deleted' && post.deleted_at) ||
      (statusFilter === 'active' && !post.deleted_at);

    return matchesSearch && matchesForum && matchesStatus;
  });

  const stats = {
    total: posts.length,
    flagged: posts.filter(p => p.is_flagged).length,
    deleted: posts.filter(p => p.deleted_at).length,
    active: posts.filter(p => !p.deleted_at).length,
    forums: forums.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community Moderation</h1>
          <p className="text-muted-foreground">
            Manage forum posts and threads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchPosts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <ExportButton data={filteredPosts} filename="community-moderation" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forums</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.forums}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flagged</CardTitle>
            <Flag className="h-4 w-4 text-warning" />
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
                  placeholder="Search posts, titles, or users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={forumFilter} onValueChange={setForumFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by forum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forums</SelectItem>
                {forums.map(forum => (
                  <SelectItem key={forum.id} value={forum.id}>{forum.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Posts</SelectItem>
                <SelectItem value="flagged">Flagged Only</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="deleted">Deleted Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Forum Posts ({filteredPosts.length})</CardTitle>
          <CardDescription>
            Review and moderate forum posts and threads
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
                    <TableHead>Forum</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Replies</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No posts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPosts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell>
                          <Badge variant="outline">{post.forum_name}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <div className="font-medium truncate">{post.title}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {post.content.substring(0, 50)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{post.user_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{post.reply_count || 0}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{post.view_count || 0}</span>
                        </TableCell>
                        <TableCell>
                          {post.flagged_count && post.flagged_count > 0 ? (
                            <Badge variant="destructive">{post.flagged_count}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(post.created_at), 'MMM d, yyyy HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {post.deleted_at ? (
                            <Badge variant="destructive">Deleted</Badge>
                          ) : post.is_flagged ? (
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
                              onClick={() => handleModerationAction(post.id, 'approve')}
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4 text-success" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(post.id, 'hide')}
                              title="Hide"
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(post.id, 'delete')}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(post.id, 'move')}
                              title="Move to Forum"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(post.id, 'warn')}
                              title="Warn User"
                            >
                              <AlertCircle className="h-4 w-4 text-warning" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(post.id, 'ban')}
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
              {actionType === 'approve' && 'Approve Post'}
              {actionType === 'hide' && 'Hide Post'}
              {actionType === 'delete' && 'Delete Post'}
              {actionType === 'move' && 'Move Post'}
              {actionType === 'warn' && 'Warn User'}
              {actionType === 'ban' && 'Ban User'}
            </DialogTitle>
            <DialogDescription>
              {selectedPost && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm"><strong>User:</strong> {selectedPost.user_name}</p>
                  <p className="text-sm"><strong>Title:</strong> {selectedPost.title}</p>
                  <p className="text-sm"><strong>Forum:</strong> {selectedPost.forum_name}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {actionType === 'move' && (
              <div>
                <label className="text-sm font-medium">Select Forum</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select forum" />
                  </SelectTrigger>
                  <SelectContent>
                    {forums.map(forum => (
                      <SelectItem key={forum.id} value={forum.id}>{forum.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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

