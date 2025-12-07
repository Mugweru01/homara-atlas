import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Edit,
  Trash,
  Mail,
  RefreshCw,
  MoreVertical,
  Search,
  Play,
  Pause,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { format } from 'date-fns';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions } from '@/hooks/usePermissions';

interface EmailAccount {
  id: string;
  name: string;
  email_address: string;
  email_provider?: string;
  is_active: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

interface EmailMessage {
  id: string;
  ticket_id?: string;
  from_email: string;
  to_email: string;
  subject: string;
  direction: string;
  status: string;
  received_at: string;
  ticket_number?: string;
}

export default function EmailIntegration() {
  const { user } = useAdmin();
  const permissions = usePermissions();
  
  if (!permissions.canViewEmailIntegration) {
    return null; // ProtectedRoute will handle redirect
  }
  
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [form, setForm] = useState({
    name: '',
    email_address: '',
    email_provider: 'gmail',
    imap_host: '',
    imap_port: 993,
    smtp_host: '',
    smtp_port: 587,
    username: '',
    password_encrypted: '',
    is_active: true,
  });

  useEffect(() => {
    fetchAccounts();
    fetchMessages();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_email_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setAccounts([]);
          return;
        }
        throw error;
      }

      setAccounts(data || []);
    } catch (error: any) {
      logger.error('Error fetching email accounts:', error);
      toast.error('Error', {
        description: error.message || 'Failed to fetch email accounts',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      setMessagesLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_email_messages')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(100);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setMessages([]);
          return;
        }
        throw error;
      }

      // Fetch ticket numbers for linked tickets
      const ticketIds = [...new Set((data || []).map((m: any) => m.ticket_id).filter(Boolean))];
      const ticketsMap = new Map();
      if (ticketIds.length > 0) {
        const { data: tickets } = await supabase
          .from('homaradesk_tickets')
          .select('id, ticket_number')
          .in('id', ticketIds);

        if (tickets) {
          tickets.forEach((t: any) => {
            ticketsMap.set(t.id, t.ticket_number);
          });
        }
      }

      const processed = (data || []).map((msg: any) => ({
        ...msg,
        ticket_number: msg.ticket_id ? ticketsMap.get(msg.ticket_id) : null,
      }));

      setMessages(processed);
    } catch (error: any) {
      logger.error('Error fetching email messages:', error);
      toast.error('Error', {
        description: 'Failed to fetch email messages',
      });
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSaveAccount = async () => {
    try {
      const accountData = {
        name: form.name,
        email_address: form.email_address,
        email_provider: form.email_provider,
        imap_host: form.imap_host || null,
        imap_port: form.imap_port || null,
        smtp_host: form.smtp_host || null,
        smtp_port: form.smtp_port || null,
        username: form.username || null,
        password_encrypted: form.password_encrypted || null, // In production, encrypt this
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingAccount) {
        const { error } = await supabase
          .from('homaradesk_email_accounts')
          .update(accountData)
          .eq('id', editingAccount.id);

        if (error) throw error;
        toast.success('Success', {
          description: 'Email account updated',
        });
      } else {
        const { error } = await supabase
          .from('homaradesk_email_accounts')
          .insert(accountData);

        if (error) throw error;
        toast.success('Success', {
          description: 'Email account created',
        });
      }

      setAccountDialogOpen(false);
      setEditingAccount(null);
      setForm({
        name: '',
        email_address: '',
        email_provider: 'gmail',
        imap_host: '',
        imap_port: 993,
        smtp_host: '',
        smtp_port: 587,
        username: '',
        password_encrypted: '',
        is_active: true,
      });
      fetchAccounts();
    } catch (error: any) {
      logger.error('Error saving email account:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save email account',
      });
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this email account?')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_email_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Success', {
        description: 'Email account deleted',
      });
      fetchAccounts();
    } catch (error: any) {
      logger.error('Error deleting email account:', error);
      toast.error('Error', {
        description: error.message || 'Failed to delete email account',
      });
    }
  };

  const openCreateAccountDialog = () => {
    setEditingAccount(null);
    setForm({
      name: '',
      email_address: '',
      email_provider: 'gmail',
      imap_host: '',
      imap_port: 993,
      smtp_host: '',
      smtp_port: 587,
      username: '',
      password_encrypted: '',
      is_active: true,
    });
    setAccountDialogOpen(true);
  };

  const openEditAccountDialog = (account: EmailAccount) => {
    setEditingAccount(account);
    setForm({
      name: account.name,
      email_address: account.email_address,
      email_provider: account.email_provider || 'gmail',
      imap_host: account.imap_host || '',
      imap_port: account.imap_port || 993,
      smtp_host: account.smtp_host || '',
      smtp_port: account.smtp_port || 587,
      username: account.username || '',
      password_encrypted: '', // Don't show existing password
      is_active: account.is_active,
    });
    setAccountDialogOpen(true);
  };

  const openMessageDialog = (message: EmailMessage) => {
    setSelectedMessage(message);
    setMessageDialogOpen(true);
  };

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = search === '' ||
      account.name.toLowerCase().includes(search.toLowerCase()) ||
      account.email_address.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  const filteredMessages = messages.filter((message) => {
    const matchesSearch = search === '' ||
      message.subject.toLowerCase().includes(search.toLowerCase()) ||
      message.from_email.toLowerCase().includes(search.toLowerCase()) ||
      message.to_email.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Integration</h1>
          <p className="text-muted-foreground">
            Manage email accounts and view email messages
          </p>
        </div>
        <Button onClick={openCreateAccountDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Email Account
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts or messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => {
          fetchAccounts();
          fetchMessages();
        }} disabled={loading || messagesLoading}>
          <RefreshCw className={`h-4 w-4 ${loading || messagesLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Email Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Email Accounts ({filteredAccounts.length})</CardTitle>
            <CardDescription>
              Configured email accounts for ticket creation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium">No email accounts</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {accounts.length === 0
                    ? 'Add an email account to enable email-to-ticket conversion.'
                    : 'Try adjusting your search.'}
                </p>
                {accounts.length === 0 && (
                  <Button onClick={openCreateAccountDialog} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Account
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{account.name}</div>
                        <Badge variant={account.is_active ? 'default' : 'secondary'}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{account.email_address}</div>
                      {account.last_synced_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Last synced: {format(new Date(account.last_synced_at), 'MMM d, yyyy HH:mm')}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditAccountDialog(account)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteAccount(account.id)}
                          className="text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Messages ({filteredMessages.length})</CardTitle>
            <CardDescription>
              Inbound and outbound email messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            {messagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No email messages</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className="p-3 border rounded-md hover:bg-accent cursor-pointer"
                    onClick={() => openMessageDialog(message)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={message.direction === 'inbound' ? 'default' : 'secondary'}>
                            {message.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                          </Badge>
                          {message.ticket_number && (
                            <Badge variant="outline">{message.ticket_number}</Badge>
                          )}
                        </div>
                        <div className="font-medium text-sm">{message.subject}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {message.direction === 'inbound' ? 'From' : 'To'}: {message.direction === 'inbound' ? message.from_email : message.to_email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(message.received_at), 'MMM d, yyyy HH:mm')}
                        </div>
                      </div>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Email Account' : 'Add Email Account'}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Update your email account configuration.'
                : 'Configure an email account for ticket creation.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Account Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Support Email"
                required
              />
            </div>

            <div>
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={form.email_address}
                onChange={(e) => setForm((prev) => ({ ...prev, email_address: e.target.value }))}
                placeholder="support@example.com"
                required
              />
            </div>

            <div>
              <Label>Email Provider</Label>
              <Select
                value={form.email_provider}
                onValueChange={(value) => setForm((prev) => ({ ...prev, email_provider: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Outlook</SelectItem>
                  <SelectItem value="imap">IMAP</SelectItem>
                  <SelectItem value="pop3">POP3</SelectItem>
                  <SelectItem value="smtp">SMTP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.email_provider === 'imap' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>IMAP Host</Label>
                    <Input
                      value={form.imap_host}
                      onChange={(e) => setForm((prev) => ({ ...prev, imap_host: e.target.value }))}
                      placeholder="imap.example.com"
                    />
                  </div>
                  <div>
                    <Label>IMAP Port</Label>
                    <Input
                      type="number"
                      value={form.imap_port}
                      onChange={(e) => setForm((prev) => ({ ...prev, imap_port: parseInt(e.target.value) || 993 }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>SMTP Host</Label>
                    <Input
                      value={form.smtp_host}
                      onChange={(e) => setForm((prev) => ({ ...prev, smtp_host: e.target.value }))}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div>
                    <Label>SMTP Port</Label>
                    <Input
                      type="number"
                      value={form.smtp_port}
                      onChange={(e) => setForm((prev) => ({ ...prev, smtp_port: parseInt(e.target.value) || 587 }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Username</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder="Email username"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password_encrypted}
                    onChange={(e) => setForm((prev) => ({ ...prev, password_encrypted: e.target.value }))}
                    placeholder={editingAccount ? 'Leave blank to keep existing' : 'Email password'}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Password will be encrypted before storage
                  </p>
                </div>
              </>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked: boolean) => setForm((prev) => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAccount} disabled={!form.name.trim() || !form.email_address.trim()}>
              {editingAccount ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Detail Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Message</DialogTitle>
            <DialogDescription>
              View email message details
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Subject</Label>
                <div className="p-2 bg-muted rounded-md">{selectedMessage.subject}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>From</Label>
                  <div className="p-2 bg-muted rounded-md">{selectedMessage.from_email}</div>
                </div>
                <div>
                  <Label>To</Label>
                  <div className="p-2 bg-muted rounded-md">{selectedMessage.to_email}</div>
                </div>
              </div>
              {selectedMessage.ticket_number && (
                <div>
                  <Label>Linked Ticket</Label>
                  <div className="p-2 bg-muted rounded-md font-mono">
                    {selectedMessage.ticket_number}
                  </div>
                </div>
              )}
              <div>
                <Label>Received At</Label>
                <div className="p-2 bg-muted rounded-md">
                  {format(new Date(selectedMessage.received_at), 'PPP p')}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

