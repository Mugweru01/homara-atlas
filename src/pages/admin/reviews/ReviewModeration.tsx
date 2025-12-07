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
  Star,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  User,
  Home,
  Clock,
  AlertTriangle,
  Shield,
  MessageSquare,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Textarea } from '@/components/ui/textarea';

interface Review {
  id: string;
  user_id: string;
  user_name?: string;
  property_id: string;
  property_title?: string;
  rating: number;
  title: string;
  comment: string;
  images: string[] | null;
  verified: boolean | null;
  created_at: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  moderation_notes?: string;
}

export default function ReviewModeration() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [moderationNotes, setModerationNotes] = useState('');

  useEffect(() => {
    fetchReviews();
    const interval = setInterval(fetchReviews, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      // Fetch reviews that need moderation (unverified or pending)
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          user:profiles!reviews_user_id_fkey(id, full_name),
          property:properties!reviews_property_id_fkey(id, title)
        `)
        .or('verified.is.null,verified.eq.false')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const processedReviews = (data || []).map((review: any) => ({
        id: review.id,
        user_id: review.user_id,
        user_name: (review.user as any)?.full_name || 'Unknown',
        property_id: review.property_id,
        property_title: (review.property as any)?.title || 'Unknown Property',
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        images: (review.images as any) || [],
        verified: review.verified || false,
        created_at: review.created_at,
        moderation_status: review.verified ? 'approved' : 'pending',
        moderation_notes: null,
      }));

      setReviews(processedReviews);
    } catch (error: any) {
      logger.error('Error fetching reviews:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch reviews',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModerationAction = async (reviewId: string, action: 'approve' | 'reject') => {
    const review = reviews.find(r => r.id === reviewId);
    if (!review) return;

    setSelectedReview(review);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedReview || !actionType) return;

    try {
      if (actionType === 'approve') {
        const { error } = await supabase
          .from('reviews')
          .update({
            verified: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedReview.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Review approved and verified',
        });
      } else {
        // Reject/delete review
        const { error } = await supabase
          .from('reviews')
          .delete()
          .eq('id', selectedReview.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Review rejected and removed',
        });
      }

      // Log moderation action
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          action: `review_${actionType}`,
          details: {
            review_id: selectedReview.id,
            user_id: selectedReview.user_id,
            property_id: selectedReview.property_id,
            notes: moderationNotes,
          },
        });

      setActionDialogOpen(false);
      setActionType(null);
      setModerationNotes('');
      setSelectedReview(null);
      fetchReviews();
    } catch (error: any) {
      logger.error('Error performing moderation action:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to perform action',
        variant: 'destructive',
      });
    }
  };

  const filteredReviews = reviews.filter(review => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return !review.verified;
    if (statusFilter === 'approved') return review.verified;
    return true;
  });

  const stats = {
    total: reviews.length,
    pending: reviews.filter(r => !r.verified).length,
    approved: reviews.filter(r => r.verified).length,
    inQueue: reviews.filter(r => !r.verified).length,
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating
            ? 'fill-yellow-400 text-yellow-400'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Moderation</h1>
          <p className="text-muted-foreground">
            Approve or reject property reviews
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchReviews} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <ExportButton data={filteredReviews} filename="review-moderation" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total in Queue</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Queue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inQueue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[250px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reviews</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Reviews Table */}
      <Card>
        <CardHeader>
          <CardTitle>Moderation Queue ({filteredReviews.length})</CardTitle>
          <CardDescription>
            Review and approve or reject property reviews
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
                    <TableHead>Rating</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No reviews in moderation queue
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {renderStars(review.rating)}
                            <span className="ml-1 text-sm font-medium">{review.rating}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <div className="font-medium truncate">{review.title}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {review.comment.substring(0, 50)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{review.user_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            <span className="max-w-xs truncate">{review.property_title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {review.verified ? (
                            <Badge variant="success">Approved</Badge>
                          ) : (
                            <Badge variant="warning">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(review.created_at), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedReview(review);
                                setActionDialogOpen(true);
                                setActionType('approve');
                              }}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!review.verified && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleModerationAction(review.id, 'approve')}
                                  title="Approve"
                                >
                                  <CheckCircle className="h-4 w-4 text-success" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleModerationAction(review.id, 'reject')}
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Review'}
              {actionType === 'reject' && 'Reject Review'}
            </DialogTitle>
            <DialogDescription>
              Review details and moderation notes
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {renderStars(selectedReview.rating)}
                    <span className="text-lg font-semibold">{selectedReview.rating}/5</span>
                  </div>
                  <h3 className="text-xl font-semibold">{selectedReview.title}</h3>
                </div>
                <Badge variant={selectedReview.verified ? 'success' : 'warning'}>
                  {selectedReview.verified ? 'Approved' : 'Pending'}
                </Badge>
              </div>

              <div>
                <h4 className="font-medium mb-1">Review Content</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedReview.comment}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Reviewer</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedReview.user_name}</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Property</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedReview.property_title}</span>
                  </div>
                </div>
              </div>

              {selectedReview.images && selectedReview.images.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Images ({selectedReview.images.length})</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {(selectedReview.images as string[]).map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Review image ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Moderation Notes (optional)</label>
                <Textarea
                  value={moderationNotes}
                  onChange={(e) => setModerationNotes(e.target.value)}
                  placeholder="Add notes about this moderation decision..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              variant={actionType === 'reject' ? 'destructive' : 'default'}
            >
              {actionType === 'approve' ? 'Approve Review' : 'Reject Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

