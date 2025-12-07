import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Eye,
  Download,
  Calendar,
  User,
  Building,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';

interface Transaction {
  id: string;
  transaction_id: string;
  provider_ref?: string; // Payment provider reference (M-Pesa code, Stripe ID, etc.)
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_type: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
  user_email?: string;
  user_name?: string;
  user_phone?: string;
  related_entity_id?: string; // booking_id, listing_id, etc.
  related_entity_type?: string;
}

interface TransactionStats {
  total_transactions: number;
  total_amount: number;
  successful_transactions: number;
  failed_transactions: number;
  pending_transactions: number;
  today_amount: number;
  today_count: number;
}

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats>({
    total_transactions: 0,
    total_amount: 0,
    successful_transactions: 0,
    failed_transactions: 0,
    pending_transactions: 0,
    today_amount: 0,
    today_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Helper function to process payment result
  const processResult = (result: PromiseSettledResult<any>) => {
    if (result.status === 'fulfilled' && result.value.data && !result.value.error) {
      return result.value.data;
    } else if (result.status === 'fulfilled' && result.value.error) {
      // Table doesn't exist or access denied - skip silently
      if (result.value.error.code === '42P01' || result.value.error.code === 'PGRST116' || result.value.error.code === 'PGRST301') {
        return [];
      }
    }
    return [];
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      // Fetch from multiple payment tables - handle missing tables gracefully
      const [paymentsResult, subscriptionsResult, shortStayResult, rentResult, maintenanceResult, marketplaceResult, escrowResult] = await Promise.allSettled([
        supabase.from('payments').select('*').order('initiated_at', { ascending: false }).limit(1000),
        supabase.from('subscription_payments').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('short_stay_payments').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('rent_payments').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('maintenance_payments').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('marketplace_transactions').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('escrow_deposits').select('*').order('created_at', { ascending: false }).limit(1000),
      ]);

      // Combine and normalize transactions
      const allTransactions: Transaction[] = [];

      // Process payments
      const payments = processResult(paymentsResult);
      payments.forEach((p: any) => {
        allTransactions.push({
          id: p.id,
          transaction_id: p.provider_ref || p.transaction_id || p.id,
          provider_ref: p.provider_ref || p.transaction_id,
          user_id: p.user_id || p.tenant_id || p.buyer_id,
          amount: p.amount_kes || p.amount || 0,
          currency: p.currency || 'KES',
          status: p.status || 'pending',
          payment_method: p.payment_method || p.payment_provider || 'unknown',
          payment_type: 'payment',
          created_at: p.initiated_at || p.created_at,
          updated_at: p.updated_at || p.initiated_at || p.created_at,
          metadata: { property_id: p.property_id, ...(p.metadata || {}) },
          related_entity_id: p.property_id,
          related_entity_type: 'property',
        });
      });

      // Process subscription payments
      const subscriptions = processResult(subscriptionsResult);
      subscriptions.forEach((p: any) => {
        allTransactions.push({
          id: p.id,
          transaction_id: p.transaction_id || p.provider_ref || p.id,
          provider_ref: p.provider_ref || p.transaction_id,
          user_id: p.user_id,
          amount: p.amount || 0,
          currency: p.currency || 'KES',
          status: p.status || 'pending',
          payment_method: p.payment_method || 'subscription',
          payment_type: 'subscription',
          created_at: p.created_at,
          updated_at: p.updated_at || p.created_at,
          metadata: { subscription_id: p.subscription_id, ...(p.metadata || {}) },
          related_entity_id: p.subscription_id,
          related_entity_type: 'subscription',
        });
      });

      // Process short stay payments
      const shortStays = processResult(shortStayResult);
      shortStays.forEach((p: any) => {
        allTransactions.push({
          id: p.id,
          transaction_id: p.transaction_id || p.provider_ref || p.id,
          provider_ref: p.provider_ref || p.transaction_id,
          user_id: p.user_id || p.guest_id,
          amount: p.amount || p.total_amount || 0,
          currency: p.currency || 'KES',
          status: p.status || p.payment_status || 'pending',
          payment_method: p.payment_method || 'short_stay',
          payment_type: 'short_stay',
          created_at: p.created_at,
          updated_at: p.updated_at || p.created_at,
          metadata: { booking_id: p.booking_id, ...(p.metadata || {}) },
          related_entity_id: p.booking_id,
          related_entity_type: 'booking',
        });
      });

      // Process rent payments
      const rentPayments = processResult(rentResult);
      rentPayments.forEach((p: any) => {
        allTransactions.push({
          id: p.id,
          transaction_id: p.transaction_id || p.provider_ref || p.id,
          provider_ref: p.provider_ref || p.transaction_id,
          user_id: p.user_id || p.tenant_id,
          amount: p.amount || 0,
          currency: p.currency || 'KES',
          status: p.status || 'pending',
          payment_method: p.payment_method || 'rent',
          payment_type: 'rent',
          created_at: p.created_at,
          updated_at: p.updated_at || p.created_at,
          metadata: { listing_id: p.listing_id, property_id: p.property_id, ...(p.metadata || {}) },
          related_entity_id: p.listing_id || p.property_id,
          related_entity_type: 'rent',
        });
      });

      // Process maintenance payments
      const maintenancePayments = processResult(maintenanceResult);
      maintenancePayments.forEach((p: any) => {
        allTransactions.push({
          id: p.id,
          transaction_id: p.transaction_id || p.provider_ref || p.id,
          provider_ref: p.provider_ref || p.transaction_id,
          user_id: p.user_id || p.tenant_id,
          amount: p.amount || 0,
          currency: p.currency || 'KES',
          status: p.status || 'pending',
          payment_method: p.payment_method || 'maintenance',
          payment_type: 'maintenance',
          created_at: p.created_at,
          updated_at: p.updated_at || p.created_at,
          metadata: { work_order_id: p.work_order_id, request_id: p.request_id, ...(p.metadata || {}) },
          related_entity_id: p.work_order_id || p.request_id,
          related_entity_type: 'maintenance',
        });
      });

      // Process marketplace transactions
      const marketplaceTransactions = processResult(marketplaceResult);
      marketplaceTransactions.forEach((p: any) => {
        allTransactions.push({
          id: p.id,
          transaction_id: p.transaction_id || p.provider_ref || p.id,
          provider_ref: p.provider_ref || p.transaction_id,
          user_id: p.buyer_id || p.user_id,
          amount: p.amount || p.bid_amount || 0,
          currency: p.currency || 'KES',
          status: p.status || 'pending',
          payment_method: p.payment_method || 'marketplace',
          payment_type: 'marketplace',
          created_at: p.created_at,
          updated_at: p.updated_at || p.created_at,
          metadata: { listing_id: p.listing_id, auction_id: p.auction_id, bid_id: p.bid_id, ...(p.metadata || {}) },
          related_entity_id: p.listing_id || p.auction_id,
          related_entity_type: 'marketplace',
        });
      });

      // Process escrow deposits
      const escrowDeposits = processResult(escrowResult);
      escrowDeposits.forEach((p: any) => {
        allTransactions.push({
          id: p.id,
          transaction_id: p.transaction_id || p.provider_ref || p.id,
          provider_ref: p.provider_ref || p.transaction_id,
          user_id: p.user_id || p.depositor_id,
          amount: p.amount || p.deposit_amount || 0,
          currency: p.currency || 'KES',
          status: p.status || p.escrow_status || 'pending',
          payment_method: p.payment_method || 'escrow',
          payment_type: 'escrow',
          created_at: p.created_at,
          updated_at: p.updated_at || p.created_at,
          metadata: { transaction_id: p.transaction_id, ...(p.metadata || {}) },
          related_entity_id: p.transaction_id,
          related_entity_type: 'escrow',
        });
      });

      // Sort by created_at descending
      allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Fetch user info for transactions from profiles table
      const userIds = [...new Set(allTransactions.map(t => t.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name, phone, phone_e164')
            .in('id', userIds);

          if (profiles) {
            const userMap = new Map(profiles.map(u => [u.id, u]));
            allTransactions.forEach(t => {
              const user = userMap.get(t.user_id);
              if (user) {
                t.user_email = user.email || '';
                t.user_name = user.full_name || 'Unknown';
                t.user_phone = user.phone || user.phone_e164 || '';
              }
            });
          }
        } catch (error: any) {
          logger.error('Error fetching user profiles:', error);
        }
      }

      setTransactions(allTransactions);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayTransactions = allTransactions.filter(t => new Date(t.created_at) >= today);
      const successful = allTransactions.filter(t => t.status === 'completed' || t.status === 'success');
      const failed = allTransactions.filter(t => t.status === 'failed' || t.status === 'error');
      const pending = allTransactions.filter(t => t.status === 'pending' || t.status === 'processing');

      setStats({
        total_transactions: allTransactions.length,
        total_amount: allTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        successful_transactions: successful.length,
        failed_transactions: failed.length,
        pending_transactions: pending.length,
        today_amount: todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        today_count: todayTransactions.length,
      });
    } catch (error) {
      logger.error('Error fetching transactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load transactions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const filteredTransactions = transactions.filter(t => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      t.transaction_id?.toLowerCase().includes(searchLower) ||
      t.provider_ref?.toLowerCase().includes(searchLower) ||
      t.user_email?.toLowerCase().includes(searchLower) ||
      t.user_name?.toLowerCase().includes(searchLower) ||
      t.user_phone?.toLowerCase().includes(searchLower) ||
      t.id.toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesType = typeFilter === 'all' || t.payment_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
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
      refunded: { label: 'Refunded', variant: 'outline' },
    };

    const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

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

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction Overview</h1>
          <p className="text-muted-foreground">
            View and manage all payment transactions across the platform
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={filteredTransactions}
            filename="transactions"
            label="Export"
          />
          <Button onClick={fetchTransactions} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_transactions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.today_count} today
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
              KES {stats.today_amount.toLocaleString()} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.successful_transactions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_transactions > 0 
                ? ((stats.successful_transactions / stats.total_transactions) * 100).toFixed(1)
                : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_transactions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.failed_transactions} failed
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
                  placeholder="Search transactions, users..."
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
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Payment Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="short_stay">Short Stay</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
          <CardDescription>
            All payment transactions across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction Code</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="font-mono text-sm">
                          <div className="font-medium">{transaction.provider_ref || transaction.transaction_id || transaction.id}</div>
                          <div className="text-xs text-muted-foreground">ID: {transaction.id.substring(0, 8)}...</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{transaction.user_name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">{transaction.user_email || 'No email'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{transaction.user_phone || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(transaction.payment_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {transaction.currency} {transaction.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell>{transaction.payment_method}</TableCell>
                      <TableCell>
                        {format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(transaction)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Complete information about this transaction
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transaction Code</label>
                  <p className="font-mono text-sm font-medium">{selectedTransaction.provider_ref || selectedTransaction.transaction_id || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground mt-1">ID: {selectedTransaction.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div>{getStatusBadge(selectedTransaction.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p className="font-medium text-lg">
                    {selectedTransaction.currency} {selectedTransaction.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Type</label>
                  <p>{getTypeLabel(selectedTransaction.payment_type)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
                  <p>{selectedTransaction.payment_method}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User Information</label>
                  <div className="space-y-1">
                    <p className="font-medium">{selectedTransaction.user_name || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">Email: {selectedTransaction.user_email || 'N/A'}</p>
                    <p className="text-sm text-muted-foreground">Phone: {selectedTransaction.user_phone || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground font-mono">User ID: {selectedTransaction.user_id}</p>
                  </div>
                </div>
                {selectedTransaction.related_entity_id && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Related Entity</label>
                    <p className="text-sm">{selectedTransaction.related_entity_type || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedTransaction.related_entity_id}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p>{format(new Date(selectedTransaction.created_at), 'PPpp')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Updated</label>
                  <p>{format(new Date(selectedTransaction.updated_at), 'PPpp')}</p>
                </div>
              </div>
              {selectedTransaction.metadata && Object.keys(selectedTransaction.metadata).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Additional Details (for dispute tracking)</label>
                  <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-60">
                    {JSON.stringify(selectedTransaction.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

