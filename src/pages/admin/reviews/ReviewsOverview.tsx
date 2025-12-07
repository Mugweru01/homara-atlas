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
  Search,
  RefreshCw,
  Eye,
  User,
  Home,
  Clock,
  ThumbsUp,
  MessageSquare,
  CheckCircle,
  XCircle,
  Flag,
  Link as LinkIcon,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Link } from 'react-router-dom';

interface Review {
  id: string;
  user_id: string;
  user_name?: string;
  property_id: string;
  property_title?: string;
  landlord_id: string | null;
  landlord_name?: string;
  rating: number;
  title: string;
  comment: string;
  images: string[] | null;
  helpful_count: number | null;
  verified: boolean | null;
  landlord_response: string | null;
  landlord_response_at: string | null;
  created_at: string;
  updated_at: string | null;
  flagged_count?: number;
  is_flagged?: boolean;
}

export default function ReviewsOverview() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchReviews();
    const interval = setInterval(fetchReviews, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          user:profiles!reviews_user_id_fkey(id, full_name),
          property:properties!reviews_property_id_fkey(id, title),
          landlord:profiles!reviews_landlord_id_fkey(id, full_name),
          reports:content_reports!content_reports_content_id_fkey(count)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const processedReviews = (data || []).map((review: any) => ({
        id: review.id,
        user_id: review.user_id,
        user_name: (review.user as any)?.full_name || 'Unknown',
        property_id: review.property_id,
        property_title: (review.property as any)?.title || 'Unknown Property',
        landlord_id: review.landlord_id,
        landlord_name: (review.landlord as any)?.full_name || null,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        images: (review.images as any) || [],
        helpful_count: review.helpful_count || 0,
        verified: review.verified || false,
        landlord_response: review.landlord_response,
        landlord_response_at: review.landlord_response_at,
        created_at: review.created_at,
        updated_at: review.updated_at,
        flagged_count: (review.reports as any)?.length || 0,
        is_flagged: (review.reports as any)?.length > 0,
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

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = search === '' || 
      review.title.toLowerCase().includes(search.toLowerCase()) ||
      review.comment.toLowerCase().includes(search.toLowerCase()) ||
      review.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      review.property_title?.toLowerCase().includes(search.toLowerCase());
    
    const matchesRating = ratingFilter === 'all' || 
      (ratingFilter === '5' && review.rating === 5) ||
      (ratingFilter === '4' && review.rating === 4) ||
      (ratingFilter === '3' && review.rating === 3) ||
      (ratingFilter === '2' && review.rating === 2) ||
      (ratingFilter === '1' && review.rating === 1) ||
      (ratingFilter === 'high' && review.rating >= 4) ||
      (ratingFilter === 'low' && review.rating <= 2);

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'flagged' && review.is_flagged) ||
      (statusFilter === 'verified' && review.verified) ||
      (statusFilter === 'unverified' && !review.verified) ||
      (statusFilter === 'with_response' && review.landlord_response) ||
      (statusFilter === 'no_response' && !review.landlord_response);

    return matchesSearch && matchesRating && matchesStatus;
  });

  const stats = {
    total: reviews.length,
    averageRating: reviews.length > 0 
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '0.0',
    flagged: reviews.filter(r => r.is_flagged).length,
    verified: reviews.filter(r => r.verified).length,
    withResponse: reviews.filter(r => r.landlord_response).length,
    fiveStar: reviews.filter(r => r.rating === 5).length,
    oneStar: reviews.filter(r => r.rating === 1).length,
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
          <h1 className="text-3xl font-bold tracking-tight">Reviews Overview</h1>
          <p className="text-muted-foreground">
            Manage and monitor property reviews
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchReviews} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Link to="/admin/reviews/moderation">
            <Button variant="outline">
              Moderation Queue
            </Button>
          </Link>
          <Link to="/admin/reviews/flagged">
            <Button variant="outline">
              Flagged Reviews
            </Button>
          </Link>
          <Link to="/admin/reviews/analytics">
            <Button>
              Analytics
            </Button>
          </Link>
          <ExportButton data={filteredReviews} filename="reviews-overview" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-7">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageRating}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">5 Stars</CardTitle>
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.fiveStar}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">1 Star</CardTitle>
            <Star className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.oneStar}</div>
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
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.verified}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Response</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withResponse}</div>
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
                  placeholder="Search reviews, users, or properties..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="high">4-5 Stars</SelectItem>
                <SelectItem value="low">1-2 Stars</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="flagged">Flagged Only</SelectItem>
                <SelectItem value="verified">Verified Only</SelectItem>
                <SelectItem value="unverified">Unverified Only</SelectItem>
                <SelectItem value="with_response">With Response</SelectItem>
                <SelectItem value="no_response">No Response</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reviews Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reviews ({filteredReviews.length})</CardTitle>
          <CardDescription>
            All property reviews with filters and search
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
                    <TableHead>Helpful</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No reviews found
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
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{review.helpful_count || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {review.verified && (
                              <Badge variant="success" className="w-fit">Verified</Badge>
                            )}
                            {review.is_flagged && (
                              <Badge variant="warning" className="w-fit">Flagged</Badge>
                            )}
                            {review.landlord_response && (
                              <Badge variant="outline" className="w-fit">Has Response</Badge>
                            )}
                            {!review.verified && !review.is_flagged && (
                              <Badge variant="secondary" className="w-fit">Pending</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(review.created_at), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedReview(review);
                              setDetailDialogOpen(true);
                            }}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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

      {/* Review Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>
              Complete review information
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
                <div className="flex gap-2">
                  {selectedReview.verified && (
                    <Badge variant="success">Verified</Badge>
                  )}
                  {selectedReview.is_flagged && (
                    <Badge variant="warning">Flagged ({selectedReview.flagged_count})</Badge>
                  )}
                </div>
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

              {selectedReview.landlord_response && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Landlord Response</h4>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{selectedReview.landlord_response}</p>
                    {selectedReview.landlord_response_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(selectedReview.landlord_response_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-4">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" />
                  <span>{selectedReview.helpful_count || 0} helpful</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Created {format(new Date(selectedReview.created_at), 'MMM d, yyyy HH:mm')}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
            {selectedReview?.is_flagged && (
              <Link to={`/admin/reviews/flagged?review=${selectedReview.id}`}>
                <Button>View Flag Details</Button>
              </Link>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

