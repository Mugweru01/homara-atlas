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
  Scale,
  Search,
  RefreshCw,
  Eye,
  User,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserCheck,
  Calendar,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Link } from 'react-router-dom';

interface Dispute {
  id: string;
  dispute_type: 'booking' | 'payment' | 'property' | 'marketplace' | 'other';
  complainant_id: string;
  complainant_name?: string;
  respondent_id: string;
  respondent_name?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'appealed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  mediator_id?: string;
  mediator_name?: string;
  amount_disputed?: number;
  resolution?: string;
  resolved_at?: string;
  created_at: string;
  updated_at?: string;
}

export default function Disputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    fetchDisputes();
    const interval = setInterval(fetchDisputes, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      
      // Try to fetch disputes - handle missing table gracefully
      let data = null;
      let error = null;
      
      try {
        const result = await supabase
          .from('disputes')
          .select(`
            *,
            complainant:profiles!disputes_complainant_id_fkey(id, full_name),
            respondent:profiles!disputes_respondent_id_fkey(id, full_name),
            mediator:admins!disputes_mediator_id_fkey(id, full_name)
          `)
          .order('created_at', { ascending: false })
          .limit(500);
        
        data = result.data;
        error = result.error;
      } catch (queryError: any) {
        // If table doesn't exist, return empty array
        if (queryError?.code === '42P01' || queryError?.code === 'PGRST116' || queryError?.code === 'PGRST301') {
          data = [];
          error = null;
        } else {
          throw queryError;
        }
      }

      // Handle missing table gracefully
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST301' || 
            error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
          // Table doesn't exist - show empty state
          setDisputes([]);
          return;
        }
        throw error;
      }

      const processedDisputes = (data || []).map((dispute: any) => ({
        id: dispute.id,
        dispute_type: dispute.dispute_type || 'other',
        complainant_id: dispute.complainant_id,
        complainant_name: (dispute.complainant as any)?.full_name || 'Unknown',
        respondent_id: dispute.respondent_id,
        respondent_name: (dispute.respondent as any)?.full_name || 'Unknown',
        related_entity_type: dispute.related_entity_type,
        related_entity_id: dispute.related_entity_id,
        title: dispute.title || 'Untitled Dispute',
        description: dispute.description || '',
        status: dispute.status || 'open',
        priority: dispute.priority || 'normal',
        mediator_id: dispute.mediator_id,
        mediator_name: (dispute.mediator as any)?.full_name || null,
        amount_disputed: dispute.amount_disputed,
        resolution: dispute.resolution,
        resolved_at: dispute.resolved_at,
        created_at: dispute.created_at,
        updated_at: dispute.updated_at,
      }));

      setDisputes(processedDisputes);
    } catch (error: any) {
      logger.error('Error fetching disputes:', error);
      // Only show error if it's not a missing table error
      if (error.code !== '42P01' && error.code !== 'PGRST116' && error.code !== 'PGRST301' &&
          !error.message?.includes('schema cache') && !error.message?.includes('does not exist')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch disputes',
          variant: 'destructive',
        });
      }
      // Set empty state for any error
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredDisputes = disputes.filter(dispute => {
    const matchesSearch = search === '' || 
      dispute.title.toLowerCase().includes(search.toLowerCase()) ||
      dispute.description.toLowerCase().includes(search.toLowerCase()) ||
      dispute.complainant_name?.toLowerCase().includes(search.toLowerCase()) ||
      dispute.respondent_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || dispute.status === statusFilter;
    const matchesType = typeFilter === 'all' || dispute.dispute_type === typeFilter;
    const matchesPriority = priorityFilter === 'all' || dispute.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

  const stats = {
    total: disputes.length,
    open: disputes.filter(d => d.status === 'open').length,
    inProgress: disputes.filter(d => d.status === 'in_progress').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
    urgent: disputes.filter(d => d.priority === 'urgent').length,
    totalAmount: disputes
      .filter(d => d.amount_disputed)
      .reduce((sum, d) => sum + (d.amount_disputed || 0), 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge variant="success">Resolved</Badge>;
      case 'in_progress':
        return <Badge variant="default">In Progress</Badge>;
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>;
      case 'appealed':
        return <Badge variant="warning">Appealed</Badge>;
      default:
        return <Badge variant="warning">Open</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning">High</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">Normal</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      booking: 'default',
      payment: 'default',
      property: 'default',
      marketplace: 'default',
      other: 'secondary',
    };
    return <Badge variant={colors[type] as any}>{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disputes</h1>
          <p className="text-muted-foreground">
            Manage and resolve platform disputes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchDisputes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Link to="/admin/disputes/analytics">
            <Button variant="outline">
              Analytics
            </Button>
          </Link>
          <ExportButton data={filteredDisputes} filename="disputes" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.urgent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {stats.totalAmount.toLocaleString()}
            </div>
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
                  placeholder="Search disputes, parties, or descriptions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="appealed">Appealed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="booking">Booking</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="property">Property</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Disputes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Disputes ({filteredDisputes.length})</CardTitle>
          <CardDescription>
            All platform disputes requiring resolution
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : disputes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No disputes found</p>
              <p className="text-sm mt-2">
                Disputes will appear here once the database tables are created
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Complainant</TableHead>
                    <TableHead>Respondent</TableHead>
                    <TableHead>Mediator</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDisputes.map((dispute) => (
                    <TableRow key={dispute.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <div className="font-medium truncate">{dispute.title}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {dispute.description.substring(0, 50)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(dispute.dispute_type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{dispute.complainant_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{dispute.respondent_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {dispute.mediator_name ? (
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                            <span>{dispute.mediator_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>{getPriorityBadge(dispute.priority)}</TableCell>
                      <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                      <TableCell>
                        {dispute.amount_disputed ? (
                          <span className="font-medium">
                            KES {dispute.amount_disputed.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(dispute.created_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/admin/disputes/${dispute.id}`}>
                          <Button variant="ghost" size="icon" title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

