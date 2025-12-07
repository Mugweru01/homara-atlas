import { useEffect, useState, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Calendar,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Eye,
  User,
  Home,
  Mail,
  Phone,
  MapPin,
  Bed,
  Bath,
  Edit,
  FileText,
  Shield,
  TrendingDown,
  TrendingUp,
  Ban,
  AlertTriangle,
  Building,
  Receipt,
  ArrowLeftRight,
  Activity,
  BarChart3,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';

interface ShortStayBooking {
  id: string;
  property_id: string;
  guest_id: string;
  landlord_id?: string;
  landlord_name?: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  total_amount: number;
  status: string;
  payment_status: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  refund_amount?: number;
  refund_status?: string;
  refund_requested_at?: string;
  refund_processed_at?: string;
  special_requests?: string;
  created_at: string;
  updated_at: string;
  property?: {
    id: string;
    title: string;
    location_address: string;
    bedrooms: number;
    bathrooms: number;
    landlord_id: string;
  };
  guest?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
  };
}

interface OversightStats {
  // Overall metrics
  total_bookings: number;
  active_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  total_revenue: number;
  
  // Refund metrics
  pending_refunds: number;
  total_refunded: number;
  refund_requests: number;
  
  // Cancellation metrics
  cancellation_rate: number;
  cancellations_this_month: number;
  cancellation_reasons: Record<string, number>;
  
  // Compliance metrics
  policy_violations: number;
  disputes: number;
  flagged_bookings: number;
  
  // Landlord metrics
  active_landlords: number;
  problematic_landlords: number;
  
  // Today's metrics
  today_bookings: number;
  today_revenue: number;
  today_cancellations: number;
}

