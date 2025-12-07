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
  Calendar,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Download,
  User,
  Home,
  Mail,
  Phone,
  MapPin,
  Edit,
  Send,
  FileText,
  CalendarDays,
  List,
  Grid3x3,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ViewingBooking {
  id: string;
  property_id: string;
  tenant_id: string;
  viewing_date: string;
  viewing_time: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  property?: {
    id: string;
    title: string;
    location_address: string;
  };
  tenant?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
  };
}

interface ViewingStats {
  total_viewings: number;
  confirmed_viewings: number;
  pending_viewings: number;
  cancelled_viewings: number;
  completed_viewings: number;
  today_viewings: number;
  upcoming_viewings: number;
}

export default function ViewingBookings() {
  const navigate = useNavigate();
  const [viewings, setViewings] = useState<ViewingBooking[]>([]);
  const [stats, setStats] = useState<ViewingStats>({
    total_viewings: 0,
    confirmed_viewings: 0,
    pending_viewings: 0,
    cancelled_viewings: 0,
    completed_viewings: 0,
    today_viewings: 0,
    upcoming_viewings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedViewing, setSelectedViewing] = useState<ViewingBooking | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'confirm' | 'cancel' | 'reschedule' | 'attended' | 'no_show' | 'note' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const fetchViewings = async () => {
    try {
      setLoading(true);
      
      // Fetch viewings with related data
      let query = supabase
        .from('viewing_bookings')
        .select(`
          *,
          property:properties(id, title, location_address),
          tenant:profiles!viewing_bookings_tenant_id_fkey(id, full_name, email, phone)
        `)
        .order('viewing_date', { ascending: true })
        .order('viewing_time', { ascending: true });

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setViewings(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const confirmed = data?.filter(v => v.status === 'confirmed').length || 0;
      const pending = data?.filter(v => v.status === 'pending').length || 0;
      const cancelled = data?.filter(v => v.status === 'cancelled').length || 0;
      const completed = data?.filter(v => v.status === 'completed').length || 0;
      
      const today = new Date().toISOString().split('T')[0];
      const todayViewings = data?.filter(v => v.viewing_date === today).length || 0;
      const upcoming = data?.filter(v => {
        const viewingDate = new Date(v.viewing_date);
        return viewingDate >= new Date() && v.status !== 'cancelled' && v.status !== 'completed';
      }).length || 0;

      setStats({
        total_viewings: total,
        confirmed_viewings: confirmed,
        pending_viewings: pending,
        cancelled_viewings: cancelled,
        completed_viewings: completed,
        today_viewings: todayViewings,
        upcoming_viewings: upcoming,
      });
    } catch (error: any) {
      logger.error('Error fetching viewings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch viewings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViewings();
  }, [statusFilter]);

  const filteredViewings = viewings.filter(viewing => {
    const matchesSearch = 
      viewing.property?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      viewing.tenant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      viewing.tenant?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      viewing.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const upcomingViewings = filteredViewings.filter(v => {
    const viewingDate = new Date(v.viewing_date);
    return viewingDate >= new Date() && v.status !== 'cancelled' && v.status !== 'completed';
  });

  const pastViewings = filteredViewings.filter(v => {
    const viewingDate = new Date(v.viewing_date);
    return viewingDate < new Date() || v.status === 'completed' || v.status === 'cancelled';
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      confirmed: 'default',
      pending: 'secondary',
      cancelled: 'destructive',
      completed: 'outline',
      attended: 'default',
      no_show: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </Badge>
    );
  };

  const handleAction = async () => {
    if (!selectedViewing || !actionType) return;

    try {
      let updateData: any = { updated_at: new Date().toISOString() };

      switch (actionType) {
        case 'confirm':
          updateData.status = 'confirmed';
          break;
        case 'cancel':
          updateData.status = 'cancelled';
          break;
        case 'reschedule':
          if (newDate && newTime) {
            updateData.viewing_date = newDate;
            updateData.viewing_time = newTime;
            updateData.status = 'pending'; // Reset to pending for rescheduled viewings
          }
          break;
        case 'attended':
          updateData.status = 'completed';
          break;
        case 'no_show':
          updateData.status = 'no_show';
          break;
      }

      if (actionNote) {
        // TODO: Store note in viewing notes table or metadata
        updateData.notes = actionNote;
      }

      const { error } = await supabase
        .from('viewing_bookings')
        .update(updateData)
        .eq('id', selectedViewing.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Viewing ${actionType}ed successfully`,
      });

      setActionDialogOpen(false);
      setActionType(null);
      setActionNote('');
      setNewDate('');
      setNewTime('');
      fetchViewings();
    } catch (error: any) {
      logger.error('Error performing action:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to perform action',
        variant: 'destructive',
      });
    }
  };

  const sendReminder = async (viewing: ViewingBooking) => {
    try {
      // TODO: Implement email/SMS reminder functionality
      toast({
        title: 'Reminder Sent',
        description: `Reminder sent to ${viewing.tenant?.email || 'tenant'}`,
      });
    } catch (error: any) {
      logger.error('Error sending reminder:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reminder',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Viewing Bookings</h1>
          <p className="text-muted-foreground mt-1">
            Manage property viewing appointments and schedules
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
          <Button 
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            onClick={() => setViewMode('calendar')}
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            Calendar
          </Button>
          <Button variant="outline" onClick={fetchViewings} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <ExportButton
            data={filteredViewings}
            filename="viewing-bookings"
            label="Export"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Viewings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_viewings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.today_viewings} today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcoming_viewings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.confirmed_viewings} confirmed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_viewings}</div>
            <p className="text-xs text-muted-foreground">
              Require confirmation
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed_viewings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.cancelled_viewings} cancelled
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
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by property, tenant name, email, or viewing ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="attended">Attended</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Viewings Table/Calendar */}
      {viewMode === 'list' ? (
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcomingViewings.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastViewings.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Viewings</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : upcomingViewings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No upcoming viewings
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingViewings.map((viewing) => (
                        <TableRow key={viewing.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {format(new Date(viewing.viewing_date), 'MMM dd, yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {viewing.viewing_time}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{viewing.property?.title || 'N/A'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {viewing.property?.location_address || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{viewing.tenant?.full_name || 'N/A'}</div>
                              <div className="text-xs text-muted-foreground">
                                {viewing.tenant?.email || 'N/A'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(viewing.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedViewing(viewing);
                                  setDetailDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => sendReminder(viewing)}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedViewing(viewing);
                                  setActionDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="past">
            <Card>
              <CardHeader>
                <CardTitle>Past Viewings</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : pastViewings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No past viewings
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pastViewings.map((viewing) => (
                        <TableRow key={viewing.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {format(new Date(viewing.viewing_date), 'MMM dd, yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {viewing.viewing_time}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{viewing.property?.title || 'N/A'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {viewing.property?.location_address || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{viewing.tenant?.full_name || 'N/A'}</div>
                              <div className="text-xs text-muted-foreground">
                                {viewing.tenant?.email || 'N/A'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(viewing.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedViewing(viewing);
                                  setDetailDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Calendar View</CardTitle>
            <CardDescription>
              Calendar view coming soon. Use list view for now.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Viewing Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Viewing Details</DialogTitle>
            <DialogDescription>
              Complete information for viewing {selectedViewing?.id.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>
          {selectedViewing && (
            <div className="space-y-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="tenant">Tenant Info</TabsTrigger>
                  <TabsTrigger value="property">Property</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Viewing ID</Label>
                      <div className="font-mono text-sm">{selectedViewing.id}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <div>{getStatusBadge(selectedViewing.status)}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <div>{format(new Date(selectedViewing.viewing_date), 'PPP')}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Time</Label>
                      <div>{selectedViewing.viewing_time}</div>
                    </div>
                  </div>
                  {selectedViewing.notes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      <div className="mt-1 p-3 bg-muted rounded-md">
                        {selectedViewing.notes}
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="tenant" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <div className="font-medium">{selectedViewing.tenant?.full_name || 'N/A'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {selectedViewing.tenant?.email || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {selectedViewing.tenant?.phone || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/users?search=${selectedViewing.tenant_id}`)}
                      >
                        <User className="h-4 w-4 mr-2" />
                        View Profile
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="property" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Property Title</Label>
                      <div className="font-medium">{selectedViewing.property?.title || 'N/A'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Address</Label>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {selectedViewing.property?.location_address || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/listings?search=${selectedViewing.property_id}`)}
                      >
                        <Home className="h-4 w-4 mr-2" />
                        View Property
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="actions" className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('confirm');
                        setActionDialogOpen(true);
                      }}
                      disabled={selectedViewing.status === 'confirmed'}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Viewing
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('cancel');
                        setActionDialogOpen(true);
                      }}
                      disabled={selectedViewing.status === 'cancelled'}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Viewing
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('reschedule');
                        setNewDate(selectedViewing.viewing_date);
                        setNewTime(selectedViewing.viewing_time);
                        setActionDialogOpen(true);
                      }}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Reschedule
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => sendReminder(selectedViewing)}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Reminder
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('attended');
                        setActionDialogOpen(true);
                      }}
                      disabled={selectedViewing.status === 'completed' || selectedViewing.status === 'attended'}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Attended
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('no_show');
                        setActionDialogOpen(true);
                      }}
                      disabled={selectedViewing.status === 'no_show'}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Mark No Show
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('note');
                        setActionDialogOpen(true);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'confirm' && 'Confirm Viewing'}
              {actionType === 'cancel' && 'Cancel Viewing'}
              {actionType === 'reschedule' && 'Reschedule Viewing'}
              {actionType === 'attended' && 'Mark as Attended'}
              {actionType === 'no_show' && 'Mark as No Show'}
              {actionType === 'note' && 'Add Note'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'confirm' && 'Confirm this viewing and notify the tenant'}
              {actionType === 'cancel' && 'Cancel this viewing and notify the tenant'}
              {actionType === 'reschedule' && 'Reschedule this viewing to a new date and time'}
              {actionType === 'attended' && 'Mark this viewing as attended'}
              {actionType === 'no_show' && 'Mark this viewing as no show'}
              {actionType === 'note' && 'Add an internal note to this viewing'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {actionType === 'reschedule' && (
              <>
                <div>
                  <Label>New Date</Label>
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>New Time</Label>
                  <Input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <Label>Note (optional)</Label>
              <Textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Add a note about this action..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAction}>
              {actionType === 'confirm' && 'Confirm'}
              {actionType === 'cancel' && 'Cancel Viewing'}
              {actionType === 'reschedule' && 'Reschedule'}
              {actionType === 'attended' && 'Mark Attended'}
              {actionType === 'no_show' && 'Mark No Show'}
              {actionType === 'note' && 'Add Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

