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
  CreditCard,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  User,
  Search,
  ArrowLeftRight,
  Receipt,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface PendingTransaction {
  id: string;
  transaction_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_type: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
  metadata?: any;
}

export default function PaymentProcessing() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<PendingTransaction | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'refund' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPendingTransactions = async () => {
    try {
      setLoading(true);

      // Fetch pending transactions from all payment tables
      const [paymentsResult, subscriptionsResult, shortStayResult, rentResult, maintenanceResult, marketplaceResult] = await Promise.all([
        supabase.from('payments').select('*').in('status', ['pending', 'processing']).order('created_at', { ascending: false }),
        supabase.from('subscription_payments').select('*').in('status', ['pending', 'processing']).order('created_at', { ascending: false }),
        supabase.from('short_stay_payments').select('*').in('status', ['pending', 'processing']).order('created_at', { ascending: false }),
        supabase.from('rent_payments').select('*').in('status', ['pending', 'processing']).order('created_at', { ascending: false }),
        supabase.from('maintenance_payments').select('*').in('status', ['pending', 'processing']).order('created_at', { ascending: false }),
        supabase.from('marketplace_transactions').select('*').in('status', ['pending', 'processing']).order('created_at', { ascending: false }),
      ]);

      const allTransactions: PendingTransaction[] = [];

      // Process each result set
      const processResults = (results: any[], type: string) => {
        if (results) {
          results.forEach((p: any) => {
            allTransactions.push({
              id: p.id,
              transaction_id: p.transaction_id || p.id,
              user_id: p.user_id || p.buyer_id,
              amount: p.amount || 0,
              currency: p.currency || 'KES',
              status: p.status || 'pending',
              payment_method: p.payment_method || 'unknown',
              payment_type: type,
              created_at: p.created_at,
              metadata: p.metadata || {},
            });
          });
        }
      };

      processResults(paymentsResult.data || [], 'payment');
      processResults(subscriptionsResult.data || [], 'subscription');
      processResults(shortStayResult.data || [], 'short_stay');
      processResults(rentResult.data || [], 'rent');
      processResults(maintenanceResult.data || [], 'maintenance');
      processResults(marketplaceResult.data || [], 'marketplace');

      // Fetch user info
      const userIds = [...new Set(allTransactions.map(t => t.user_id))];
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, first_name, last_name')
          .in('id', userIds);

        if (users) {
          const userMap = new Map(users.map(u => [u.id, u]));
          allTransactions.forEach(t => {
            const user = userMap.get(t.user_id);
            if (user) {
              t.user_email = user.email;
              t.user_name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
            }
          });
        }
      }

      setPendingTransactions(allTransactions);
    } catch (error) {
      logger.error('Error fetching pending transactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending transactions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTransactions();
    const interval = setInterval(fetchPendingTransactions, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = (transaction: PendingTransaction, type: 'approve' | 'reject' | 'refund') => {
    setSelectedTransaction(transaction);
    setActionType(type);
    setActionNote('');
    setActionDialogOpen(true);
  };

  const processAction = async () => {
    if (!selectedTransaction || !actionType) return;

    try {
      setProcessing(true);

      // Determine which table to update based on payment_type
      const tableMap: Record<string, string> = {
        payment: 'payments',
        subscription: 'subscription_payments',
        short_stay: 'short_stay_payments',
        rent: 'rent_payments',
        maintenance: 'maintenance_payments',
        marketplace: 'marketplace_transactions',
      };

      const tableName = tableMap[selectedTransaction.payment_type] || 'payments';
      let updateData: any = {};

      if (actionType === 'approve') {
        updateData = {
          status: 'completed',
          updated_at: new Date().toISOString(),
        };
      } else if (actionType === 'reject') {
        updateData = {
          status: 'failed',
          updated_at: new Date().toISOString(),
        };
      } else if (actionType === 'refund') {
        updateData = {
          status: 'refunded',
          updated_at: new Date().toISOString(),
        };
      }

      // Add note to metadata if provided
      if (actionNote) {
        updateData.metadata = {
          ...(selectedTransaction.metadata || {}),
          admin_note: actionNote,
          admin_action: actionType,
          admin_action_date: new Date().toISOString(),
        };
      }

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', selectedTransaction.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Transaction ${actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'refunded'} successfully`,
      });

      setActionDialogOpen(false);
      setSelectedTransaction(null);
      setActionType(null);
      setActionNote('');
      fetchPendingTransactions();
    } catch (error) {
      logger.error('Error processing action:', error);
      toast({
        title: 'Error',
        description: 'Failed to process action',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const filteredTransactions = pendingTransactions.filter(t =>
    t.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.user_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      payment: 'Payment',
      subscription: 'Subscription',
      short_stay: 'Short Stay',
      rent: 'Rent',
      maintenance: 'Maintenance',
      marketplace: 'Marketplace',
    };
    return typeMap[type] || type;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Processing</h1>
          <p className="text-muted-foreground">
            Process pending payments, approve transactions, and handle refunds
          </p>
        </div>
        <Button onClick={fetchPendingTransactions} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Transactions</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingTransactions.length}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {pendingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              In pending transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Amount</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {pendingTransactions.length > 0
                ? (pendingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0) / pendingTransactions.length).toLocaleString()
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions, users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pending Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Transactions ({filteredTransactions.length})</CardTitle>
          <CardDescription>
            Review and process pending payment transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending transactions
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-mono text-sm">
                        {transaction.transaction_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transaction.user_name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">{transaction.user_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(transaction.payment_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {transaction.currency} {transaction.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{transaction.payment_method}</TableCell>
                      <TableCell>
                        {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(transaction, 'approve')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(transaction, 'reject')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(transaction, 'refund')}
                          >
                            <ArrowLeftRight className="h-4 w-4 mr-1" />
                            Refund
                          </Button>
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
              {actionType === 'approve' && 'Approve Transaction'}
              {actionType === 'reject' && 'Reject Transaction'}
              {actionType === 'refund' && 'Refund Transaction'}
            </DialogTitle>
            <DialogDescription>
              {selectedTransaction && (
                <>
                  Transaction: {selectedTransaction.transaction_id.substring(0, 8)}...<br />
                  Amount: {selectedTransaction.currency} {selectedTransaction.amount.toLocaleString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                placeholder="Add a note about this action..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={processAction} disabled={processing}>
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {actionType === 'approve' && 'Approve'}
                  {actionType === 'reject' && 'Reject'}
                  {actionType === 'refund' && 'Refund'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