export default function ShortStayBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<ShortStayBooking[]>([]);
  const [stats, setStats] = useState<OversightStats>({
    total_bookings: 0,
    active_bookings: 0,
    completed_bookings: 0,
    cancelled_bookings: 0,
    total_revenue: 0,
    pending_refunds: 0,
    total_refunded: 0,
    refund_requests: 0,
    cancellation_rate: 0,
    cancellations_this_month: 0,
    cancellation_reasons: {},
    policy_violations: 0,
    disputes: 0,
    flagged_bookings: 0,
    active_landlords: 0,
    problematic_landlords: 0,
    today_bookings: 0,
    today_revenue: 0,
    today_cancellations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedBooking, setSelectedBooking] = useState<ShortStayBooking | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      // Fetch all bookings for admin oversight
      const { data, error } = await supabase
        .from('short_stay_bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000); // Higher limit for admin oversight

      if (error) {
        logger.error('Error fetching bookings:', error);
        console.error('Booking fetch error:', error);
        if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST301' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setBookings([]);
          setStats({
            total_bookings: 0,
            active_bookings: 0,
            completed_bookings: 0,
            cancelled_bookings: 0,
            total_revenue: 0,
            pending_refunds: 0,
            total_refunded: 0,
            refund_requests: 0,
            cancellation_rate: 0,
            cancellations_this_month: 0,
            cancellation_reasons: {},
            policy_violations: 0,
            disputes: 0,
            flagged_bookings: 0,
            active_landlords: 0,
            problematic_landlords: 0,
            today_bookings: 0,
            today_revenue: 0,
            today_cancellations: 0,
          });
          return;
        }
        throw error;
      }

      let bookings = data || [];
      console.log('Fetched bookings count:', bookings.length);
      logger.info(`Fetched ${bookings.length} bookings`);
      
      // Fetch related data separately
      if (bookings.length > 0) {
        const propertyIds = [...new Set(bookings.map((b: any) => b.property_id).filter(Boolean))];
        const guestIds = [...new Set(bookings.map((b: any) => b.guest_id).filter(Boolean))];
        
        // Fetch properties with landlord info
        const propertiesMap = new Map();
        if (propertyIds.length > 0) {
          try {
            const { data: properties, error: propError } = await supabase
              .from('properties')
              .select('id, title, location_name, bedrooms, bathrooms, landlord_id')
              .in('id', propertyIds);
            
            if (propError) {
              console.error('Error fetching properties:', propError);
              logger.error('Error fetching properties:', propError);
            } else if (properties) {
              console.log('Fetched properties:', properties.length);
              properties.forEach((p: any) => {
                propertiesMap.set(p.id, {
                  ...p,
                  location_address: p.location_name || 'N/A', // Map location_name to location_address for compatibility
                  landlord_id: p.landlord_id,
                });
              });
            }
          } catch (propError: any) {
            console.error('Exception fetching properties:', propError);
            logger.error('Error fetching properties:', propError);
          }
        }
        
        // Fetch landlord names - include both property landlords and booking hosts
        const propertyLandlordIds = [...new Set(Array.from(propertiesMap.values()).map((p: any) => p.landlord_id).filter(Boolean))];
        const bookingHostIds = [...new Set(bookings.map((b: any) => b.host_id).filter(Boolean))];
        const allLandlordIds = [...new Set([...propertyLandlordIds, ...bookingHostIds])];
        const landlordsMap = new Map();
        if (allLandlordIds.length > 0) {
          try {
            const { data: landlords } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', allLandlordIds);
            
            if (landlords) {
              landlords.forEach((l: any) => {
                landlordsMap.set(l.id, l.full_name);
              });
            }
          } catch (landlordError: any) {
            logger.error('Error fetching landlords:', landlordError);
          }
        }
        
        // Fetch guest profiles
        const guestsMap = new Map();
        if (guestIds.length > 0) {
          try {
            const { data: guests, error: guestError } = await supabase
              .from('profiles')
              .select('id, full_name, email, phone_e164')
              .in('id', guestIds);
            
            if (guestError) {
              console.error('Error fetching guests:', guestError);
              logger.error('Error fetching guest profiles:', guestError);
            } else if (guests) {
              console.log('Fetched guests:', guests.length);
              guests.forEach((g: any) => {
                guestsMap.set(g.id, {
                  id: g.id,
                  full_name: g.full_name || 'N/A',
                  email: g.email || 'N/A',
                  phone: g.phone_e164 || 'N/A',
                });
              });
            }
          } catch (guestError: any) {
            console.error('Exception fetching guests:', guestError);
            logger.error('Error fetching guest profiles:', guestError);
          }
        }
        
        // Merge all data and map database columns to interface
        bookings = bookings.map((booking: any) => {
          const property = propertiesMap.get(booking.property_id);
          // Use host_id from booking if property doesn't have landlord_id
          const landlordId = property?.landlord_id || booking.host_id;
          const guest = guestsMap.get(booking.guest_id);
          
          // Map database columns to interface
          // booking_status -> status
          // final_price -> total_amount
          // host_id -> landlord_id
          // Calculate payment_status from deposit_paid and full_payment_paid
          let paymentStatus = 'pending';
          if (booking.full_payment_paid) {
            paymentStatus = 'paid';
          } else if (booking.deposit_paid) {
            paymentStatus = 'partial';
          }
          
          // If cancelled and has refund, mark as refunded
          if (booking.booking_status === 'cancelled' && booking.refund_amount && booking.refund_amount > 0) {
            paymentStatus = 'refunded';
          }
          
          // For cancelled bookings, show cancelled_at or created_at if cancelled_at is null
          let cancelledDate = booking.cancelled_at;
          if (booking.booking_status === 'cancelled' && !cancelledDate) {
            cancelledDate = booking.created_at; // Fallback to created_at if cancelled_at is null
          }
          
          const mappedBooking = {
            ...booking,
            // Map database columns
            status: booking.booking_status || booking.status || 'pending',
            total_amount: booking.final_price || booking.total_price || booking.total_amount || 0,
            landlord_id: landlordId,
            payment_status: paymentStatus,
            cancelled_at: cancelledDate, // Use mapped cancelled date
            // Keep original fields for reference
            booking_status: booking.booking_status,
            final_price: booking.final_price,
            host_id: booking.host_id,
            property: property || null,
            landlord_name: landlordId ? landlordsMap.get(landlordId) : null,
            guest: guest || null,
          };
          
          // Debug log for first booking
          if (bookings.indexOf(booking) === 0) {
            console.log('Sample mapped booking:', {
              id: mappedBooking.id,
              hasProperty: !!mappedBooking.property,
              propertyTitle: mappedBooking.property?.title,
              hasGuest: !!mappedBooking.guest,
              guestName: mappedBooking.guest?.full_name,
              landlordName: mappedBooking.landlord_name,
            });
          }
          
          return mappedBooking;
        });
      }
      
      console.log('Processed bookings:', bookings.length);
      setBookings(bookings);

      // Calculate comprehensive oversight stats
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      
      const total = bookings.length;
      const active = bookings.filter((b: any) => b.status === 'confirmed' || b.status === 'pending').length;
      const completed = bookings.filter((b: any) => b.status === 'completed').length;
      const cancelled = bookings.filter((b: any) => b.status === 'cancelled').length;
      const revenue = bookings.reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0);
      
      // Refund stats - based on actual refund data
      const refunded = bookings.filter((b: any) => 
        b.payment_status === 'refunded' || 
        (b.status === 'cancelled' && b.refund_amount && b.refund_amount > 0)
      );
      const pendingRefunds = bookings.filter((b: any) => 
        b.status === 'cancelled' && 
        b.payment_status === 'paid' && 
        (!b.refund_amount || b.refund_amount === 0)
      );
      const totalRefunded = refunded.reduce((sum: number, b: any) => sum + (Number(b.refund_amount || 0) || 0), 0);
      
      // Cancellation stats
      const cancellations = bookings.filter((b: any) => b.status === 'cancelled');
      const cancellationsThisMonth = cancellations.filter((b: any) => 
        b.cancelled_at && new Date(b.cancelled_at) >= thisMonth
      ).length;
      const cancellationRate = total > 0 ? (cancelled / total) * 100 : 0;
      
      // Cancellation reasons
      const reasons: Record<string, number> = {};
      cancellations.forEach((b: any) => {
        const reason = b.cancellation_reason || 'No reason provided';
        reasons[reason] = (reasons[reason] || 0) + 1;
      });
      
      // Today's stats
      const todayBookings = bookings.filter((b: any) => {
        const checkIn = b.check_in_date || b.created_at;
        return checkIn && typeof checkIn === 'string' && checkIn.startsWith(today);
      }).length;
      const todayRevenue = bookings
        .filter((b: any) => {
          const checkIn = b.check_in_date || b.created_at;
          return checkIn && typeof checkIn === 'string' && checkIn.startsWith(today);
        })
        .reduce((sum: number, b: any) => sum + (Number(b.total_amount) || 0), 0);
      const todayCancellations = cancellations.filter((b: any) => 
        b.cancelled_at && typeof b.cancelled_at === 'string' && b.cancelled_at.startsWith(today)
      ).length;
      
      // Landlord stats
      const uniqueLandlords = new Set(bookings.map((b: any) => b.landlord_id).filter(Boolean));
      const activeLandlords = uniqueLandlords.size;
      
      const calculatedStats = {
        total_bookings: total,
        active_bookings: active,
        completed_bookings: completed,
        cancelled_bookings: cancelled,
        total_revenue: revenue,
        pending_refunds: pendingRefunds.length,
        total_refunded: totalRefunded,
        refund_requests: pendingRefunds.length,
        cancellation_rate: cancellationRate,
        cancellations_this_month: cancellationsThisMonth,
        cancellation_reasons: reasons,
        policy_violations: 0, // Would come from flags/complaints
        disputes: 0, // Would come from disputes table
        flagged_bookings: 0, // Would come from flags
        active_landlords: activeLandlords,
        problematic_landlords: 0, // Would be calculated from violations
        today_bookings: todayBookings,
        today_revenue: todayRevenue,
        today_cancellations: todayCancellations,
      };
      
      console.log('Calculated stats:', calculatedStats);
      setStats(calculatedStats);
    } catch (error: any) {
      logger.error('Error fetching bookings:', error);
      console.error('Full error object:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      setBookings([]);
      // Don't show toast for missing table/schema errors
      if (
        error?.code !== '42P01' && 
        error?.code !== 'PGRST116' && 
        error?.code !== 'PGRST301' &&
        !error?.message?.includes('does not exist') &&
        !error?.message?.includes('schema cache')
      ) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch bookings',
          variant: 'destructive',
        });
      } else {
        console.warn('Table or schema not found, setting empty state');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 60000); // Auto-refresh every minute
    return () => clearInterval(interval);
  }, []);

  const filteredBookings = useMemo(() => {
    let filtered = bookings;
    
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(booking => {
        return (
          booking.property?.title?.toLowerCase().includes(searchLower) ||
          booking.guest?.full_name?.toLowerCase().includes(searchLower) ||
          booking.guest?.email?.toLowerCase().includes(searchLower) ||
          booking.landlord_name?.toLowerCase().includes(searchLower) ||
          booking.id.toLowerCase().includes(searchLower)
        );
      });
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }
    
    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(b => b.payment_status === paymentStatusFilter);
    }
    
    return filtered;
  }, [bookings, searchTerm, statusFilter, paymentStatusFilter]);

  // Get bookings for specific tabs
  const refundBookings = useMemo(() => {
    return bookings.filter(b => 
      // Cancelled bookings with refunds (processed or pending)
      (b.status === 'cancelled' && b.refund_amount && b.refund_amount > 0) ||
      // Cancelled bookings that need refunds (paid but no refund yet)
      (b.status === 'cancelled' && b.payment_status === 'paid' && (!b.refund_amount || b.refund_amount === 0)) ||
      // Any booking with refund status
      b.payment_status === 'refunded'
    );
  }, [bookings]);

  const cancelledBookings = useMemo(() => {
    return bookings.filter(b => b.status === 'cancelled');
  }, [bookings]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      confirmed: 'default',
      pending: 'secondary',
      cancelled: 'destructive',
      completed: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      paid: 'default',
      pending: 'secondary',
      refunded: 'destructive',
      failed: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleProcessRefund = async () => {
    if (!selectedBooking) return;

    try {
      const refundAmt = refundAmount ? parseFloat(refundAmount) : selectedBooking.total_amount;
      
      // Update booking with refund info
      const { error } = await supabase
        .from('short_stay_bookings')
        .update({
          refund_status: 'processed',
          refund_amount: refundAmt,
          refund_processed_at: new Date().toISOString(),
          payment_status: 'refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      // Log admin action
      await supabase.from('admin_activity_log').insert({
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'refund_processed',
        details: {
          booking_id: selectedBooking.id,
          refund_amount: refundAmt,
          reason: refundReason,
        },
      });

      toast({
        title: 'Success',
        description: `Refund of KES ${refundAmt.toLocaleString()} processed successfully`,
      });

      setRefundDialogOpen(false);
      setRefundAmount('');
      setRefundReason('');
      setSelectedBooking(null);
      fetchBookings();
    } catch (error: any) {
      logger.error('Error processing refund:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process refund',
        variant: 'destructive',
      });
    }
  };

  const calculateNights = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Short Stay Bookings - Admin Oversight</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and oversee all BNB bookings across the platform. Track refunds, cancellations, and ensure compliance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchBookings} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <ExportButton
            data={filteredBookings}
            filename="short-stay-bookings-oversight"
            label="Export"
          />
        </div>
      </div>

      {/* Oversight Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_bookings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.today_bookings} today • {stats.active_bookings} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Refunds</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending_refunds}</div>
            <p className="text-xs text-muted-foreground">
              KES {stats.total_refunded.toLocaleString()} total refunded
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancellation Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.cancellation_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.cancelled_bookings} cancelled • {stats.cancellations_this_month} this month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {stats.total_revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              KES {stats.today_revenue.toLocaleString()} today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Oversight Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Landlords</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_landlords}</div>
            <p className="text-xs text-muted-foreground">
              {stats.problematic_landlords} flagged
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Issues</CardTitle>
            <Shield className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.policy_violations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.disputes} disputes • {stats.flagged_bookings} flagged
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed_bookings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.cancelled_bookings} cancelled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="all-bookings">All Bookings</TabsTrigger>
          <TabsTrigger value="refunds">
            Refunds
            {stats.pending_refunds > 0 && (
              <Badge variant="destructive" className="ml-2">{stats.pending_refunds}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cancellations">
            Cancellations
            {stats.cancelled_bookings > 0 && (
              <Badge variant="destructive" className="ml-2">{stats.cancelled_bookings}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest bookings requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bookings.slice(0, 5).map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {booking.property?.title || `Booking ${booking.id.slice(0, 8)}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            <span>{booking.guest?.full_name || 'Guest N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {format(new Date(booking.check_in_date), 'MMM dd')} - {format(new Date(booking.check_out_date), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(booking.status)}
                            <span className="text-muted-foreground">
                              • KES {booking.total_amount?.toLocaleString() || '0'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setDetailDialogOpen(true);
                        }}
                        className="ml-2 shrink-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {bookings.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No bookings found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Cancellation Reasons</CardTitle>
                <CardDescription>Most common reasons for cancellations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.cancellation_reasons)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([reason, count]) => (
                      <div key={reason} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">{reason}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  {Object.keys(stats.cancellation_reasons).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No cancellation data</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* All Bookings Tab */}
        <TabsContent value="all-bookings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by property, guest, landlord, or booking ID..."
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
                  </SelectContent>
                </Select>
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Payment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payment Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Bookings ({filteredBookings.length})</CardTitle>
              <CardDescription>Complete oversight of all platform bookings</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-lg animate-pulse">
                      <div className="h-12 w-12 bg-muted rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No bookings found
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booking ID</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Landlord</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-mono text-xs">
                            {booking.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-sm">{booking.property?.title || 'N/A'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {booking.property?.location_address || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{booking.landlord_name || 'N/A'}</div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{booking.guest?.full_name || 'N/A'}</div>
                              <div className="text-xs text-muted-foreground">
                                {booking.guest?.email || 'N/A'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(booking.check_in_date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell className="font-medium">
                            KES {booking.total_amount?.toLocaleString() || '0'}
                          </TableCell>
                          <TableCell>{getStatusBadge(booking.status)}</TableCell>
                          <TableCell>{getPaymentStatusBadge(booking.payment_status)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedBooking(booking);
                                setDetailDialogOpen(true);
                              }}
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
        </TabsContent>

        {/* Refunds Tab */}
        <TabsContent value="refunds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Refund Management</CardTitle>
              <CardDescription>
                Track and process all refunds. Ensure proper refund handling and dispute resolution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {refundBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No refunds to process
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booking ID</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Refund Status</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refundBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-mono text-xs">
                            {booking.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>{booking.property?.title || 'N/A'}</TableCell>
                          <TableCell>{booking.guest?.full_name || 'N/A'}</TableCell>
                          <TableCell className="font-medium">
                            KES {booking.total_amount?.toLocaleString() || '0'}
                          </TableCell>
                          <TableCell>
                            {booking.refund_status === 'pending' ? (
                              <Badge variant="warning">Pending</Badge>
                            ) : (
                              <Badge variant="default">Processed</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {booking.refund_requested_at 
                              ? format(new Date(booking.refund_requested_at), 'MMM dd, yyyy')
                              : booking.cancelled_at
                              ? format(new Date(booking.cancelled_at), 'MMM dd, yyyy')
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {booking.refund_status !== 'processed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setRefundAmount(booking.total_amount?.toString() || '');
                                  setRefundDialogOpen(true);
                                }}
                              >
                                <Receipt className="h-4 w-4 mr-2" />
                                Process Refund
                              </Button>
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
        </TabsContent>

        {/* Cancellations Tab */}
        <TabsContent value="cancellations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cancellation Tracking</CardTitle>
              <CardDescription>
                Monitor cancellations, analyze patterns, and ensure proper refund processing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cancelledBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No cancellations found
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booking ID</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Landlord</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Cancelled</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Refund Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cancelledBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-mono text-xs">
                            {booking.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>{booking.property?.title || 'N/A'}</TableCell>
                          <TableCell>{booking.landlord_name || 'N/A'}</TableCell>
                          <TableCell>{booking.guest?.full_name || 'N/A'}</TableCell>
                          <TableCell>
                            {booking.cancelled_at 
                              ? format(new Date(booking.cancelled_at), 'MMM dd, yyyy')
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate">
                              {booking.cancellation_reason || 'No reason provided'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {booking.payment_status === 'refunded' ? (
                              <Badge variant="default">Refunded</Badge>
                            ) : booking.payment_status === 'paid' ? (
                              <Badge variant="warning">Refund Pending</Badge>
                            ) : (
                              <Badge variant="secondary">No Refund</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedBooking(booking);
                                setDetailDialogOpen(true);
                              }}
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
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance & Quality Control</CardTitle>
              <CardDescription>
                Monitor policy violations, quality issues, and ensure proper booking management.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Compliance monitoring features coming soon</p>
                <p className="text-sm mt-2">
                  This section will track policy violations, quality metrics, and landlord performance.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Booking Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details - Admin Oversight</DialogTitle>
            <DialogDescription>
              Complete information for dispute tracking and oversight
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="guest">Guest Info</TabsTrigger>
                  <TabsTrigger value="property">Property & Landlord</TabsTrigger>
                  <TabsTrigger value="financial">Financial</TabsTrigger>
                  <TabsTrigger value="actions">Admin Actions</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Booking ID</Label>
                      <div className="font-mono text-sm">{selectedBooking.id}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <div>{getStatusBadge(selectedBooking.status)}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Check-in</Label>
                      <div>{format(new Date(selectedBooking.check_in_date), 'PPP')}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Check-out</Label>
                      <div>{format(new Date(selectedBooking.check_out_date), 'PPP')}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Duration</Label>
                      <div>
                        {calculateNights(selectedBooking.check_in_date, selectedBooking.check_out_date)} nights
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Guests</Label>
                      <div>{selectedBooking.number_of_guests} guest(s)</div>
                    </div>
                    {selectedBooking.cancelled_at && (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Cancelled At</Label>
                          <div>{format(new Date(selectedBooking.cancelled_at), 'PPP')}</div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Cancellation Reason</Label>
                          <div>{selectedBooking.cancellation_reason || 'No reason provided'}</div>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="guest" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <div className="font-medium">{selectedBooking.guest?.full_name || 'N/A'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {selectedBooking.guest?.email || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {selectedBooking.guest?.phone || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Guest ID</Label>
                      <div className="font-mono text-xs">{selectedBooking.guest_id}</div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="property" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Property Title</Label>
                      <div className="font-medium">{selectedBooking.property?.title || 'N/A'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Address</Label>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {selectedBooking.property?.location_address || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Landlord</Label>
                      <div className="font-medium">{selectedBooking.landlord_name || 'N/A'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Property ID</Label>
                      <div className="font-mono text-xs">{selectedBooking.property_id}</div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="financial" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Total Amount</Label>
                      <div className="font-semibold text-lg">
                        KES {selectedBooking.total_amount?.toLocaleString() || '0'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Payment Status</Label>
                      <div>{getPaymentStatusBadge(selectedBooking.payment_status)}</div>
                    </div>
                    {selectedBooking.refund_amount && (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Refund Amount</Label>
                          <div className="font-semibold">
                            KES {selectedBooking.refund_amount.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Refund Status</Label>
                          <div>
                            {selectedBooking.refund_status === 'processed' ? (
                              <Badge variant="default">Processed</Badge>
                            ) : (
                              <Badge variant="warning">Pending</Badge>
                            )}
                          </div>
                        </div>
                        {selectedBooking.refund_processed_at && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Refund Processed</Label>
                            <div>{format(new Date(selectedBooking.refund_processed_at), 'PPP')}</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="actions" className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {selectedBooking.status === 'cancelled' && selectedBooking.payment_status === 'paid' && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRefundAmount(selectedBooking.total_amount?.toString() || '');
                          setRefundDialogOpen(true);
                        }}
                      >
                        <Receipt className="h-4 w-4 mr-2" />
                        Process Refund
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/admin/users?search=${selectedBooking.guest_id}`)}
                    >
                      <User className="h-4 w-4 mr-2" />
                      View Guest Profile
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/admin/listings?search=${selectedBooking.property_id}`)}
                    >
                      <Home className="h-4 w-4 mr-2" />
                      View Property
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/admin/payments/transactions?search=${selectedBooking.id}`)}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      View Transaction
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Processing Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Process refund for booking {selectedBooking?.id.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Refund Amount (KES)</Label>
              <Input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={selectedBooking?.total_amount?.toString() || '0'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Original amount: KES {selectedBooking?.total_amount?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <Label>Refund Reason (for audit trail)</Label>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter reason for refund..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleProcessRefund}>
              <Receipt className="h-4 w-4 mr-2" />
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
