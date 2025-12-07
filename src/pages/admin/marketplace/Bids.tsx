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
  Gavel,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  User,
  DollarSign,
  Link as LinkIcon,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ExportButton } from '@/components/admin/ExportButton';

interface Bid {
  id: string;
  listing_id: string;
  listing_title?: string;
  bidder_id: string;
  bidder_name?: string;
  bidder_email?: string;
  amount_kes: number;
  previous_bid_id: string | null;
  bid_source: string | null;
  user_agent: string | null;
  ip_address: string | null;
  status: string | null;
  invalid_reason: string | null;
  created_at: string;
}

export default function Bids() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);

  useEffect(() => {
    fetchBids();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBids, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchBids = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('marketplace_bids')
        .select(`
          *,
          listing:marketplace_listings!marketplace_bids_listing_id_fkey(id, title),
          bidder:profiles!marketplace_bids_bidder_id_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Process bids
      const processedBids = (data || []).map((bid: any) => ({
        id: bid.id,
        listing_id: bid.listing_id,
        listing_title: (bid.listing as any)?.title || 'Unknown Listing',
        bidder_id: bid.bidder_id,
        bidder_name: (bid.bidder as any)?.full_name || 'Unknown',
        bidder_email: (bid.bidder as any)?.email || null,
        amount_kes: bid.amount_kes,
        previous_bid_id: bid.previous_bid_id,
        bid_source: bid.bid_source,
        user_agent: bid.user_agent,
        ip_address: bid.ip_address,
        status: bid.status,
        invalid_reason: bid.invalid_reason,
        created_at: bid.created_at,
      }));

      setBids(processedBids);
    } catch (error) {
      logger.error('Error fetching bids', { error });
      toast({
        title: 'Error',
        description: 'Failed to load bids',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const detectSuspiciousBids = (bid: Bid): boolean => {
    // Check for suspicious patterns
    const checks = [];

    // 1. Very rapid consecutive bids from same bidder
    const recentBidsFromBidder = bids.filter(b => 
      b.bidder_id === bid.bidder_id && 
      new Date(b.created_at).getTime() > new Date(bid.created_at).getTime() - 60000 // Last minute
    );
    if (recentBidsFromBidder.length > 5) {
      checks.push('Rapid bidding pattern');
    }

    // 2. Invalid status
    if (bid.status && bid.status !== 'valid') {
      checks.push(`Invalid: ${bid.status}`);
    }

    // 3. Missing user agent or IP
    if (!bid.user_agent || !bid.ip_address) {
      checks.push('Missing metadata');
    }

    // 4. Unusual bid source
    if (bid.bid_source && !['web', 'mobile', 'api'].includes(bid.bid_source.toLowerCase())) {
      checks.push(`Unusual source: ${bid.bid_source}`);
    }

    return checks.length > 0;
  };

  const getStatusBadge = (status: string | null) => {
    if (!status || status === 'valid') {
      return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Valid</Badge>;
    }
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>;
  };

  const filteredBids = bids.filter(bid => {
    // Search filter
    const matchesSearch = !search ||
      bid.bidder_name?.toLowerCase().includes(search.toLowerCase()) ||
      bid.bidder_email?.toLowerCase().includes(search.toLowerCase()) ||
      bid.listing_title?.toLowerCase().includes(search.toLowerCase()) ||
      bid.id.toLowerCase().includes(search.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'valid' && (!bid.status || bid.status === 'valid')) ||
      (statusFilter === 'invalid' && bid.status && bid.status !== 'valid') ||
      bid.status === statusFilter;

    // Source filter
    const matchesSource = sourceFilter === 'all' ||
      (sourceFilter === 'unknown' && !bid.bid_source) ||
      bid.bid_source === sourceFilter;

    // Suspicious filter
    const matchesSuspicious = !suspiciousOnly || detectSuspiciousBids(bid);

    return matchesSearch && matchesStatus && matchesSource && matchesSuspicious;
  });

  const suspiciousBids = filteredBids.filter(bid => detectSuspiciousBids(bid));

  const exportData = () => {
    return filteredBids.map(bid => ({
      'Bid ID': bid.id,
      'Listing': bid.listing_title,
      'Bidder': bid.bidder_name,
      'Email': bid.bidder_email || '',
      'Amount (KES)': Number(bid.amount_kes),
      'Source': bid.bid_source || 'Unknown',
      'Status': bid.status || 'valid',
      'Invalid Reason': bid.invalid_reason || '',
      'IP Address': bid.ip_address || '',
      'Created At': format(new Date(bid.created_at), 'yyyy-MM-dd HH:mm:ss'),
    }));
  };

  if (loading && bids.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading bids...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bid Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage all marketplace bids
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchBids}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <ExportButton data={exportData()} filename="bids" />
        </div>
      </div>

      {/* Suspicious Bids Alert */}
      {suspiciousBids.length > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Suspicious Bids Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {suspiciousBids.length} bid{suspiciousBids.length !== 1 ? 's' : ''} flagged as suspicious. 
              Review these bids carefully.
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bids..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="invalid">Invalid</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={suspiciousOnly ? 'default' : 'outline'}
              onClick={() => setSuspiciousOnly(!suspiciousOnly)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {suspiciousOnly ? 'Show All' : 'Suspicious Only'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bids</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredBids.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {bids.length} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valid Bids</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {filteredBids.filter(b => !b.status || b.status === 'valid').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invalid Bids</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {filteredBids.filter(b => b.status && b.status !== 'valid').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Suspicious</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {suspiciousBids.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bids Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bid History</CardTitle>
          <CardDescription>
            Showing {filteredBids.length} of {bids.length} bids
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredBids.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No bids found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Listing</TableHead>
                  <TableHead>Bidder</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Metadata</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBids.map((bid) => {
                  const isSuspicious = detectSuspiciousBids(bid);
                  return (
                    <TableRow 
                      key={bid.id}
                      className={isSuspicious ? 'bg-warning/5' : ''}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(new Date(bid.created_at), 'MMM dd, yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(bid.created_at), 'HH:mm:ss')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/admin/marketplace/auctions/${bid.listing_id}`}
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {bid.listing_title}
                          <LinkIcon className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{bid.bidder_name}</p>
                          {bid.bidder_email && (
                            <p className="text-xs text-muted-foreground">{bid.bidder_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        KES {Number(bid.amount_kes).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{bid.bid_source || 'Unknown'}</Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(bid.status)}
                        {bid.invalid_reason && (
                          <p className="text-xs text-destructive mt-1">{bid.invalid_reason}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          {bid.ip_address && (
                            <p className="text-muted-foreground">IP: {bid.ip_address}</p>
                          )}
                          {bid.user_agent && (
                            <p className="text-muted-foreground truncate max-w-[200px]" title={bid.user_agent}>
                              {bid.user_agent.substring(0, 30)}...
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isSuspicious && (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Suspicious
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

