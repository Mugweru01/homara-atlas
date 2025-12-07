import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Queue,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Activity,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  Gavel,
  User,
  DollarSign,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface QueueItem {
  id: string;
  listing_id: string;
  listing_title?: string;
  bidder_id: string;
  bidder_name?: string;
  bid_amount_kes: number;
  queue_position: number | null;
  estimated_wait_seconds: number | null;
  status: string | null;
  processed_at: string | null;
  error_message: string | null;
  retry_count: number | null;
  created_at: string;
  expires_at: string | null;
}

export default function BidQueue() {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isProcessingDialogOpen, setIsProcessingDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | 'retry' | null>(null);

  useEffect(() => {
    fetchQueueData();
    // Auto-refresh every 5 seconds for real-time monitoring
    const interval = setInterval(fetchQueueData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueueData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bid_queue')
        .select(`
          *,
          listing:marketplace_listings!bid_queue_listing_id_fkey(id, title),
          bidder:profiles!bid_queue_bidder_id_fkey(id, full_name)
        `)
        .order('queue_position', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Process queue items
      const processedItems = (data || []).map((item: any) => ({
        id: item.id,
        listing_id: item.listing_id,
        listing_title: (item.listing as any)?.title || 'Unknown Listing',
        bidder_id: item.bidder_id,
        bidder_name: (item.bidder as any)?.full_name || 'Unknown',
        bid_amount_kes: item.bid_amount_kes,
        queue_position: item.queue_position,
        estimated_wait_seconds: item.estimated_wait_seconds,
        status: item.status,
        processed_at: item.processed_at,
        error_message: item.error_message,
        retry_count: item.retry_count,
        created_at: item.created_at,
        expires_at: item.expires_at,
      }));

      setQueueItems(processedItems);
    } catch (error) {
      logger.error('Error fetching bid queue', { error });
      toast({
        title: 'Error',
        description: 'Failed to load bid queue',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQueueAction = async () => {
    if (!selectedItem || !action) return;

    try {
      // TODO: Implement queue actions via RPC function
      // This should handle approve/reject/retry
      toast({
        title: 'Info',
        description: `Queue ${action} functionality coming soon`,
      });
      setIsProcessingDialogOpen(false);
      setSelectedItem(null);
      setAction(null);
      fetchQueueData();
    } catch (error) {
      logger.error('Error processing queue item', { error });
      toast({
        title: 'Error',
        description: `Failed to ${action} queue item`,
        variant: 'destructive',
      });
    }
  };

  const openActionDialog = (item: QueueItem, actionType: 'approve' | 'reject' | 'retry') => {
    setSelectedItem(item);
    setAction(actionType);
    setIsProcessingDialogOpen(true);
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge className="bg-blue-500 text-white"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'processing':
        return <Badge className="bg-warning text-warning-foreground"><Activity className="h-3 w-3 mr-1" />Processing</Badge>;
      case 'processed':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Processed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'expired':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredItems = queueItems.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  const pendingItems = queueItems.filter(item => item.status === 'pending' || item.status === 'processing');
  const failedItems = queueItems.filter(item => item.status === 'failed');
  const processedItems = queueItems.filter(item => item.status === 'processed');

  // Calculate average wait time
  const avgWaitTime = pendingItems.length > 0
    ? Math.round(pendingItems.reduce((sum, item) => sum + (item.estimated_wait_seconds || 0), 0) / pendingItems.length)
    : 0;

  // Calculate processing rate (items per minute)
  const recentProcessed = processedItems.filter(item => {
    if (!item.processed_at) return false;
    const processedTime = new Date(item.processed_at).getTime();
    const oneMinuteAgo = Date.now() - 60000;
    return processedTime > oneMinuteAgo;
  });
  const processingRate = recentProcessed.length;

  if (loading && queueItems.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading queue data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bid Queue Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage the bid processing queue
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchQueueData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Queue Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Queue Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingItems.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {queueItems.length} total items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processing Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processingRate}</div>
            <p className="text-xs text-muted-foreground mt-1">
              items/min
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Wait Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.floor(avgWaitTime / 60)}m</div>
            <p className="text-xs text-muted-foreground mt-1">
              {avgWaitTime % 60}s remaining
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{failedItems.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {failedItems.length > 0 && 'Needs attention'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Health Alert */}
      {pendingItems.length > 100 && (
        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              High Queue Load
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Queue size is high ({pendingItems.length} items). Consider scaling processing capacity.
            </p>
          </CardContent>
        </Card>
      )}

      {failedItems.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Failed Items Require Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {failedItems.length} item{failedItems.length !== 1 ? 's' : ''} failed processing. Review and retry as needed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Items</CardTitle>
          <CardDescription>
            Showing {filteredItems.length} of {queueItems.length} items
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Queue className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No queue items found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead>Bidder</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Wait Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.queue_position !== null ? (
                        <Badge variant="outline">#{item.queue_position}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/admin/marketplace/auctions/${item.listing_id}`}
                        className="text-primary hover:underline"
                      >
                        {item.listing_title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{item.bidder_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      KES {Number(item.bid_amount_kes).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {item.estimated_wait_seconds !== null ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{Math.floor(item.estimated_wait_seconds / 60)}m {item.estimated_wait_seconds % 60}s</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item.status)}
                      {item.retry_count !== null && item.retry_count > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Retries: {item.retry_count}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {format(new Date(item.created_at), 'MMM dd, HH:mm')}
                        </span>
                        {item.processed_at && (
                          <span className="text-xs text-muted-foreground">
                            Processed: {format(new Date(item.processed_at), 'HH:mm:ss')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {item.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActionDialog(item, 'approve')}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {item.status === 'failed' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openActionDialog(item, 'retry')}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openActionDialog(item, 'reject')}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                      {item.error_message && (
                        <p className="text-xs text-destructive mt-1" title={item.error_message}>
                          {item.error_message.substring(0, 30)}...
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Processing Dialog */}
      <Dialog open={isProcessingDialogOpen} onOpenChange={setIsProcessingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' && 'Approve Queue Item'}
              {action === 'reject' && 'Reject Queue Item'}
              {action === 'retry' && 'Retry Failed Item'}
            </DialogTitle>
            <DialogDescription>
              {action === 'approve' && 'This will immediately process this bid.'}
              {action === 'reject' && 'This will reject and remove this bid from the queue.'}
              {action === 'retry' && 'This will retry processing this failed bid.'}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Listing:</strong> {selectedItem.listing_title}
              </p>
              <p className="text-sm">
                <strong>Bidder:</strong> {selectedItem.bidder_name}
              </p>
              <p className="text-sm">
                <strong>Amount:</strong> KES {Number(selectedItem.bid_amount_kes).toLocaleString()}
              </p>
              {selectedItem.error_message && (
                <p className="text-sm text-destructive">
                  <strong>Error:</strong> {selectedItem.error_message}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessingDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleQueueAction}
              variant={action === 'reject' ? 'destructive' : 'default'}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

