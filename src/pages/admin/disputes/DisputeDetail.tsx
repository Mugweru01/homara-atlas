import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Scale,
  ArrowLeft,
  RefreshCw,
  User,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserCheck,
  Calendar,
  Edit,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  Send,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Dispute {
  id: string;
  dispute_type: 'booking' | 'payment' | 'property' | 'marketplace' | 'other';
  complainant_id: string;
  complainant_name?: string;
  complainant_email?: string;
  respondent_id: string;
  respondent_name?: string;
  respondent_email?: string;
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

interface Evidence {
  id: string;
  dispute_id: string;
  uploaded_by: string;
  file_url: string;
  file_type: string;
  description?: string;
  created_at: string;
}

interface Message {
  id: string;
  dispute_id: string;
  sender_id: string;
  sender_name?: string;
  sender_type: 'complainant' | 'respondent' | 'mediator' | 'admin';
  message: string;
  created_at: string;
}

export default function DisputeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'assign' | 'status' | 'decision' | 'refund' | 'close' | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [formData, setFormData] = useState({
    mediator_id: '',
    status: 'open' as const,
    priority: 'normal' as const,
    resolution: '',
    refund_amount: '',
    notes: '',
  });

  useEffect(() => {
    if (id) {
      fetchDispute();
      fetchEvidence();
      fetchMessages();
    }
  }, [id]);

  const fetchDispute = async () => {
    try {
      setLoading(true);
      let data = null;
      let error = null;
      
      try {
        const result = await supabase
          .from('disputes')
          .select(`
            *,
            complainant:profiles!disputes_complainant_id_fkey(id, full_name, email),
            respondent:profiles!disputes_respondent_id_fkey(id, full_name, email),
            mediator:admins!disputes_mediator_id_fkey(id, full_name)
          `)
          .eq('id', id)
          .single();
        
        data = result.data;
        error = result.error;
      } catch (queryError: any) {
        if (queryError?.code === '42P01' || queryError?.code === 'PGRST116' || queryError?.code === 'PGRST301') {
          data = null;
          error = null;
        } else {
          throw queryError;
        }
      }

      if (error && error.code !== '42P01' && error.code !== 'PGRST116' && error.code !== 'PGRST301') {
        throw error;
      }

      if (data) {
        const d: any = data;
        setDispute({
          id: d.id,
          dispute_type: d.dispute_type || 'other',
          complainant_id: d.complainant_id,
          complainant_name: (d.complainant as any)?.full_name || 'Unknown',
          complainant_email: (d.complainant as any)?.email || null,
          respondent_id: d.respondent_id,
          respondent_name: (d.respondent as any)?.full_name || 'Unknown',
          respondent_email: (d.respondent as any)?.email || null,
          related_entity_type: d.related_entity_type,
          related_entity_id: d.related_entity_id,
          title: d.title || 'Untitled Dispute',
          description: d.description || '',
          status: d.status || 'open',
          priority: d.priority || 'normal',
          mediator_id: d.mediator_id,
          mediator_name: (d.mediator as any)?.full_name || null,
          amount_disputed: d.amount_disputed,
          resolution: d.resolution,
          resolved_at: d.resolved_at,
          created_at: d.created_at,
          updated_at: d.updated_at,
        });

        setFormData({
          mediator_id: d.mediator_id || '',
          status: d.status || 'open',
          priority: d.priority || 'normal',
          resolution: d.resolution || '',
          refund_amount: d.amount_disputed?.toString() || '',
          notes: '',
        });
      }
    } catch (error: any) {
      logger.error('Error fetching dispute:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch dispute',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEvidence = async () => {
    try {
      let data = null;
      let error = null;
      
      try {
        const result = await supabase
          .from('dispute_evidence')
          .select('*')
          .eq('dispute_id', id)
          .order('created_at', { ascending: false });
        
        data = result.data;
        error = result.error;
      } catch (queryError: any) {
        if (queryError?.code === '42P01' || queryError?.code === 'PGRST116' || queryError?.code === 'PGRST301') {
          data = [];
          error = null;
        } else {
          throw queryError;
        }
      }

      if (error && error.code !== '42P01' && error.code !== 'PGRST116' && error.code !== 'PGRST301') {
        throw error;
      }

      setEvidence((data || []).map((e: any) => ({
        id: e.id,
        dispute_id: e.dispute_id,
        uploaded_by: e.uploaded_by,
        file_url: e.file_url,
        file_type: e.file_type,
        description: e.description,
        created_at: e.created_at,
      })));
    } catch (error: any) {
      logger.error('Error fetching evidence:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      let data = null;
      let error = null;
      
      try {
        const result = await supabase
          .from('dispute_messages')
          .select(`
            *,
            sender:profiles!dispute_messages_sender_id_fkey(id, full_name)
          `)
          .eq('dispute_id', id)
          .order('created_at', { ascending: true });
        
        data = result.data;
        error = result.error;
      } catch (queryError: any) {
        if (queryError?.code === '42P01' || queryError?.code === 'PGRST116' || queryError?.code === 'PGRST301') {
          data = [];
          error = null;
        } else {
          throw queryError;
        }
      }

      if (error && error.code !== '42P01' && error.code !== 'PGRST116' && error.code !== 'PGRST301') {
        throw error;
      }

      setMessages((data || []).map((m: any) => ({
        id: m.id,
        dispute_id: m.dispute_id,
        sender_id: m.sender_id,
        sender_name: (m.sender as any)?.full_name || 'Unknown',
        sender_type: m.sender_type || 'complainant',
        message: m.message,
        created_at: m.created_at,
      })));
    } catch (error: any) {
      logger.error('Error fetching messages:', error);
    }
  };

  const handleAction = (action: 'assign' | 'status' | 'decision' | 'refund' | 'close') => {
    setActionType(action);
    setActionDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!dispute || !actionType) return;

    try {
      let updateData: any = {};

      switch (actionType) {
        case 'assign':
          updateData = {
            mediator_id: formData.mediator_id || null,
            status: 'in_progress',
            updated_at: new Date().toISOString(),
          };
          break;

        case 'status':
          updateData = {
            status: formData.status,
            priority: formData.priority,
            updated_at: new Date().toISOString(),
          };
          break;

        case 'decision':
          updateData = {
            resolution: formData.resolution,
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          break;

        case 'refund':
          // Process refund (would need payment integration)
          toast({
            title: 'Refund Processing',
            description: 'Refund processing functionality will be implemented',
          });
          break;

        case 'close':
          updateData = {
            status: 'closed',
            updated_at: new Date().toISOString(),
          };
          break;
      }

      let error = null;
      
      try {
        const result = await supabase
          .from('disputes')
          .update(updateData)
          .eq('id', dispute.id);
        
        error = result.error;
      } catch (queryError: any) {
        if (queryError?.code === '42P01' || queryError?.code === 'PGRST116' || queryError?.code === 'PGRST301') {
          error = null;
        } else {
          throw queryError;
        }
      }

      if (error && error.code !== '42P01' && error.code !== 'PGRST116' && error.code !== 'PGRST301') {
        throw error;
      }

      toast({
        title: 'Success',
        description: `Dispute ${actionType === 'close' ? 'closed' : 'updated'}`,
      });

      setActionDialogOpen(false);
      setActionType(null);
      fetchDispute();
    } catch (error: any) {
      logger.error('Error performing action:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to perform action',
        variant: 'destructive',
      });
    }
  };

  const sendMessage = async () => {
    if (!dispute || !newMessage.trim()) return;

    try {
      let error = null;
      
      try {
        const result = await supabase
          .from('dispute_messages')
          .insert({
            dispute_id: dispute.id,
            sender_id: (await supabase.auth.getUser()).data.user?.id,
            sender_type: 'admin',
            message: newMessage.trim(),
          });
        
        error = result.error;
      } catch (queryError: any) {
        if (queryError?.code === '42P01' || queryError?.code === 'PGRST116' || queryError?.code === 'PGRST301') {
          error = null;
        } else {
          throw queryError;
        }
      }

      if (error && error.code !== '42P01' && error.code !== 'PGRST116' && error.code !== 'PGRST301') {
        throw error;
      }

      setNewMessage('');
      fetchMessages();
      toast({
        title: 'Success',
        description: 'Message sent',
      });
    } catch (error: any) {
      logger.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/disputes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dispute Not Found</h1>
            <p className="text-muted-foreground">
              The dispute you're looking for doesn't exist
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/disputes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{dispute.title}</h1>
          <p className="text-muted-foreground">
            Dispute #{dispute.id.substring(0, 8)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(dispute.status)}
          {getPriorityBadge(dispute.priority)}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Dispute Info */}
            <Card>
              <CardHeader>
                <CardTitle>Dispute Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Type</Label>
                  <p className="font-medium capitalize">{dispute.dispute_type}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Description</Label>
                  <p className="text-sm whitespace-pre-wrap">{dispute.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(dispute.status)}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Priority</Label>
                    <div className="mt-1">{getPriorityBadge(dispute.priority)}</div>
                  </div>
                </div>
                {dispute.amount_disputed && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Amount Disputed</Label>
                    <p className="font-medium text-lg">
                      KES {dispute.amount_disputed.toLocaleString()}
                    </p>
                  </div>
                )}
                {dispute.resolution && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Resolution</Label>
                    <p className="text-sm whitespace-pre-wrap">{dispute.resolution}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Parties */}
            <Card>
              <CardHeader>
                <CardTitle>Parties Involved</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Complainant</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{dispute.complainant_name}</span>
                  </div>
                  {dispute.complainant_email && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {dispute.complainant_email}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Respondent</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{dispute.respondent_name}</span>
                  </div>
                  {dispute.respondent_email && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {dispute.respondent_email}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Mediator</Label>
                  {dispute.mediator_name ? (
                    <div className="flex items-center gap-2 mt-1">
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                      <span>{dispute.mediator_name}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Not assigned</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Created</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(dispute.created_at), 'MMM d, yyyy HH:mm')}</span>
                  </div>
                </div>
                {dispute.resolved_at && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Resolved</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span>{format(new Date(dispute.resolved_at), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                  </div>
                )}
                {dispute.updated_at && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Last Updated</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(dispute.updated_at), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evidence & Documentation</CardTitle>
              <CardDescription>
                Files and documents submitted as evidence
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evidence.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No evidence submitted yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {evidence.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{item.file_type}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(item.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Communication History</CardTitle>
              <CardDescription>
                Messages and communication between parties
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No messages yet</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg border ${
                        message.sender_type === 'admin' || message.sender_type === 'mediator'
                          ? 'bg-primary/5'
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{message.sender_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {message.sender_type}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  rows={3}
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dispute Actions</CardTitle>
              <CardDescription>
                Manage dispute resolution and mediation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={() => handleAction('assign')}
                  disabled={dispute.status === 'resolved' || dispute.status === 'closed'}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  {dispute.mediator_name ? 'Reassign Mediator' : 'Assign Mediator'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction('status')}
                  disabled={dispute.status === 'resolved' || dispute.status === 'closed'}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Update Status
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction('decision')}
                  disabled={dispute.status === 'resolved' || dispute.status === 'closed'}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Make Decision
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction('refund')}
                  disabled={dispute.status === 'resolved' || dispute.status === 'closed'}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Process Refund
                </Button>
                {dispute.status !== 'closed' && (
                  <Button
                    variant="default"
                    onClick={() => handleAction('close')}
                    className="md:col-span-2"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Close Dispute
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'assign' && 'Assign Mediator'}
              {actionType === 'status' && 'Update Status'}
              {actionType === 'decision' && 'Make Decision'}
              {actionType === 'refund' && 'Process Refund'}
              {actionType === 'close' && 'Close Dispute'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'close' && 'This will permanently close the dispute.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {actionType === 'assign' && (
              <div>
                <Label>Mediator Admin ID</Label>
                <Input
                  value={formData.mediator_id}
                  onChange={(e) => setFormData({ ...formData, mediator_id: e.target.value })}
                  placeholder="Enter admin user ID"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Note: Mediator lookup will be implemented
                </p>
              </div>
            )}

            {actionType === 'status' && (
              <>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="appealed">Appealed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {actionType === 'decision' && (
              <div>
                <Label>Resolution Decision</Label>
                <Textarea
                  value={formData.resolution}
                  onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                  placeholder="Enter the resolution decision and reasoning..."
                  rows={6}
                />
              </div>
            )}

            {actionType === 'refund' && (
              <div>
                <Label>Refund Amount (KES)</Label>
                <Input
                  type="number"
                  value={formData.refund_amount}
                  onChange={(e) => setFormData({ ...formData, refund_amount: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum: KES {dispute.amount_disputed?.toLocaleString() || '0'}
                </p>
              </div>
            )}

            {(actionType === 'assign' || actionType === 'status' || actionType === 'decision' || actionType === 'refund') && (
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes about this action..."
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              variant={actionType === 'close' ? 'destructive' : 'default'}
            >
              {actionType === 'close' && 'Close Dispute'}
              {actionType === 'assign' && 'Assign Mediator'}
              {actionType === 'status' && 'Update Status'}
              {actionType === 'decision' && 'Make Decision'}
              {actionType === 'refund' && 'Process Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

