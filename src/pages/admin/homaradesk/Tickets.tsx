import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
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
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
  Filter,
  CheckSquare,
  Square,
  Save,
  Bookmark,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  ticket_type: string;
  category?: string;
  priority: string;
  status: string;
  requester_id?: string;
  requester_name?: string;
  requester_email?: string;
  assignee_id?: string;
  assignee_name?: string;
  created_at: string;
  last_activity_at: string;
  first_response_due_at?: string;
  resolution_due_at?: string;
  tags?: string[];
}

export default function Tickets() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>(searchParams.get('assignee') || 'all');
  const [overdueFilter, setOverdueFilter] = useState<boolean>(searchParams.get('overdue') === 'true');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalTickets, setTotalTickets] = useState(0);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [saveSearchDialogOpen, setSaveSearchDialogOpen] = useState(false);
  
  // Create ticket dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    ticket_type: 'support',
    category: '',
    priority: 'normal',
  });

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [currentPage, statusFilter, priorityFilter, typeFilter, assigneeFilter, overdueFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      
      // Build query with filters
      let query = supabase
        .from('homaradesk_tickets')
        .select('*', { count: 'exact' });

      // Apply filters at database level for better performance
      if (statusFilter !== 'all') {
        if (statusFilter === 'open') {
          // Open includes: open, assigned, in_progress, waiting_customer
          query = query.in('status', ['open', 'assigned', 'in_progress', 'waiting_customer']);
        } else {
          query = query.eq('status', statusFilter);
        }
      }
      
      // Overdue filter - handled client-side for date comparison
      // We'll fetch all and filter client-side for overdue
      
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }
      if (typeFilter !== 'all') {
        query = query.eq('ticket_type', typeFilter);
      }

      // Get current admin ID for "assigned to me" filter
      const { data: { user } } = await supabase.auth.getUser();
      let currentAdminId: string | null = null;
      if (user && assigneeFilter === 'me') {
        const { data: admin } = await supabase
          .from('admins')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        currentAdminId = admin?.id || null;
        if (currentAdminId) {
          query = query.eq('assignee_id', currentAdminId);
        }
      } else if (assigneeFilter === 'unassigned') {
        query = query.is('assignee_id', null);
      } else if (assigneeFilter !== 'all' && assigneeFilter !== 'me') {
        query = query.eq('assignee_id', assigneeFilter);
      }

      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST301' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setTickets([]);
          setTotalTickets(0);
          return;
        }
        throw error;
      }

      const ticketsList = data || [];
      setTotalTickets(count || 0);
      
      // Fetch requester names
      const requesterIds = [...new Set(ticketsList.map((t: any) => t.requester_id).filter(Boolean))];
      const requestersMap = new Map();
      if (requesterIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', requesterIds);
          
          if (profiles) {
            profiles.forEach((p: any) => {
              requestersMap.set(p.id, { name: p.full_name, email: p.email });
            });
          }
        } catch (profileError: any) {
          logger.error('Error fetching requesters:', profileError);
        }
      }

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

      // Get current admin ID for "assigned to me" filter (if not already fetched)
      if (!currentAdminId && assigneeFilter === 'me' && user) {
        const { data: admin } = await supabase
          .from('admins')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        currentAdminId = admin?.id || null;
      }

      const processedTickets = ticketsList.map((ticket: any) => {
        const requester = ticket.requester_id ? requestersMap.get(ticket.requester_id) : null;
        return {
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          title: ticket.title,
          description: ticket.description,
          ticket_type: ticket.ticket_type,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          requester_id: ticket.requester_id,
          requester_name: requester?.name || ticket.requester_name,
          requester_email: requester?.email || ticket.requester_email,
          assignee_id: ticket.assignee_id,
          assignee_name: ticket.assignee_id ? assigneesMap.get(ticket.assignee_id) : null,
          created_at: ticket.created_at,
          last_activity_at: ticket.last_activity_at,
          first_response_due_at: ticket.first_response_due_at,
          resolution_due_at: ticket.resolution_due_at,
          tags: ticket.tags || [],
          is_assigned_to_me: ticket.assignee_id === currentAdminId,
        };
      });

      setTickets(processedTickets);
    } catch (error: any) {
      logger.error('Error fetching tickets:', error);
      console.error('Tickets fetch error:', error);
      setTickets([]);
      if (error?.code !== '42P01' && error?.code !== 'PGRST116' && 
          !error?.message?.includes('does not exist') && !error?.message?.includes('schema cache')) {
        toast.error('Error', {
          description: error.message || 'Failed to fetch tickets',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = useMemo(() => {
    let filtered = tickets;
    const now = new Date();

    // Search filter (client-side for now, can be moved to server-side later)
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.title.toLowerCase().includes(searchLower) ||
        ticket.description.toLowerCase().includes(searchLower) ||
        ticket.ticket_number.toLowerCase().includes(searchLower) ||
        ticket.requester_name?.toLowerCase().includes(searchLower) ||
        ticket.requester_email?.toLowerCase().includes(searchLower)
      );
    }

    // Overdue filter (client-side as it requires date comparison)
    // When overdueFilter is true, show only overdue tickets
    if (overdueFilter) {
      filtered = filtered.filter(t => {
        if (t.status === 'resolved' || t.status === 'closed') return false;
        if (t.first_response_due_at && new Date(t.first_response_due_at) < now) return true;
        if (t.resolution_due_at && new Date(t.resolution_due_at) < now) return true;
        return false;
      });
    } else if (statusFilter === 'all') {
      // If not filtering by overdue and status is 'all', show all
      // (already filtered by statusFilter in fetchTickets)
    }

    return filtered;
  }, [tickets, search, overdueFilter, statusFilter]);

  const totalPages = Math.ceil(totalTickets / pageSize);

  useEffect(() => {
    fetchSavedSearches();
  }, []);

  const fetchSavedSearches = async () => {
    try {
      const { data, error } = await supabase
        .from('homaradesk_saved_searches')
        .select('*')
        .or('is_shared.eq.true,created_by.eq.' + (await supabase.from('admins').select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single()).data?.id)
        .order('usage_count', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setSavedSearches([]);
          return;
        }
      } else {
        setSavedSearches(data || []);
      }
    } catch (error: any) {
      logger.error('Error fetching saved searches:', error);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedTickets.length === 0) return;

    const newStatus = window.prompt('Enter new status (open, assigned, in_progress, resolved, closed):');
    if (!newStatus) return;

    try {
      const { error } = await supabase
        .from('homaradesk_tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in('id', selectedTickets);

      if (error) throw error;

      toast.success('Success', {
        description: `Updated ${selectedTickets.length} tickets`,
      });

      setSelectedTickets([]);
      fetchTickets();
    } catch (error: any) {
      logger.error('Error updating tickets:', error);
      toast.error('Error', {
        description: error.message || 'Failed to update tickets',
      });
    }
  };

  const handleBulkAssign = async () => {
    if (selectedTickets.length === 0) return;

    const assigneeId = window.prompt('Enter assignee admin ID (or leave empty to unassign):');
    if (assigneeId === null) return;

    try {
      const { error } = await supabase
        .from('homaradesk_tickets')
        .update({
          assignee_id: assigneeId || null,
          status: assigneeId ? 'assigned' : 'open',
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedTickets);

      if (error) throw error;

      toast.success('Success', {
        description: `${assigneeId ? 'Assigned' : 'Unassigned'} ${selectedTickets.length} tickets`,
      });

      setSelectedTickets([]);
      fetchTickets();
    } catch (error: any) {
      logger.error('Error assigning tickets:', error);
      toast.error('Error', {
        description: error.message || 'Failed to assign tickets',
      });
    }
  };

  const handleSaveSearch = async () => {
    const name = window.prompt('Enter a name for this search:');
    if (!name) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      const searchQuery = {
        status: statusFilter,
        priority: priorityFilter,
        type: typeFilter,
        assignee: assigneeFilter,
        overdue: overdueFilter,
        search: search,
      };

      const { error } = await supabase
        .from('homaradesk_saved_searches')
        .insert({
          name,
          search_query: searchQuery,
          is_shared: false,
          created_by: admin?.id || null,
        });

      if (error) throw error;

      toast.success('Success', {
        description: 'Search saved',
      });

      fetchSavedSearches();
    } catch (error: any) {
      logger.error('Error saving search:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save search',
      });
    }
  };

  const handleLoadSearch = async (searchId: string) => {
    try {
      const search = savedSearches.find(s => s.id === searchId);
      if (!search) return;

      const query = search.search_query;
      setStatusFilter(query.status || 'all');
      setPriorityFilter(query.priority || 'all');
      setTypeFilter(query.type || 'all');
      setAssigneeFilter(query.assignee || 'all');
      setOverdueFilter(query.overdue || false);
      setSearch(query.search || '');
      setCurrentPage(1);

      // Increment usage
      await supabase.rpc('increment_saved_search_usage', {
        p_search_id: searchId,
      });

      fetchSavedSearches();
    } catch (error: any) {
      logger.error('Error loading search:', error);
    }
  };

  const handleCreateTicket = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Error', {
          description: 'You must be logged in to create a ticket',
        });
        return;
      }

      // Get admin ID if created by admin
      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      const { data, error } = await supabase
        .from('homaradesk_tickets')
        .insert({
          title: createForm.title,
          description: createForm.description,
          ticket_type: createForm.ticket_type,
          category: createForm.category || null,
          priority: createForm.priority,
          requester_id: user.id, // Will be set by RLS or can be overridden
          created_by: admin?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Success', {
        description: `Ticket ${data.ticket_number} created successfully`,
      });

      setCreateDialogOpen(false);
      setCreateForm({
        title: '',
        description: '',
        ticket_type: 'support',
        category: '',
        priority: 'normal',
      });
      fetchTickets();
      navigate(`/homaradesk/tickets/${data.id}`);
    } catch (error: any) {
      logger.error('Error creating ticket:', error);
      toast.error('Error', {
        description: error.message || 'Failed to create ticket',
      });
    }
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    assigned: tickets.filter(t => t.status === 'assigned').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    overdue: filteredTickets.filter(t => {
      const now = new Date();
      if (t.status === 'resolved' || t.status === 'closed') return false;
      if (t.first_response_due_at && new Date(t.first_response_due_at) < now) return true;
      if (t.resolution_due_at && new Date(t.resolution_due_at) < now) return true;
      return false;
    }).length,
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

  const isOverdue = (ticket: Ticket) => {
    if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
    const now = new Date();
    if (ticket.first_response_due_at && new Date(ticket.first_response_due_at) < now) return true;
    if (ticket.resolution_due_at && new Date(ticket.resolution_due_at) < now) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground">
            Manage all support tickets and requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchTickets} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Ticket
          </Button>
          <ExportButton data={filteredTickets} filename="tickets" />
        </div>
      </div>

      {/* Status Tabs - Freshdesk/Gorgias Style */}
      <div className="border-b">
        <div className="flex items-center gap-1 overflow-x-auto">
          <Button
            variant={statusFilter === 'all' && !overdueFilter ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setOverdueFilter(false);
            }}
            className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <Ticket className="mr-2 h-4 w-4" />
            All
            <Badge variant="secondary" className="ml-2">
              {stats.total}
            </Badge>
          </Button>
          <Button
            variant={statusFilter === 'open' && !overdueFilter ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setStatusFilter('open');
              setOverdueFilter(false);
            }}
            className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <AlertCircle className="mr-2 h-4 w-4 text-orange-500" />
            Open
            <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">
              {stats.open}
            </Badge>
          </Button>
          <Button
            variant={statusFilter === 'resolved' && !overdueFilter ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setStatusFilter('resolved');
              setOverdueFilter(false);
            }}
            className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
            Resolved
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
              {stats.resolved}
            </Badge>
          </Button>
          <Button
            variant={overdueFilter ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setOverdueFilter(!overdueFilter);
              if (!overdueFilter) {
                // When enabling overdue filter, set status to 'all' to show all overdue tickets
                setStatusFilter('all');
              }
            }}
            className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <AlertCircle className="mr-2 h-4 w-4 text-red-500" />
            Overdue
            <Badge variant="secondary" className="ml-2 bg-red-100 text-red-700">
              {stats.overdue}
            </Badge>
          </Button>
          <Button
            variant={statusFilter === 'closed' && !overdueFilter ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setStatusFilter('closed');
              setOverdueFilter(false);
            }}
            className="rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <CheckCircle className="mr-2 h-4 w-4 text-muted-foreground" />
            Closed
            <Badge variant="secondary" className="ml-2">
              {stats.closed}
            </Badge>
          </Button>
        </div>
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
                  placeholder="Search by ticket number, title, requester..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature_request">Feature Request</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="admin_issue">Admin Issue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="me">Assigned to Me</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={overdueFilter ? 'default' : 'outline'}
              onClick={() => setOverdueFilter(!overdueFilter)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Overdue Only
            </Button>
            {savedSearches.length > 0 && (
              <Select onValueChange={handleLoadSearch}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Saved Searches" />
                </SelectTrigger>
                <SelectContent>
                  {savedSearches.map((search) => (
                    <SelectItem key={search.id} value={search.id}>
                      <div className="flex items-center gap-2">
                        <Bookmark className="h-4 w-4" />
                        {search.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              onClick={handleSaveSearch}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets ({totalTickets})</CardTitle>
          <CardDescription>
            All tickets matching your filters
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
                  ? 'Tickets will appear here once created'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedTickets.length === filteredTickets.length && filteredTickets.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTickets(filteredTickets.map(t => t.id));
                          } else {
                            setSelectedTickets([]);
                          }
                        }}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow 
                      key={ticket.id} 
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${isOverdue(ticket) ? 'bg-destructive/5' : ''}`}
                      onClick={(e) => {
                        // Don't navigate if clicking on checkbox or action button
                        const target = e.target as HTMLElement;
                        if (target.closest('input[type="checkbox"]') || target.closest('button')) {
                          return;
                        }
                        navigate(`/homaradesk/tickets/${ticket.id}`);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedTickets.includes(ticket.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTickets([...selectedTickets, ticket.id]);
                            } else {
                              setSelectedTickets(selectedTickets.filter(id => id !== ticket.id));
                            }
                          }}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          {ticket.ticket_number}
                          {isOverdue(ticket) && (
                            <AlertCircle className="h-3 w-3 text-destructive" title="Overdue" />
                          )}
                        </div>
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
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm">{ticket.requester_name || 'Unknown'}</div>
                            {ticket.requester_email && (
                              <div className="text-xs text-muted-foreground">{ticket.requester_email}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ticket.assignee_name ? (
                          <div className="text-sm">{ticket.assignee_name}</div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ticket.ticket_type.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
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
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/homaradesk/tickets/${ticket.id}`)}
                          title="View ticket details"
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
        {totalPages > 1 && (
          <div className="border-t p-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(currentPage - 1);
                    }}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(pageNum);
                        }}
                        isActive={currentPage === pageNum}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                    }}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <div className="text-center text-sm text-muted-foreground mt-2">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalTickets)} of {totalTickets} tickets
            </div>
          </div>
        )}
      </Card>

      {/* Create Ticket Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
            <DialogDescription>
              Create a new support ticket or issue
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="Brief description of the issue"
              />
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Detailed description of the issue..."
                rows={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ticket_type">Type</Label>
                <Select
                  value={createForm.ticket_type}
                  onValueChange={(value) => setCreateForm({ ...createForm, ticket_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="admin_issue">Admin Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={createForm.priority}
                  onValueChange={(value) => setCreateForm({ ...createForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="category">Category (Optional)</Label>
              <Input
                id="category"
                value={createForm.category}
                onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                placeholder="e.g., booking, payment, property"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTicket}
              disabled={!createForm.title || !createForm.description}
            >
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

