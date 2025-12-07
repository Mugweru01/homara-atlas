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
  Gavel, 
  TrendingUp, 
  Clock, 
  Users, 
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Calendar,
  DollarSign,
  BarChart3,
  Square,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

interface AuctionStats {
  active_auctions: number;
  total_bids: number;
  total_bid_value_kes: number;
  queue_size: number;
  processing_rate: number;
  current_session_status: string | null;
}

interface AuctionSession {
  id: string;
  session_start_at: string;
  session_end_at: string;
  week_number: number;
  year: number;
  total_listings: number | null;
  active_listings: number | null;
  total_bids: number | null;
  peak_concurrent_users: number | null;
  peak_bids_per_second: number | null;
  status: string | null;
  created_at: string;
}

interface ActiveAuction {
  id: string;
  title: string;
  starting_price_kes: number;
  current_bid_kes: number | null;
  bid_count: number | null;
  auction_start_at: string | null;
  auction_end_at: string | null;
  auction_status: string | null;
  seller_id: string;
  seller_name?: string;
}

// Count-up animation hook
function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return count;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  bgColor,
  index 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  index: number;
}) {
  const animatedValue = typeof value === 'number' ? useCountUp(value, 1200) : value;

  return (
    <Card
      className="group relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02] animate-fade-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-2xl transform translate-x-8 -translate-y-8"></div>

      <CardHeader className="relative flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
          {title}
        </CardTitle>
        <div className={`rounded-xl p-2.5 ${bgColor} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div className="text-4xl font-bold tracking-tight">
          {typeof animatedValue === 'number' ? animatedValue.toLocaleString() : animatedValue}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Auctions() {
  const [stats, setStats] = useState<AuctionStats | null>(null);
  const [sessions, setSessions] = useState<AuctionSession[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<ActiveAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchAuctionData = async () => {
    try {
      setLoading(true);

      // Fetch current session stats
      const { data: currentSession, error: sessionError } = await supabase
        .from('auction_sessions')
        .select('*')
        .order('session_start_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionError && sessionError.code !== 'PGRST116') {
        throw sessionError;
      }

      // Fetch active auctions
      const { data: auctionsData, error: auctionsError } = await supabase
        .from('marketplace_listings')
        .select(`
          id,
          title,
          starting_price_kes,
          current_bid_kes,
          bid_count,
          auction_start_at,
          auction_end_at,
          auction_status,
          seller_id,
          profiles!marketplace_listings_seller_id_fkey(full_name)
        `)
        .eq('listing_type', 'auction')
        .in('auction_status', ['active', 'scheduled', 'ending_soon'])
        .order('auction_start_at', { ascending: false })
        .limit(20);

      if (auctionsError) throw auctionsError;

      // Fetch bid queue stats
      const { data: queueData, error: queueError } = await supabase
        .from('bid_queue')
        .select('id, status')
        .in('status', ['pending', 'processing']);

      if (queueError) throw queueError;

      // Fetch total bids count
      const { data: bidsData, error: bidsError } = await supabase
        .from('marketplace_bids')
        .select('amount_kes', { count: 'exact', head: true });

      if (bidsError) throw bidsError;

      // Calculate total bid value
      const { data: bidsValueData, error: bidsValueError } = await supabase
        .from('marketplace_bids')
        .select('amount_kes');

      if (bidsValueError) throw bidsValueError;

      const totalBidValue = bidsValueData?.reduce((sum, bid) => sum + Number(bid.amount_kes || 0), 0) || 0;

      // Fetch recent sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('auction_sessions')
        .select('*')
        .order('session_start_at', { ascending: false })
        .limit(10);

      if (sessionsError) throw sessionsError;

      // Process active auctions with seller names
      const processedAuctions = (auctionsData || []).map((auction: any) => ({
        id: auction.id,
        title: auction.title,
        starting_price_kes: auction.starting_price_kes,
        current_bid_kes: auction.current_bid_kes,
        bid_count: auction.bid_count,
        auction_start_at: auction.auction_start_at,
        auction_end_at: auction.auction_end_at,
        auction_status: auction.auction_status,
        seller_id: auction.seller_id,
        seller_name: auction.profiles?.full_name || 'Unknown',
      }));

      setActiveAuctions(processedAuctions);
      setSessions(sessionsData || []);

      // Calculate stats
      setStats({
        active_auctions: processedAuctions.length,
        total_bids: bidsData?.length || 0,
        total_bid_value_kes: totalBidValue,
        queue_size: queueData?.length || 0,
        processing_rate: 0, // TODO: Calculate from queue processing
        current_session_status: currentSession?.status || 'No active session',
      });

      toast({
        title: 'Data refreshed',
        description: 'Auction data has been updated',
      });
    } catch (error) {
      logger.error('Error fetching auction data', { error });
      toast({
        title: 'Error',
        description: 'Failed to load auction data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctionData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAuctionData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500 text-white"><Calendar className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case 'ending_soon':
        return <Badge className="bg-warning text-warning-foreground"><Clock className="h-3 w-3 mr-1" />Ending Soon</Badge>;
      case 'completed':
        return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredSessions = sessions.filter(session => {
    if (sessionFilter === 'all') return true;
    if (sessionFilter === 'active') return session.status === 'active';
    if (sessionFilter === 'completed') return session.status === 'completed';
    return true;
  });

  const filteredAuctions = activeAuctions.filter(auction => {
    if (statusFilter === 'all') return true;
    return auction.auction_status === statusFilter;
  });

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading auction data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auction Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage marketplace auctions and bidding system
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchAuctionData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link to="/admin/marketplace/sessions">
            <Button>
              <Calendar className="h-4 w-4 mr-2" />
              Manage Sessions
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Auctions"
          value={stats?.active_auctions || 0}
          icon={Gavel}
          color="text-primary"
          bgColor="bg-primary/10"
          index={0}
        />
        <StatCard
          title="Total Bids"
          value={stats?.total_bids || 0}
          icon={TrendingUp}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
          index={1}
        />
        <StatCard
          title="Bid Value (KES)"
          value={`KES ${(stats?.total_bid_value_kes || 0).toLocaleString()}`}
          icon={DollarSign}
          color="text-green-500"
          bgColor="bg-green-500/10"
          index={2}
        />
        <StatCard
          title="Queue Size"
          value={stats?.queue_size || 0}
          icon={Activity}
          color="text-orange-500"
          bgColor="bg-orange-500/10"
          index={3}
        />
      </div>

      {/* Current Session Status */}
      {stats?.current_session_status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Current Session Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={stats.current_session_status === 'active' ? 'default' : 'secondary'}>
                {stats.current_session_status}
              </Badge>
              {sessions[0] && (
                <span className="text-sm text-muted-foreground">
                  Week {sessions[0].week_number}, {sessions[0].year}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Auctions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Auctions</CardTitle>
              <CardDescription>Currently running and scheduled auctions</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="ending_soon">Ending Soon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAuctions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active auctions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Starting Price</TableHead>
                  <TableHead>Current Bid</TableHead>
                  <TableHead>Bids</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuctions.map((auction) => (
                  <TableRow key={auction.id}>
                    <TableCell className="font-medium">{auction.title}</TableCell>
                    <TableCell>{auction.seller_name}</TableCell>
                    <TableCell>KES {Number(auction.starting_price_kes).toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">
                      {auction.current_bid_kes 
                        ? `KES ${Number(auction.current_bid_kes).toLocaleString()}`
                        : 'No bids'
                      }
                    </TableCell>
                    <TableCell>{auction.bid_count || 0}</TableCell>
                    <TableCell>{getStatusBadge(auction.auction_status)}</TableCell>
                    <TableCell>
                      {auction.auction_end_at 
                        ? format(new Date(auction.auction_end_at), 'MMM dd, HH:mm')
                        : 'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      <Link to={`/admin/marketplace/auctions/${auction.id}`}>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Auction Sessions</CardTitle>
              <CardDescription>Weekly auction session history</CardDescription>
            </div>
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter sessions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No auction sessions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Listings</TableHead>
                  <TableHead>Total Bids</TableHead>
                  <TableHead>Peak Users</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      Week {session.week_number}, {session.year}
                    </TableCell>
                    <TableCell>
                      {format(new Date(session.session_start_at), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      {format(new Date(session.session_end_at), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>{session.total_listings || 0}</TableCell>
                    <TableCell>{session.total_bids || 0}</TableCell>
                    <TableCell>{session.peak_concurrent_users || 0}</TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

