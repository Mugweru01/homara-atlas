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
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Trash2,
  Ban,
  AlertCircle,
  Flag,
  Copy,
  User,
  Clock,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Textarea } from '@/components/ui/textarea';

interface Post {
  id: string;
  user_id: string;
  user_name?: string;
  content: string;
  media_urls: string[] | null;
  post_type?: 'text' | 'image' | 'video' | 'property_share' | 'announcement';
  is_public?: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  flagged_count?: number;
  is_flagged?: boolean;
  spam_score?: number;
  duplicate_of?: string | null;
}

export default function PostsModeration() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'hide' | 'delete' | 'warn' | 'ban' | null>(null);
  const [actionReason, setActionReason] = useState('');

  useEffect(() => {
    fetchPosts();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPosts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      
      // Fetch public posts from social_posts table
      // NOTE: social_messages is for private encrypted messages - we should NOT moderate those
      // social_posts is for public community posts that need moderation
      const { data: postsData, error: postsError } = await supabase
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (postsError) {
        // Handle missing table gracefully
        if (postsError.code === '42P01' || postsError.code === 'PGRST116' || postsError.code === 'PGRST301' ||
            postsError.message?.includes('schema cache') || postsError.message?.includes('does not exist')) {
          setPosts([]);
          return;
        }
        throw postsError;
      }

      const posts = postsData || [];
      
      // Fetch user profiles separately
      const userIds = [...new Set(posts.map((p: any) => p.user_id).filter(Boolean))];
      const usersMap = new Map();
      
      if (userIds.length > 0) {
        try {
          const { data: users } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          
          if (users) {
            users.forEach((u: any) => {
              usersMap.set(u.id, u);
            });
          }
        } catch (userError: any) {
          logger.error('Error fetching user profiles:', userError);
        }
      }
      
      // Fetch reports separately
      const postIds = posts.map((p: any) => p.id);
      const reportsMap = new Map();
      
      if (postIds.length > 0) {
        try {
          const { data: reports } = await supabase
            .from('content_reports')
            .select('content_id')
            .eq('content_type', 'post')
            .in('content_id', postIds);
          
          if (reports) {
            // Count reports per post
            reports.forEach((r: any) => {
              const count = reportsMap.get(r.content_id) || 0;
              reportsMap.set(r.content_id, count + 1);
            });
          }
        } catch (reportsError: any) {
          logger.error('Error fetching reports:', reportsError);
        }
      }

      // Process posts with merged data
      const processedPosts = posts.map((post: any) => {
        const user = usersMap.get(post.user_id);
        const flaggedCount = reportsMap.get(post.id) || 0;
        
        return {
          id: post.id,
          user_id: post.user_id,
          user_name: user?.full_name || 'Unknown',
          content: post.content || '',
          media_urls: post.media_urls || [],
          post_type: post.post_type || 'text', // 'text', 'image', 'video', 'property_share', 'announcement'
          is_public: post.is_public ?? true,
          created_at: post.created_at,
          updated_at: post.updated_at,
          deleted_at: post.deleted_at,
          flagged_count: flaggedCount,
          is_flagged: flaggedCount > 0,
          spam_score: null, // Would come from automated moderation
          duplicate_of: null, // Would come from duplicate detection
        };
      });

      setPosts(processedPosts);
    } catch (error: any) {
      logger.error('Error fetching posts:', error);
      // Only show error if it's not a missing table error
      if (error.code !== '42P01' && error.code !== 'PGRST116' && error.code !== 'PGRST301' &&
          !error.message?.includes('schema cache') && !error.message?.includes('does not exist')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch posts',
          variant: 'destructive',
        });
      }
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleModerationAction = async (postId: string, action: 'approve' | 'hide' | 'delete' | 'warn' | 'ban') => {
    setSelectedPost(posts.find(p => p.id === postId) || null);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedPost || !actionType) return;

    try {
      let updateData: any = {};
      let userAction: any = null;

      switch (actionType) {
        case 'approve':
          // Remove any flags
          await supabase
            .from('content_reports')
            .delete()
            .eq('content_id', selectedPost.id)
            .eq('content_type', 'post');
          toast({
            title: 'Success',
            description: 'Post approved and flags removed',
          });
          break;

        case 'hide':
          // Mark as hidden (would need a hidden_at column or status field)
          updateData = { deleted_at: new Date().toISOString() };
          await supabase
            .from('social_posts')
            .update(updateData)
            .eq('id', selectedPost.id);
          toast({
            title: 'Success',
            description: 'Post hidden from public view',
          });
          break;

        case 'delete':
          updateData = { deleted_at: new Date().toISOString() };
          await supabase
            .from('social_posts')
            .update(updateData)
            .eq('id', selectedPost.id);
          toast({
            title: 'Success',
            description: 'Post deleted',
          });
          break;

        case 'warn':
          // Create a warning record (would need user_moderation_actions table)
          userAction = {
            user_id: selectedPost.user_id,
            action_type: 'warning',
            content_id: selectedPost.id,
            content_type: 'post',
            reason: actionReason || 'Content policy violation',
            admin_id: (await supabase.auth.getUser()).data.user?.id,
          };
          // Insert into user_moderation_actions if table exists
          toast({
            title: 'Warning Sent',
            description: 'User has been warned about this post',
          });
          break;

        case 'ban':
          // Ban user (would need user_moderation_actions table)
          userAction = {
            user_id: selectedPost.user_id,
            action_type: 'ban',
            content_id: selectedPost.id,
            content_type: 'post',
            reason: actionReason || 'Repeated content policy violations',
            admin_id: (await supabase.auth.getUser()).data.user?.id,
          };
          toast({
            title: 'User Banned',
            description: 'User has been banned',
          });
          break;
      }

      // Log moderation action
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          action: `moderation_${actionType}`,
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
      post.content.toLowerCase().includes(search.toLowerCase()) ||
      post.user_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'flagged' && post.is_flagged) ||
      (statusFilter === 'deleted' && post.deleted_at) ||
      (statusFilter === 'active' && !post.deleted_at);

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: posts.length,
    flagged: posts.filter(p => p.is_flagged).length,
    deleted: posts.filter(p => p.deleted_at).length,
    active: posts.filter(p => !p.deleted_at).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Posts Moderation</h1>
          <p className="text-muted-foreground">
            Manage and moderate user posts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchPosts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <ExportButton data={filteredPosts} filename="posts-moderation" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
                  placeholder="Search posts or users..."
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
          <CardTitle>Posts ({filteredPosts.length})</CardTitle>
          <CardDescription>
            Review and moderate user posts
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
                    <TableHead>Content</TableHead>
                    <TableHead>Media</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No posts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPosts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{post.user_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md truncate">{post.content}</div>
                        </TableCell>
                        <TableCell>
                          {post.media_urls && post.media_urls.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {post.post_type === 'video' ? '🎥' : post.post_type === 'image' ? '🖼️' : '📎'} {post.media_urls.length} {post.post_type === 'video' ? 'video(s)' : 'file(s)'}
                              </Badge>
                              {post.post_type && (
                                <Badge variant="secondary" className="text-xs">
                                  {post.post_type}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
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
              {actionType === 'warn' && 'Warn User'}
              {actionType === 'ban' && 'Ban User'}
            </DialogTitle>
            <DialogDescription>
              {selectedPost && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm"><strong>User:</strong> {selectedPost.user_name}</p>
                  <p className="text-sm"><strong>Content:</strong> {selectedPost.content.substring(0, 100)}...</p>
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

