import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Wallet,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  DollarSign,
  User,
  Search,
  Send,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';

interface Payout {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  payout_method: string;
  account_details?: any;
  transaction_id?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  notes?: string;
}

interface PayoutStats {
  total_payouts: number;
  pending_payouts: number;
  completed_payouts: number;
  total_amount: number;
  pending_amount: number;
  completed_amount: number;
}

export default function Payouts() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats>({
    total_payouts: 0,
    pending_payouts: 0,
    completed_payouts: 0,
    total_amount: 0,
    pending_amount: 0,
    completed_amount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processNote, setProcessNote] = useState('');

  const fetchPayouts = async () => {
    try {
      setLoading(true);

      // Note: Assuming there's a payouts table, if not, this would need to be created
      // For now, we'll check if it exists and handle gracefully
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = table doesn't exist
        throw error;
      }

      const payoutsData: Payout[] = (data || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        amount: p.amount || 0,
        currency: p.currency || 'KES',
        status: p.status || 'pending',
        payout_method: p.payout_method || 'bank_transfer',
        account_details: p.account_details,
        transaction_id: p.transaction_id,
        processed_at: p.processed_at,
        created_at: p.created_at,
        updated_at: p.updated_at || p.created_at,
        notes: p.notes,
      }));

      // Fetch user info
      const userIds = [...new Set(payoutsData.map(p => p.user_id))];
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, first_name, last_name')
          .in('id', userIds);

        if (users) {
          const userMap = new Map(users.map(u => [u.id, u]));
          payoutsData.forEach(p => {
            const user = userMap.get(p.user_id);
            if (user) {
              p.user_email = user.email;
              p.user_name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
            }
          });
        }
      }

      setPayouts(payoutsData);

      // Calculate stats
      const pending = payoutsData.filter(p => p.status === 'pending' || p.status === 'processing');
      const completed = payoutsData.filter(p => p.status === 'completed' || p.status === 'success');

      setStats({
        total_payouts: payoutsData.length,
        pending_payouts: pending.length,
        completed_payouts: completed.length,
        total_amount: payoutsData.reduce((sum, p) => sum + (p.amount || 0), 0),
        pending_amount: pending.reduce((sum, p) => sum + (p.amount || 0), 0),
        completed_amount: completed.reduce((sum, p) => sum + (p.amount || 0), 0),
      });
    } catch (error) {
      logger.error('Error fetching payouts:', error);
      // Don't show error if table doesn't exist - just show empty state
      if ((error as any)?.code !== 'PGRST116') {
        toast({
          title: 'Error',
          description: 'Failed to load payouts',
          variant: 'destructive',
        });
      }
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
    const interval = setInterval(fetchPayouts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleProcessPayout = (payout: Payout) => {
    setSelectedPayout(payout);
    setProcessNote('');
    setProcessDialogOpen(true);
  };

  const processPayout = async () => {
    if (!selectedPayout) return;

    try {
      setProcessing(true);

      const { error } = await supabase
        .from('payouts')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          notes: processNote || selectedPayout.notes,
        })
        .eq('id', selectedPayout.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Payout processed successfully',
      });

      setProcessDialogOpen(false);
      setSelectedPayout(null);
      setProcessNote('');
      fetchPayouts();
    } catch (error) {
      logger.error('Error processing payout:', error);
      toast({
        title: 'Error',
        description: 'Failed to process payout',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const filteredPayouts = payouts.filter(p => {
    const matchesSearch = 
      p.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      completed: { label: 'Completed', variant: 'default' },
      success: { label: 'Success', variant: 'default' },
      pending: { label: 'Pending', variant: 'secondary' },
      processing: { label: 'Processing', variant: 'secondary' },
      failed: { label: 'Failed', variant: 'destructive' },
      error: { label: 'Error', variant: 'destructive' },
      cancelled: { label: 'Cancelled', variant: 'outline' },
    };

    const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payout Management</h1>
          <p className="text-muted-foreground">
            Process and manage user payouts
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={filteredPayouts}
            filename="payouts"
            label="Export"
          />
          <Button onClick={fetchPayouts} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_payouts}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_payouts}</div>
            <p className="text-xs text-muted-foreground">
              KES {stats.pending_amount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed_payouts}</div>
            <p className="text-xs text-muted-foreground">
              KES {stats.completed_amount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {stats.total_amount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All payouts
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
                  placeholder="Search payouts, users..."
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payouts ({filteredPayouts.length})</CardTitle>
          <CardDescription>
            {payouts.length === 0 && !loading && (
              <span className="text-yellow-600">
                Note: Payouts table may not exist yet. This feature requires a payouts table in the database.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {payouts.length === 0 ? 'No payouts found. Payouts table may need to be created.' : 'No payouts match your filters'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payout Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{payout.user_name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">{payout.user_email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {payout.currency} {payout.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{payout.payout_method}</TableCell>
                      <TableCell>{getStatusBadge(payout.status)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {payout.transaction_id ? `${payout.transaction_id.substring(0, 8)}...` : '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(payout.created_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {payout.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleProcessPayout(payout)}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Process
                          </Button>
                        )}
                        {payout.status === 'completed' && payout.processed_at && (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(payout.processed_at), 'MMM dd, yyyy')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Payout Dialog */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payout</DialogTitle>
            <DialogDescription>
              {selectedPayout && (
                <>
                  User: {selectedPayout.user_name || selectedPayout.user_email}<br />
                  Amount: {selectedPayout.currency} {selectedPayout.amount.toLocaleString()}<br />
                  Method: {selectedPayout.payout_method}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note">Processing Note (optional)</Label>
              <Input
                id="note"
                placeholder="Add a note about this payout..."
                value={processNote}
                onChange={(e) => setProcessNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={processPayout} disabled={processing}>
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Process Payout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

