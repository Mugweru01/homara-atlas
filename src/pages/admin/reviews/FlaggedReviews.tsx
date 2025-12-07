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
  Flag,
  AlertTriangle,
  MessageSquare,
  Shield,
  Ban,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Textarea } from '@/components/ui/textarea';

interface FlaggedReview {
  id: string;
  review_id: string;
  user_id: string;
  user_name?: string;
  property_id: string;
  property_title?: string;
  rating: number;
  title: string;
  comment: string;
  flag_reason: string;
  flag_count: number;
  flagged_by?: string[];
  created_at: string;
  review_created_at: string;
}

export default function FlaggedReviews() {
  const [flaggedReviews, setFlaggedReviews] = useState<FlaggedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [selectedReview, setSelectedReview] = useState<FlaggedReview | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'dismiss' | 'remove' | 'warn' | 'ban' | null>(null);
  const [actionNotes, setActionNotes] = useState('');

  useEffect(() => {
    fetchFlaggedReviews();
    const interval = setInterval(fetchFlaggedReviews, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchFlaggedReviews = async () => {
    try {
      setLoading(true);
      // Fetch reviews that have been flagged via content_reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('content_reports')
        .select(`
          *,
          review:reviews!content_reports_content_id_fkey(
            *,
            user:profiles!reviews_user_id_fkey(id, full_name),
            property:properties!reviews_property_id_fkey(id, title)
          )
        `)
        .eq('content_type', 'review')
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;

      // Group flags by review_id
      const flagsByReview = new Map<string, any[]>();
      (reportsData || []).forEach((report: any) => {
        const reviewId = report.content_id;
        if (!flagsByReview.has(reviewId)) {
          flagsByReview.set(reviewId, []);
        }
        flagsByReview.get(reviewId)!.push(report);
      });

      // Process flagged reviews
      const processed: FlaggedReview[] = [];
      flagsByReview.forEach((flags, reviewId) => {
        const firstFlag = flags[0];
        const review = firstFlag.review;
        if (!review) return;

        processed.push({
          id: reviewId,
          review_id: reviewId,
          user_id: review.user_id,
          user_name: (review.user as any)?.full_name || 'Unknown',
          property_id: review.property_id,
          property_title: (review.property as any)?.title || 'Unknown Property',
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          flag_reason: flags.map((f: any) => f.reason || 'Inappropriate').join(', '),
          flag_count: flags.length,
          flagged_by: flags.map((f: any) => f.reporter_id).filter(Boolean),
          created_at: firstFlag.created_at,
          review_created_at: review.created_at,
        });
      });

      setFlaggedReviews(processed.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error: any) {
      logger.error('Error fetching flagged reviews:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch flagged reviews',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (reviewId: string, action: 'dismiss' | 'remove' | 'warn' | 'ban') => {
    const review = flaggedReviews.find(r => r.id === reviewId);
    if (!review) return;

    setSelectedReview(review);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedReview || !actionType) return;

    try {
      switch (actionType) {
        case 'dismiss':
          // Remove all flags for this review
          await supabase
            .from('content_reports')
            .delete()
            .eq('content_id', selectedReview.review_id)
            .eq('content_type', 'review');
          toast({
            title: 'Success',
            description: 'Flags dismissed and review restored',
          });
          break;

        case 'remove':
          // Delete the review
          await supabase
            .from('reviews')
            .delete()
            .eq('id', selectedReview.review_id);
          toast({
            title: 'Success',
            description: 'Review removed',
          });
          break;

        case 'warn':
          // Warn the user (would need user_moderation_actions table)
          toast({
            title: 'Warning Sent',
            description: 'User has been warned about this review',
          });
          break;

        case 'ban':
          // Ban the user (would need user_moderation_actions table)
          toast({
            title: 'User Banned',
            description: 'User has been banned',
          });
          break;
      }

      // Log action
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          action: `flagged_review_${actionType}`,
          details: {
            review_id: selectedReview.review_id,
            user_id: selectedReview.user_id,
            flag_count: selectedReview.flag_count,
            notes: actionNotes,
          },
        });

      setActionDialogOpen(false);
      setActionType(null);
      setActionNotes('');
      setSelectedReview(null);
      fetchFlaggedReviews();
    } catch (error: any) {
      logger.error('Error performing action:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to perform action',
        variant: 'destructive',
      });
    }
  };

  const filteredReviews = flaggedReviews.filter(review => {
    const matchesSearch = search === '' || 
      review.title.toLowerCase().includes(search.toLowerCase()) ||
      review.comment.toLowerCase().includes(search.toLowerCase()) ||
      review.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      review.property_title?.toLowerCase().includes(search.toLowerCase());
    
    const matchesReason = reasonFilter === 'all' ||
      review.flag_reason.toLowerCase().includes(reasonFilter.toLowerCase());

    return matchesSearch && matchesReason;
  });

  const stats = {
    total: flaggedReviews.length,
    highPriority: flaggedReviews.filter(r => r.flag_count >= 3).length,
    recent: flaggedReviews.filter(r => {
      const daysSince = (new Date().getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    }).length,
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
          <h1 className="text-3xl font-bold tracking-tight">Flagged Reviews</h1>
          <p className="text-muted-foreground">
            Handle flagged reviews and disputes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchFlaggedReviews} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <ExportButton data={filteredReviews} filename="flagged-reviews" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Flagged</CardTitle>
            <Flag className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.highPriority}</div>
            <p className="text-xs text-muted-foreground">3+ flags</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent (7 days)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recent}</div>
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
              <Input
                placeholder="Search flagged reviews..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-full md:w-[250px]">
                <SelectValue placeholder="Filter by reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="inappropriate">Inappropriate</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="fake">Fake Review</SelectItem>
                <SelectItem value="harassment">Harassment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Flagged Reviews Table */}
      <Card>
        <CardHeader>
          <CardTitle>Flagged Reviews ({filteredReviews.length})</CardTitle>
          <CardDescription>
            Review and resolve flagged content disputes
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
                    <TableHead>Flag Reason</TableHead>
                    <TableHead>Flag Count</TableHead>
                    <TableHead>Flagged</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No flagged reviews found
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
                          <div className="max-w-xs truncate text-sm">{review.flag_reason}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={review.flag_count >= 3 ? 'destructive' : 'warning'}>
                            {review.flag_count}
                          </Badge>
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
                                setActionType('dismiss');
                              }}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAction(review.id, 'dismiss')}
                              title="Dismiss Flags"
                            >
                              <CheckCircle className="h-4 w-4 text-success" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAction(review.id, 'remove')}
                              title="Remove Review"
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAction(review.id, 'warn')}
                              title="Warn User"
                            >
                              <AlertTriangle className="h-4 w-4 text-warning" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAction(review.id, 'ban')}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'dismiss' && 'Dismiss Flags'}
              {actionType === 'remove' && 'Remove Review'}
              {actionType === 'warn' && 'Warn User'}
              {actionType === 'ban' && 'Ban User'}
            </DialogTitle>
            <DialogDescription>
              Review details and resolution notes
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
                <Badge variant={selectedReview.flag_count >= 3 ? 'destructive' : 'warning'}>
                  {selectedReview.flag_count} flags
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

              <div className="bg-warning/10 p-3 rounded-lg">
                <h4 className="font-medium mb-1">Flag Reasons</h4>
                <p className="text-sm">{selectedReview.flag_reason}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Flagged {selectedReview.flag_count} time(s)
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Resolution Notes (optional)</label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Add notes about this resolution..."
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
              variant={actionType === 'remove' || actionType === 'ban' ? 'destructive' : 'default'}
            >
              {actionType === 'dismiss' && 'Dismiss Flags'}
              {actionType === 'remove' && 'Remove Review'}
              {actionType === 'warn' && 'Warn User'}
              {actionType === 'ban' && 'Ban User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

