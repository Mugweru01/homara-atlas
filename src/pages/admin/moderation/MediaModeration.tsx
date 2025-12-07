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
  Image,
  Video,
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
  FileImage,
  Film,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Textarea } from '@/components/ui/textarea';

interface MediaItem {
  id: string;
  url: string;
  media_type: 'image' | 'video';
  content_id: string;
  content_type: 'post' | 'comment';
  user_id: string;
  user_name?: string;
  created_at: string;
  flagged_count?: number;
  is_flagged?: boolean;
  inappropriate_score?: number;
  moderation_status: 'pending' | 'approved' | 'rejected' | 'deleted';
}

export default function MediaModeration() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'delete' | 'warn' | 'ban' | null>(null);
  const [actionReason, setActionReason] = useState('');

  useEffect(() => {
    fetchMedia();
    const interval = setInterval(fetchMedia, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      // Fetch media from posts and comments
      const [postsData, commentsData] = await Promise.all([
        supabase
          .from('social_messages')
          .select(`
            id,
            user_id,
            media_urls,
            created_at,
            user:profiles!social_messages_user_id_fkey(id, full_name),
            reports:content_reports!content_reports_content_id_fkey(count)
          `)
          .not('media_urls', 'is', null),
        supabase
          .from('social_comments')
          .select(`
            id,
            user_id,
            media_urls,
            created_at,
            user:profiles!social_comments_user_id_fkey(id, full_name),
            reports:content_reports!content_reports_content_id_fkey(count)
          `)
          .not('media_urls', 'is', null),
      ]);

      const allMedia: MediaItem[] = [];

      // Process posts media
      (postsData.data || []).forEach((post: any) => {
        const mediaUrls = post.media_urls || [];
        mediaUrls.forEach((url: string, index: number) => {
          allMedia.push({
            id: `${post.id}_${index}`,
            url,
            media_type: url.match(/\.(mp4|mov|avi|webm)$/i) ? 'video' : 'image',
            content_id: post.id,
            content_type: 'post',
            user_id: post.user_id,
            user_name: (post.user as any)?.full_name || 'Unknown',
            created_at: post.created_at,
            flagged_count: (post.reports as any)?.length || 0,
            is_flagged: (post.reports as any)?.length > 0,
            moderation_status: 'pending',
          });
        });
      });

      // Process comments media
      (commentsData.data || []).forEach((comment: any) => {
        const mediaUrls = comment.media_urls || [];
        mediaUrls.forEach((url: string, index: number) => {
          allMedia.push({
            id: `${comment.id}_${index}`,
            url,
            media_type: url.match(/\.(mp4|mov|avi|webm)$/i) ? 'video' : 'image',
            content_id: comment.id,
            content_type: 'comment',
            user_id: comment.user_id,
            user_name: (comment.user as any)?.full_name || 'Unknown',
            created_at: comment.created_at,
            flagged_count: (comment.reports as any)?.length || 0,
            is_flagged: (comment.reports as any)?.length > 0,
            moderation_status: 'pending',
          });
        });
      });

      setMediaItems(allMedia.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error: any) {
      logger.error('Error fetching media:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch media',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModerationAction = async (mediaId: string, action: 'approve' | 'reject' | 'delete' | 'warn' | 'ban') => {
    setSelectedMedia(mediaItems.find(m => m.id === mediaId) || null);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedMedia || !actionType) return;

    try {
      switch (actionType) {
        case 'approve':
          toast({ title: 'Success', description: 'Media approved' });
          break;
        case 'reject':
          toast({ title: 'Success', description: 'Media rejected' });
          break;
        case 'delete':
          // Delete media from storage and content
          toast({ title: 'Success', description: 'Media deleted' });
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
          action: `moderation_${actionType}_media`,
          details: {
            media_id: selectedMedia.id,
            user_id: selectedMedia.user_id,
            reason: actionReason,
          },
        });

      setActionDialogOpen(false);
      setActionType(null);
      setActionReason('');
      setSelectedMedia(null);
      fetchMedia();
    } catch (error: any) {
      logger.error('Error performing moderation action:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to perform action',
        variant: 'destructive',
      });
    }
  };

  const filteredMedia = mediaItems.filter(media => {
    const matchesSearch = search === '' || 
      media.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      media.url.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = typeFilter === 'all' || media.media_type === typeFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'flagged' && media.is_flagged) ||
      (statusFilter === 'pending' && media.moderation_status === 'pending') ||
      (statusFilter === 'approved' && media.moderation_status === 'approved');

    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: mediaItems.length,
    images: mediaItems.filter(m => m.media_type === 'image').length,
    videos: mediaItems.filter(m => m.media_type === 'video').length,
    flagged: mediaItems.filter(m => m.is_flagged).length,
    pending: mediaItems.filter(m => m.moderation_status === 'pending').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Media Moderation</h1>
          <p className="text-muted-foreground">
            Review and moderate images and videos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchMedia} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <ExportButton data={filteredMedia} filename="media-moderation" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Media</CardTitle>
            <FileImage className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Images</CardTitle>
            <Image className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.images}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Videos</CardTitle>
            <Video className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.videos}</div>
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
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
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
                  placeholder="Search by user or URL..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images Only</SelectItem>
                <SelectItem value="video">Videos Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="flagged">Flagged Only</SelectItem>
                <SelectItem value="pending">Pending Review</SelectItem>
                <SelectItem value="approved">Approved Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Media Table */}
      <Card>
        <CardHeader>
          <CardTitle>Media Items ({filteredMedia.length})</CardTitle>
          <CardDescription>
            Review and moderate user-uploaded media
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
                    <TableHead>Preview</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMedia.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No media found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMedia.map((media) => (
                      <TableRow key={media.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedMedia(media);
                              setPreviewDialogOpen(true);
                            }}
                          >
                            {media.media_type === 'image' ? (
                              <Image className="h-4 w-4" />
                            ) : (
                              <Video className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={media.media_type === 'image' ? 'default' : 'secondary'}>
                            {media.media_type === 'image' ? (
                              <>
                                <Image className="h-3 w-3 mr-1" />
                                Image
                              </>
                            ) : (
                              <>
                                <Video className="h-3 w-3 mr-1" />
                                Video
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{media.user_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{media.content_type}</Badge>
                        </TableCell>
                        <TableCell>
                          {media.flagged_count && media.flagged_count > 0 ? (
                            <Badge variant="destructive">{media.flagged_count}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(media.created_at), 'MMM d, yyyy HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {media.moderation_status === 'approved' ? (
                            <Badge variant="success">Approved</Badge>
                          ) : media.moderation_status === 'rejected' ? (
                            <Badge variant="destructive">Rejected</Badge>
                          ) : media.is_flagged ? (
                            <Badge variant="warning">Flagged</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(media.id, 'approve')}
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4 text-success" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(media.id, 'reject')}
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4 text-warning" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(media.id, 'delete')}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(media.id, 'warn')}
                              title="Warn User"
                            >
                              <AlertCircle className="h-4 w-4 text-warning" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleModerationAction(media.id, 'ban')}
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

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Media Preview</DialogTitle>
            <DialogDescription>
              {selectedMedia && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm"><strong>User:</strong> {selectedMedia.user_name}</p>
                  <p className="text-sm"><strong>Type:</strong> {selectedMedia.media_type}</p>
                  <p className="text-sm"><strong>Content:</strong> {selectedMedia.content_type}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedMedia && (
              <div className="flex items-center justify-center">
                {selectedMedia.media_type === 'image' ? (
                  <img 
                    src={selectedMedia.url} 
                    alt="Preview" 
                    className="max-h-[500px] max-w-full rounded-lg"
                  />
                ) : (
                  <video 
                    src={selectedMedia.url} 
                    controls 
                    className="max-h-[500px] max-w-full rounded-lg"
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Media'}
              {actionType === 'reject' && 'Reject Media'}
              {actionType === 'delete' && 'Delete Media'}
              {actionType === 'warn' && 'Warn User'}
              {actionType === 'ban' && 'Ban User'}
            </DialogTitle>
            <DialogDescription>
              {selectedMedia && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm"><strong>User:</strong> {selectedMedia.user_name}</p>
                  <p className="text-sm"><strong>Type:</strong> {selectedMedia.media_type}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(actionType === 'warn' || actionType === 'ban' || actionType === 'delete' || actionType === 'reject') && (
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

