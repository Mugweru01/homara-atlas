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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calendar, 
  Clock, 
  Play, 
  Pause, 
  Square,
  RefreshCw,
  CheckCircle,
  XCircle,
  TrendingUp,
  Users,
  BarChart3,
  Activity,
  Gavel,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

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
  updated_at: string;
}

export default function Sessions() {
  const [sessions, setSessions] = useState<AuctionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isControlDialogOpen, setIsControlDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AuctionSession | null>(null);
  const [action, setAction] = useState<'start' | 'pause' | 'end' | null>(null);
  
  const [newSession, setNewSession] = useState({
    session_start_at: '',
    session_end_at: '',
    week_number: new Date().getWeek(),
    year: new Date().getFullYear(),
  });

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('auction_sessions')
        .select('*')
        .order('session_start_at', { ascending: false });

      if (error) throw error;

      setSessions(data || []);
    } catch (error) {
      logger.error('Error fetching auction sessions', { error });
      toast({
        title: 'Error',
        description: 'Failed to load auction sessions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    try {
      // TODO: Implement session creation via RPC function
      // This should validate dates, check for conflicts, etc.
      toast({
        title: 'Info',
        description: 'Session creation functionality coming soon',
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      logger.error('Error creating session', { error });
      toast({
        title: 'Error',
        description: 'Failed to create session',
        variant: 'destructive',
      });
    }
  };

  const handleSessionControl = async () => {
    if (!selectedSession || !action) return;

    try {
      // TODO: Implement session control via RPC function
      // This should handle start/pause/end actions
      toast({
        title: 'Info',
        description: `Session ${action} functionality coming soon`,
      });
      setIsControlDialogOpen(false);
      setSelectedSession(null);
      setAction(null);
    } catch (error) {
      logger.error('Error controlling session', { error });
      toast({
        title: 'Error',
        description: `Failed to ${action} session`,
        variant: 'destructive',
      });
    }
  };

  const openControlDialog = (session: AuctionSession, actionType: 'start' | 'pause' | 'end') => {
    setSelectedSession(session);
    setAction(actionType);
    setIsControlDialogOpen(true);
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500 text-white"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case 'paused':
        return <Badge className="bg-warning text-warning-foreground"><Pause className="h-3 w-3 mr-1" />Paused</Badge>;
      case 'completed':
        return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredSessions = sessions.filter(session => {
    if (statusFilter === 'all') return true;
    return session.status === statusFilter;
  });

  const currentSession = sessions.find(s => s.status === 'active');

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auction Sessions</h1>
          <p className="text-muted-foreground mt-1">
            Manage weekly auction sessions and schedules
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchSessions}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link to="/admin/marketplace/auctions">
            <Button variant="outline">
              <Gavel className="h-4 w-4 mr-2" />
              Back to Auctions
            </Button>
          </Link>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Calendar className="h-4 w-4 mr-2" />
            Create Session
          </Button>
        </div>
      </div>

      {/* Current Session Status */}
      {currentSession && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Current Active Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Week</p>
                <p className="text-lg font-semibold">
                  Week {currentSession.week_number}, {currentSession.year}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Listings</p>
                <p className="text-lg font-semibold">{currentSession.active_listings || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Bids</p>
                <p className="text-lg font-semibold">{currentSession.total_bids || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Peak Users</p>
                <p className="text-lg font-semibold">{currentSession.peak_concurrent_users || 0}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openControlDialog(currentSession, 'pause')}
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause Session
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => openControlDialog(currentSession, 'end')}
              >
                <Square className="h-4 w-4 mr-2" />
                End Session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Auction Sessions</CardTitle>
              <CardDescription>Weekly auction session history and management</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
                  <TableHead>Active</TableHead>
                  <TableHead>Total Bids</TableHead>
                  <TableHead>Peak Users</TableHead>
                  <TableHead>Peak Bids/sec</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
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
                    <TableCell>{session.active_listings || 0}</TableCell>
                    <TableCell>{session.total_bids || 0}</TableCell>
                    <TableCell>{session.peak_concurrent_users || 0}</TableCell>
                    <TableCell>
                      {session.peak_bids_per_second 
                        ? Number(session.peak_bids_per_second).toFixed(2)
                        : '0'
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {session.status === 'scheduled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openControlDialog(session, 'start')}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {session.status === 'active' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openControlDialog(session, 'pause')}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openControlDialog(session, 'end')}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {session.status === 'paused' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openControlDialog(session, 'start')}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Session Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Auction Session</DialogTitle>
            <DialogDescription>
              Schedule a new weekly auction session
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="datetime-local"
                value={newSession.session_start_at}
                onChange={(e) => setNewSession({ ...newSession, session_start_at: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="datetime-local"
                value={newSession.session_end_at}
                onChange={(e) => setNewSession({ ...newSession, session_end_at: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="week">Week Number</Label>
              <Input
                id="week"
                type="number"
                value={newSession.week_number}
                onChange={(e) => setNewSession({ ...newSession, week_number: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={newSession.year}
                onChange={(e) => setNewSession({ ...newSession, year: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSession}>
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Control Dialog */}
      <Dialog open={isControlDialogOpen} onOpenChange={setIsControlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'start' && 'Start Session'}
              {action === 'pause' && 'Pause Session'}
              {action === 'end' && 'End Session'}
            </DialogTitle>
            <DialogDescription>
              {action === 'start' && 'Are you sure you want to start this auction session?'}
              {action === 'pause' && 'This will pause the auction session. Auctions will be temporarily halted.'}
              {action === 'end' && 'This will end the auction session. All active auctions will be finalized.'}
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Week:</strong> Week {selectedSession.week_number}, {selectedSession.year}
              </p>
              <p className="text-sm">
                <strong>Status:</strong> {selectedSession.status}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsControlDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSessionControl}
              variant={action === 'end' ? 'destructive' : 'default'}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to get week number (simplified)
declare global {
  interface Date {
    getWeek(): number;
  }
}

Date.prototype.getWeek = function() {
  const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

