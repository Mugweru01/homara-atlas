import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  Home,
  Calendar,
  DollarSign,
  ShieldCheck,
  AlertCircle,
  FileText,
  Gavel,
  Clock,
  UserPlus,
  Building2,
  CreditCard,
  CheckCircle,
  XCircle,
  Activity,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { logger } from '@/lib/production-logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActivityItem {
  id: string;
  type: 'user' | 'listing' | 'booking' | 'payment' | 'verification' | 'security' | 'auction';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  metadata?: {
    amount?: number;
    status?: string;
    property_title?: string;
    booking_id?: string;
    payment_id?: string;
  };
  link?: string;
}

const activityIcons = {
  user: UserPlus,
  listing: Building2,
  booking: Calendar,
  payment: CreditCard,
  verification: ShieldCheck,
  security: AlertCircle,
  auction: Gavel,
};

const activityColors = {
  user: 'text-blue-600',
  listing: 'text-green-600',
  booking: 'text-purple-600',
  payment: 'text-emerald-600',
  verification: 'text-orange-600',
  security: 'text-red-600',
  auction: 'text-indigo-600',
};

export function ActivityFeed({ limit = 20 }: { limit?: number }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const activitiesList: ActivityItem[] = [];

      // Fetch recent user registrations
      const { data: recentUsers } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      recentUsers?.forEach((user) => {
        activitiesList.push({
          id: `user-${user.id}`,
          type: 'user',
          title: 'New User Registration',
          description: `${user.full_name || user.email} joined the platform`,
          timestamp: user.created_at,
          user: {
            id: user.id,
            name: user.full_name || user.email,
            email: user.email,
            avatar: user.avatar_url || undefined,
          },
          link: `/admin/users?search=${user.id}`,
        });
      });

      // Fetch recent listings
      const { data: recentListings } = await supabase
        .from('properties')
        .select('id, title, created_at, owner_id, profiles!properties_owner_id_fkey(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(5);

      recentListings?.forEach((listing: any) => {
        activitiesList.push({
          id: `listing-${listing.id}`,
          type: 'listing',
          title: 'New Property Listing',
          description: `${listing.title} was added by ${listing.profiles?.full_name || listing.profiles?.email || 'Unknown'}`,
          timestamp: listing.created_at,
          metadata: {
            property_title: listing.title,
          },
          link: `/admin/listings?search=${listing.id}`,
        });
      });

      // Fetch recent bookings
      const [shortStayBookings, viewingBookings] = await Promise.all([
        supabase
          .from('short_stay_bookings')
          .select('id, check_in_date, total_amount, status, created_at, guest_id, profiles!short_stay_bookings_guest_id_fkey(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('viewing_bookings')
          .select('id, viewing_date, status, created_at, tenant_id, profiles!viewing_bookings_tenant_id_fkey(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      shortStayBookings.data?.forEach((booking: any) => {
        activitiesList.push({
          id: `booking-${booking.id}`,
          type: 'booking',
          title: 'New Short Stay Booking',
          description: `Booking for ${format(new Date(booking.check_in_date), 'MMM dd, yyyy')} - ${booking.profiles?.full_name || booking.profiles?.email || 'Guest'}`,
          timestamp: booking.created_at,
          metadata: {
            amount: booking.total_amount,
            status: booking.status,
            booking_id: booking.id,
          },
          link: `/admin/bookings/short-stays`,
        });
      });

      viewingBookings.data?.forEach((booking: any) => {
        activitiesList.push({
          id: `viewing-${booking.id}`,
          type: 'booking',
          title: 'New Viewing Scheduled',
          description: `Viewing scheduled for ${format(new Date(booking.viewing_date), 'MMM dd, yyyy')} - ${booking.profiles?.full_name || booking.profiles?.email || 'Tenant'}`,
          timestamp: booking.created_at,
          metadata: {
            status: booking.status,
            booking_id: booking.id,
          },
          link: `/admin/bookings/viewings`,
        });
      });

      // Fetch recent payments
      const { data: recentPayments } = await supabase
        .from('payments')
        .select('id, amount, status, payment_type, created_at, user_id, profiles!payments_user_id_fkey(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(5);

      recentPayments?.forEach((payment: any) => {
        activitiesList.push({
          id: `payment-${payment.id}`,
          type: 'payment',
          title: 'Payment Transaction',
          description: `${payment.payment_type || 'Payment'} - ${payment.profiles?.full_name || payment.profiles?.email || 'User'}`,
          timestamp: payment.created_at,
          metadata: {
            amount: payment.amount,
            status: payment.status,
            payment_id: payment.id,
          },
          link: `/admin/payments/transactions`,
        });
      });

      // Fetch recent verifications
      const { data: recentVerifications } = await supabase
        .from('landlord_verifications')
        .select('id, status, created_at, user_id, profiles!landlord_verifications_user_id_fkey(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(5);

      recentVerifications?.forEach((verification: any) => {
        activitiesList.push({
          id: `verification-${verification.id}`,
          type: 'verification',
          title: `Verification ${verification.status === 'approved' ? 'Approved' : verification.status === 'rejected' ? 'Rejected' : 'Requested'}`,
          description: `${verification.profiles?.full_name || verification.profiles?.email || 'User'} - Status: ${verification.status}`,
          timestamp: verification.created_at,
          metadata: {
            status: verification.status,
          },
          link: `/admin/verifications`,
        });
      });

      // Fetch recent auctions (if available)
      const { data: recentAuctions } = await supabase
        .from('marketplace_listings')
        .select('id, title, status, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      recentAuctions?.forEach((auction: any) => {
        activitiesList.push({
          id: `auction-${auction.id}`,
          type: 'auction',
          title: 'New Auction Listing',
          description: `${auction.title} - Status: ${auction.status}`,
          timestamp: auction.created_at,
          metadata: {
            property_title: auction.title,
          },
          link: `/admin/marketplace/auctions`,
        });
      });

      // Sort by timestamp and limit
      activitiesList.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const filtered = filter === 'all' 
        ? activitiesList.slice(0, limit)
        : activitiesList.filter(a => a.type === filter).slice(0, limit);

      setActivities(filtered);
    } catch (error) {
      logger.error('Error fetching activities', { error });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    // Set up real-time subscriptions
    const channels = [
      supabase
        .channel('activity-feed-profiles')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'profiles' },
          () => fetchActivities()
        )
        .subscribe(),
      supabase
        .channel('activity-feed-properties')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'properties' },
          () => fetchActivities()
        )
        .subscribe(),
      supabase
        .channel('activity-feed-bookings')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'short_stay_bookings' },
          () => fetchActivities()
        )
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'viewing_bookings' },
          () => fetchActivities()
        )
        .subscribe(),
      supabase
        .channel('activity-feed-payments')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'payments' },
          () => fetchActivities()
        )
        .subscribe(),
    ];

    // Refresh every 30 seconds
    const interval = setInterval(fetchActivities, 30000);

    return () => {
      channels.forEach(ch => ch.unsubscribe());
      clearInterval(interval);
    };
  }, [filter, limit]);

  const filteredActivities = filter === 'all'
    ? activities
    : activities.filter(a => a.type === filter);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest platform activities and events</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="listing">Listings</SelectItem>
              <SelectItem value="booking">Bookings</SelectItem>
              <SelectItem value="payment">Payments</SelectItem>
              <SelectItem value="verification">Verifications</SelectItem>
              <SelectItem value="auction">Auctions</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Activity className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent activity
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {filteredActivities.map((activity) => {
                const Icon = activityIcons[activity.type];
                const iconColor = activityColors[activity.type];

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg bg-muted ${iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{activity.title}</p>
                            {activity.metadata?.status && (
                              <Badge variant="outline" className="text-xs">
                                {activity.metadata.status}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {activity.description}
                          </p>
                          {activity.metadata?.amount && (
                            <p className="text-sm font-medium text-green-600 mt-1">
                              KES {activity.metadata.amount.toLocaleString()}
                            </p>
                          )}
                          {activity.user && (
                            <div className="flex items-center gap-2 mt-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={activity.user.avatar} />
                                <AvatarFallback>
                                  {activity.user.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground">
                                {activity.user.name}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </div>
                      </div>
                      {activity.link && (
                        <Link to={activity.link}>
                          <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs">
                            View Details
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
        <div className="mt-4 pt-4 border-t">
          <Link to="/admin/audit-logs">
            <Button variant="outline" className="w-full">
              View All Activity
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

