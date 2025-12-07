import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Ticket,
  Plus,
  Search,
  BookOpen,
  HelpCircle,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/production-logger';

export default function SupportHome() {
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTicketCount();
  }, []);

  const fetchTicketCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('homaradesk_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('requester_id', user.id);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setTicketCount(0);
          return;
        }
        throw error;
      }

      setTicketCount(count || 0);
    } catch (error) {
      logger.error('Error fetching ticket count:', error);
      setTicketCount(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Support Center</h1>
        <p className="text-lg text-muted-foreground">
          How can we help you today?
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common support tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/support/new">
              <Button className="w-full justify-start" size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Create New Ticket
              </Button>
            </Link>
            <Link to="/support/tickets">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <Ticket className="mr-2 h-5 w-5" />
                View My Tickets
                {ticketCount !== null && ticketCount > 0 && (
                  <span className="ml-auto bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs font-semibold">
                    {ticketCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/support/kb">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <BookOpen className="mr-2 h-5 w-5" />
                Browse Knowledge Base
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Help Resources */}
        <Card>
          <CardHeader>
            <CardTitle>Help Resources</CardTitle>
            <CardDescription>
              Find answers to common questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span>Check our knowledge base for instant answers</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>Contact support for personalized help</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span>Search existing tickets for similar issues</span>
              </div>
            </div>
            <Link to="/support/kb">
              <Button variant="link" className="p-0 h-auto">
                Explore Knowledge Base
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {ticketCount !== null && ticketCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Support Activity</CardTitle>
            <CardDescription>
              Overview of your support tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{ticketCount}</p>
                <p className="text-sm text-muted-foreground">Total tickets</p>
              </div>
              <Link to="/support/tickets">
                <Button>
                  View All Tickets
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

