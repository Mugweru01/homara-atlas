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
  Ticket,
  Search,
  RefreshCw,
  Eye,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  ticket_type: string;
  category?: string;
  priority: string;
  status: string;
  assignee_name?: string;
  created_at: string;
  last_activity_at: string;
  first_response_at?: string;
  resolved_at?: string;
}

export default function SupportTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchTickets();
      const interval = setInterval(fetchTickets, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUserId]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      } else {
        // Redirect to login if not authenticated
        navigate('/admin/login');
      }
    } catch (error) {
      logger.error('Error fetching current user:', error);
    }
  };

  const fetchTickets = async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('homaradesk_tickets')
        .select('*')
        .eq('requester_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST301' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setTickets([]);
          return;
        }
        throw error;
      }

      const ticketsList = data || [];
      
      // Fetch assignee names
      const assigneeIds = [...new Set(ticketsList.map((t: any) => t.assignee_id).filter(Boolean))];
      const assigneesMap = new Map();
      if (assigneeIds.length > 0) {
        try {
          const { data: admins } = await supabase
            .from('admins')
            .select('id, user_id')
            .in('id', assigneeIds);
          
          if (admins) {
            const adminUserIds = admins.map((a: any) => a.user_id);
            const { data: adminProfiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', adminUserIds);
            
            if (adminProfiles) {
              const adminIdToUserId = new Map(admins.map((a: any) => [a.user_id, a.id]));
              adminProfiles.forEach((p: any) => {
                const adminId = adminIdToUserId.get(p.id);
                if (adminId) {
                  assigneesMap.set(adminId, p.full_name);
                }
              });
            }
          }
        } catch (assigneeError: any) {
          logger.error('Error fetching assignees:', assigneeError);
        }
      }

      const processedTickets = ticketsList.map((ticket: any) => ({
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        title: ticket.title,
        description: ticket.description,
        ticket_type: ticket.ticket_type,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        assignee_name: ticket.assignee_id ? assigneesMap.get(ticket.assignee_id) : null,
        created_at: ticket.created_at,
        last_activity_at: ticket.last_activity_at,
        first_response_at: ticket.first_response_at,
        resolved_at: ticket.resolved_at,
      }));

      setTickets(processedTickets);
    } catch (error: any) {
      logger.error('Error fetching tickets:', error);
      console.error('Tickets fetch error:', error);
      setTickets([]);
      if (error?.code !== '42P01' && error?.code !== 'PGRST116' && 
          !error?.message?.includes('does not exist') && !error?.message?.includes('schema cache')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch tickets',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = search === '' || 
      ticket.title.toLowerCase().includes(search.toLowerCase()) ||
      ticket.description.toLowerCase().includes(search.toLowerCase()) ||
      ticket.ticket_number.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open' || t.status === 'assigned' || t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      open: 'secondary',
      assigned: 'default',
      in_progress: 'default',
      waiting_customer: 'outline',
      resolved: 'default',
      closed: 'secondary',
      cancelled: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'secondary',
      normal: 'default',
      high: 'outline',
      urgent: 'destructive',
      critical: 'destructive',
    };
    return (
      <Badge variant={variants[priority] || 'default'}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  if (!currentUserId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Support Tickets</h1>
          <p className="text-muted-foreground">
            View and manage your support requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchTickets} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Link to="/support/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Ticket
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.open}</div>
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
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closed}</div>
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
                  placeholder="Search tickets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting_customer">Waiting for Me</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Tickets ({filteredTickets.length})</CardTitle>
          <CardDescription>
            All your support tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tickets found</p>
              <p className="text-sm mt-2">
                {tickets.length === 0 
                  ? 'Create your first support ticket to get started'
                  : 'Try adjusting your filters'}
              </p>
              {tickets.length === 0 && (
                <Link to="/support/new">
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Ticket
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-xs">
                        {ticket.ticket_number}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <div className="font-medium truncate">{ticket.title}</div>
                          {ticket.category && (
                            <div className="text-xs text-muted-foreground">{ticket.category}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ticket.ticket_type.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell>
                        {ticket.assignee_name ? (
                          <div className="text-sm">{ticket.assignee_name}</div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(ticket.created_at), 'HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(ticket.last_activity_at), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(ticket.last_activity_at), 'HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/support/tickets/${ticket.id}`)}
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
    </div>
  );
}

