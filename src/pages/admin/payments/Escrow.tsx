import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Shield,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Lock,
  Unlock,
  DollarSign,
  User,
  Search,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface EscrowDeposit {
  id: string;
  transaction_id: string;
  user_id: string;
  listing_id?: string;
  amount: number;
  currency: string;
  status: string;
  hold_reason?: string;
  released_at?: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  metadata?: any;
}

interface EscrowStats {
  total_escrow: number;
  held_amount: number;
  released_amount: number;
  pending_releases: number;
}

export default function Escrow() {
  const [escrowDeposits, setEscrowDeposits] = useState<EscrowDeposit[]>([]);
  const [stats, setStats] = useState<EscrowStats>({
    total_escrow: 0,
    held_amount: 0,
    released_amount: 0,
    pending_releases: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDeposit, setSelectedDeposit] = useState<EscrowDeposit | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'release' | 'hold' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchEscrowDeposits = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('escrow_deposits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const deposits: EscrowDeposit[] = (data || []).map((d: any) => ({
        id: d.id,
        transaction_id: d.transaction_id || d.id,
        user_id: d.user_id,
        listing_id: d.listing_id,
        amount: d.amount || 0,
        currency: d.currency || 'KES',
        status: d.status || 'held',
        hold_reason: d.hold_reason,
        released_at: d.released_at,
        created_at: d.created_at,
        updated_at: d.updated_at || d.created_at,
        metadata: d.metadata || {},
      }));

      // Fetch user info
      const userIds = [...new Set(deposits.map(d => d.user_id))];
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, first_name, last_name')
          .in('id', userIds);

        if (users) {
          const userMap = new Map(users.map(u => [u.id, u]));
          deposits.forEach(d => {
            const user = userMap.get(d.user_id);
            if (user) {
              d.user_email = user.email;
              d.user_name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
            }
          });
        }
      }

      setEscrowDeposits(deposits);

      // Calculate stats
      const held = deposits.filter(d => d.status === 'held');
      const released = deposits.filter(d => d.status === 'released');
      const pending = deposits.filter(d => d.status === 'pending_release');

      setStats({
        total_escrow: deposits.length,
        held_amount: held.reduce((sum, d) => sum + (d.amount || 0), 0),
        released_amount: released.reduce((sum, d) => sum + (d.amount || 0), 0),
        pending_releases: pending.length,
      });
    } catch (error) {
      logger.error('Error fetching escrow deposits:', error);
      toast({
        title: 'Error',
        description: 'Failed to load escrow deposits',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscrowDeposits();
    const interval = setInterval(fetchEscrowDeposits, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = (deposit: EscrowDeposit, type: 'release' | 'hold') => {
    setSelectedDeposit(deposit);
    setActionType(type);
    setActionNote('');
    setActionDialogOpen(true);
  };

  const processAction = async () => {
    if (!selectedDeposit || !actionType) return;

    try {
      setProcessing(true);

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (actionType === 'release') {
        updateData.status = 'released';
        updateData.released_at = new Date().toISOString();
      } else if (actionType === 'hold') {
        updateData.status = 'held';
        if (actionNote) {
          updateData.hold_reason = actionNote;
        }
      }

      // Add note to metadata
      if (actionNote) {
        updateData.metadata = {
          ...(selectedDeposit.metadata || {}),
          admin_note: actionNote,
          admin_action: actionType,
          admin_action_date: new Date().toISOString(),
        };
      }

      const { error } = await supabase
        .from('escrow_deposits')
        .update(updateData)
        .eq('id', selectedDeposit.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Escrow deposit ${actionType === 'release' ? 'released' : 'held'} successfully`,
      });

      setActionDialogOpen(false);
      setSelectedDeposit(null);
      setActionType(null);
      setActionNote('');
      fetchEscrowDeposits();
    } catch (error) {
      logger.error('Error processing escrow action:', error);
      toast({
        title: 'Error',
        description: 'Failed to process action',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const filteredDeposits = escrowDeposits.filter(d => {
    const matchesSearch = 
      d.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      held: { label: 'Held', variant: 'secondary' },
      released: { label: 'Released', variant: 'default' },
      pending_release: { label: 'Pending Release', variant: 'outline' },
    };

    const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Escrow Management</h1>
          <p className="text-muted-foreground">
            Manage escrow deposits, releases, and holds
          </p>
        </div>
        <Button onClick={fetchEscrowDeposits} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Escrow</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_escrow}</div>
            <p className="text-xs text-muted-foreground">
              Total deposits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Held Amount</CardTitle>
            <Lock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              KES {stats.held_amount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently held
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Released Amount</CardTitle>
            <Unlock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              KES {stats.released_amount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total released
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Releases</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending_releases}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting release
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search deposits, users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="held">Held</SelectItem>
                <SelectItem value="released">Released</SelectItem>
                <SelectItem value="pending_release">Pending Release</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Escrow Deposits Table */}
      <Card>
        <CardHeader>
          <CardTitle>Escrow Deposits ({filteredDeposits.length})</CardTitle>
          <CardDescription>
            Manage all escrow deposits and releases
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDeposits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No escrow deposits found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hold Reason</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeposits.map((deposit) => (
                    <TableRow key={deposit.id}>
                      <TableCell className="font-mono text-sm">
                        {deposit.transaction_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{deposit.user_name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">{deposit.user_email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {deposit.currency} {deposit.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {deposit.hold_reason || '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(deposit.created_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {deposit.status === 'held' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(deposit, 'release')}
                            >
                              <Unlock className="h-4 w-4 mr-1" />
                              Release
                            </Button>
                          )}
                          {deposit.status !== 'held' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(deposit, 'hold')}
                            >
                              <Lock className="h-4 w-4 mr-1" />
                              Hold
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
              {actionType === 'release' && 'Release Escrow Deposit'}
              {actionType === 'hold' && 'Hold Escrow Deposit'}
            </DialogTitle>
            <DialogDescription>
              {selectedDeposit && (
                <>
                  Transaction: {selectedDeposit.transaction_id.substring(0, 8)}...<br />
                  Amount: {selectedDeposit.currency} {selectedDeposit.amount.toLocaleString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note">
                {actionType === 'release' ? 'Release Note (optional)' : 'Hold Reason'}
              </Label>
              <Textarea
                id="note"
                placeholder={actionType === 'release' ? 'Add a note about this release...' : 'Enter reason for holding...'}
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                rows={3}
                required={actionType === 'hold'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={processAction} disabled={processing || (actionType === 'hold' && !actionNote)}>
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {actionType === 'release' && 'Release'}
                  {actionType === 'hold' && 'Hold'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

