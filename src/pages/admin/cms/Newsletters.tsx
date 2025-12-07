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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Mail,
  Search,
  RefreshCw,
  Plus,
  Edit,
  Send,
  Trash2,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface NewsletterCampaign {
  id: string;
  name: string;
  subject: string;
  content: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  scheduled_at?: string;
  sent_at?: string;
  recipient_count: number;
  opened_count: number;
  clicked_count: number;
  created_at: string;
  updated_at: string;
}

interface Subscriber {
  id: string;
  email: string;
  name?: string;
  status: 'active' | 'unsubscribed' | 'bounced';
  subscribed_at: string;
  unsubscribed_at?: string;
}

export default function Newsletters() {
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<NewsletterCampaign | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: '',
    scheduled_at: '',
  });

  useEffect(() => {
    fetchCampaigns();
    fetchSubscribers();
    const interval = setInterval(() => {
      fetchCampaigns();
      fetchSubscribers();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('newsletters')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
        .catch(() => ({ data: [], error: null }));

      if (error && error.code !== '42P01') {
        throw error;
      }

      const processedCampaigns = (data || []).map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name || 'Untitled Campaign',
        subject: campaign.subject || '',
        content: campaign.content || '',
        status: campaign.status || 'draft',
        scheduled_at: campaign.scheduled_at,
        sent_at: campaign.sent_at,
        recipient_count: campaign.recipient_count || 0,
        opened_count: campaign.opened_count || 0,
        clicked_count: campaign.clicked_count || 0,
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
      }));

      setCampaigns(processedCampaigns);
    } catch (error: any) {
      logger.error('Error fetching campaigns:', error);
      if (error.code !== '42P01') {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch campaigns',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('subscribed_at', { ascending: false })
        .limit(1000)
        .catch(() => ({ data: [], error: null }));

      if (error && error.code !== '42P01') {
        throw error;
      }

      const processedSubscribers = (data || []).map((sub: any) => ({
        id: sub.id,
        email: sub.email || '',
        name: sub.name || null,
        status: sub.status || 'active',
        subscribed_at: sub.subscribed_at,
        unsubscribed_at: sub.unsubscribed_at,
      }));

      setSubscribers(processedSubscribers);
    } catch (error: any) {
      logger.error('Error fetching subscribers:', error);
    }
  };

  const handleCreate = () => {
    setSelectedCampaign(null);
    setFormData({
      name: '',
      subject: '',
      content: '',
      scheduled_at: '',
    });
    setCampaignDialogOpen(true);
  };

  const handleEdit = (campaign: NewsletterCampaign) => {
    setSelectedCampaign(campaign);
    setFormData({
      name: campaign.name,
      subject: campaign.subject,
      content: campaign.content,
      scheduled_at: campaign.scheduled_at ? format(new Date(campaign.scheduled_at), "yyyy-MM-dd'T'HH:mm") : '',
    });
    setCampaignDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.name.trim() || !formData.subject.trim()) {
        toast({
          title: 'Error',
          description: 'Name and subject are required',
          variant: 'destructive',
        });
        return;
      }

      const campaignData: any = {
        name: formData.name.trim(),
        subject: formData.subject.trim(),
        content: formData.content,
        status: formData.scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: formData.scheduled_at || null,
        updated_at: new Date().toISOString(),
      };

      if (selectedCampaign) {
        const { error } = await supabase
          .from('newsletters')
          .update(campaignData)
          .eq('id', selectedCampaign.id)
          .catch(() => ({ error: null }));

        if (error && error.code !== '42P01') {
          throw error;
        }

        toast({
          title: 'Success',
          description: 'Campaign updated',
        });
      } else {
        const { error } = await supabase
          .from('newsletters')
          .insert(campaignData)
          .catch(() => ({ error: null }));

        if (error && error.code !== '42P01') {
          throw error;
        }

        toast({
          title: 'Success',
          description: 'Campaign created',
        });
      }

      setCampaignDialogOpen(false);
      fetchCampaigns();
    } catch (error: any) {
      logger.error('Error saving campaign:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save campaign',
        variant: 'destructive',
      });
    }
  };

  const handleSend = async (campaign: NewsletterCampaign) => {
    if (!confirm(`Send campaign "${campaign.name}" to ${campaign.recipient_count} subscribers?`)) return;

    try {
      const { error } = await supabase
        .from('newsletters')
        .update({
          status: 'sending',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id)
        .catch(() => ({ error: null }));

      if (error && error.code !== '42P01') {
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Campaign sending started',
      });

      fetchCampaigns();
    } catch (error: any) {
      logger.error('Error sending campaign:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send campaign',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      const { error } = await supabase
        .from('newsletters')
        .delete()
        .eq('id', campaignId)
        .catch(() => ({ error: null }));

      if (error && error.code !== '42P01') {
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Campaign deleted',
      });

      fetchCampaigns();
    } catch (error: any) {
      logger.error('Error deleting campaign:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete campaign',
        variant: 'destructive',
      });
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = search === '' || 
      campaign.name.toLowerCase().includes(search.toLowerCase()) ||
      campaign.subject.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredSubscribers = subscribers.filter(sub => {
    const matchesSearch = search === '' || 
      sub.email.toLowerCase().includes(search.toLowerCase()) ||
      sub.name?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const stats = {
    totalCampaigns: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    scheduled: campaigns.filter(c => c.status === 'scheduled').length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    totalSubscribers: subscribers.length,
    activeSubscribers: subscribers.filter(s => s.status === 'active').length,
    unsubscribed: subscribers.filter(s => s.status === 'unsubscribed').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="success">Sent</Badge>;
      case 'sending':
        return <Badge variant="default">Sending</Badge>;
      case 'scheduled':
        return <Badge variant="outline">Scheduled</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="warning">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Newsletter Management</h1>
          <p className="text-muted-foreground">
            Manage email campaigns and subscribers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchCampaigns} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
          <ExportButton data={filteredCampaigns} filename="newsletter-campaigns" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubscribers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.activeSubscribers}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
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
                      placeholder="Search campaigns..."
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
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="sending">Sending</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Campaigns Table */}
          <Card>
            <CardHeader>
              <CardTitle>Campaigns ({filteredCampaigns.length})</CardTitle>
              <CardDescription>
                Email newsletter campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No campaigns found</p>
                  <p className="text-sm mt-2">
                    Campaigns will appear here once the database tables are created
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead>Opened</TableHead>
                        <TableHead>Clicked</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCampaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <div className="font-medium">{campaign.name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-md truncate">{campaign.subject}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{campaign.recipient_count}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span>{campaign.opened_count}</span>
                              {campaign.recipient_count > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ({((campaign.opened_count / campaign.recipient_count) * 100).toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span>{campaign.clicked_count}</span>
                              {campaign.recipient_count > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ({((campaign.clicked_count / campaign.recipient_count) * 100).toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                          <TableCell>
                            {campaign.scheduled_at ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(campaign.scheduled_at), 'MMM d, yyyy HH:mm')}
                              </div>
                            ) : campaign.sent_at ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(campaign.sent_at), 'MMM d, yyyy')}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not scheduled</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(campaign)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {campaign.status === 'draft' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSend(campaign)}
                                  title="Send"
                                >
                                  <Send className="h-4 w-4 text-success" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(campaign.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
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
        </TabsContent>

        <TabsContent value="subscribers" className="space-y-4">
          {/* Subscribers Search */}
          <Card>
            <CardHeader>
              <CardTitle>Subscribers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subscribers by email or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardContent>
          </Card>

          {/* Subscribers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Subscriber List ({filteredSubscribers.length})</CardTitle>
              <CardDescription>
                Newsletter subscribers and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscribers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No subscribers found</p>
                  <p className="text-sm mt-2">
                    Subscribers will appear here once the database tables are created
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Subscribed</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubscribers.map((subscriber) => (
                        <TableRow key={subscriber.id}>
                          <TableCell>
                            <div className="font-medium">{subscriber.email}</div>
                          </TableCell>
                          <TableCell>
                            {subscriber.name || <span className="text-muted-foreground">N/A</span>}
                          </TableCell>
                          <TableCell>
                            {subscriber.status === 'active' ? (
                              <Badge variant="success">Active</Badge>
                            ) : subscriber.status === 'unsubscribed' ? (
                              <Badge variant="secondary">Unsubscribed</Badge>
                            ) : (
                              <Badge variant="destructive">Bounced</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(subscriber.subscribed_at), 'MMM d, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(subscriber.id)}
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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
      </Tabs>

      {/* Campaign Dialog */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCampaign ? 'Edit Campaign' : 'Create New Campaign'}
            </DialogTitle>
            <DialogDescription>
              {selectedCampaign ? 'Update campaign details' : 'Create a new newsletter campaign'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Campaign Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter campaign name"
              />
            </div>

            <div>
              <Label>Email Subject *</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Enter email subject line"
              />
            </div>

            <div>
              <Label>Email Content *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write your newsletter content here... (Email template editor will be implemented)"
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Note: Rich email template editor coming soon
              </p>
            </div>

            <div>
              <Label>Schedule Send (optional)</Label>
              <Input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to save as draft
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {selectedCampaign ? 'Update Campaign' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

