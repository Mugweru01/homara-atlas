import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  Eye,
  Edit,
  Archive,
  MoreVertical,
  UserPlus,
  Mail,
  Phone,
  Building,
  Tag,
  Calendar,
  CheckSquare,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { ExportButton } from '@/components/admin/ExportButton';
import { formatDateForExport, formatArrayForExport, type ExportColumn } from '@/lib/export-utils';

interface CRMContact {
  id: string;
  user_id: string | null;
  contact_type: 'user' | 'lead' | 'prospect' | 'customer';
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: 'active' | 'inactive' | 'archived' | 'duplicate';
  source: string | null;
  assigned_to: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export default function Contacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null);
  
  // Form states
  const [createForm, setCreateForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    contact_type: 'prospect' as const,
    source: '',
  });

  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    contact_type: 'prospect' as const,
    status: 'active' as const,
    source: '',
  });

  useEffect(() => {
    fetchContacts();
    fetchAllTags();
  }, [search, statusFilter, typeFilter, tagFilter, page]);

  const fetchAllTags = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_tags' as any);
      if (error) throw error;
      setAllTags((data as any) || []);
    } catch (error: any) {
      logger.error('Error fetching tags', { error });
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_contacts' as any, {
        p_search: search || null,
        p_status: statusFilter === 'all' ? null : statusFilter,
        p_contact_type: typeFilter === 'all' ? null : typeFilter,
        p_assigned_to: null,
        p_tags: tagFilter.length > 0 ? tagFilter : null,
        p_source: null,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });

      if (error) throw error;

      if (data && Array.isArray(data) && data.length > 0) {
        setContacts(data as CRMContact[]);
        setTotalCount((data[0] as any)?.total_count || 0);
      } else {
        setContacts([]);
        setTotalCount(0);
      }
    } catch (error: any) {
      logger.error('Error fetching contacts', { error });
      toast.error('Failed to load contacts');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContact = async () => {
    try {
      const { data, error } = await supabase.rpc('create_contact' as any, {
        p_first_name: createForm.first_name || null,
        p_last_name: createForm.last_name || null,
        p_email: createForm.email || null,
        p_phone: createForm.phone || null,
        p_company_name: createForm.company_name || null,
        p_contact_type: createForm.contact_type,
        p_source: createForm.source || null,
        p_notes: null,
        p_custom_fields: null,
        p_tags: null,
      });

      if (error) throw error;

      toast.success('Contact created successfully');
      setCreateDialogOpen(false);
      setCreateForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company_name: '',
        contact_type: 'prospect',
        source: '',
      });
      fetchContacts();
      
      // Navigate to contact detail if created
      if (data) {
        navigate(`/crm/contacts/${data}`);
      }
    } catch (error: any) {
      logger.error('Error creating contact', { error });
      toast.error(error?.message || 'Failed to create contact');
    }
  };

  const handleUpdateContact = async () => {
    if (!selectedContact) return;

    try {
      const { error } = await supabase.rpc('update_contact' as any, {
        p_contact_id: selectedContact.id,
        p_first_name: editForm.first_name || null,
        p_last_name: editForm.last_name || null,
        p_email: editForm.email || null,
        p_phone: editForm.phone || null,
        p_company_name: editForm.company_name || null,
        p_contact_type: editForm.contact_type,
        p_status: editForm.status,
        p_source: editForm.source || null,
        p_notes: null,
        p_custom_fields: null,
      });

      if (error) throw error;

      toast.success('Contact updated successfully');
      setEditDialogOpen(false);
      setSelectedContact(null);
      fetchContacts();
    } catch (error: any) {
      logger.error('Error updating contact', { error });
      toast.error(error?.message || 'Failed to update contact');
    }
  };

  const handleArchiveContact = async () => {
    if (!selectedContact) return;

    try {
      const { error } = await supabase.rpc('archive_contact' as any, {
        p_contact_id: selectedContact.id,
      });

      if (error) throw error;

      toast.success('Contact archived successfully');
      setArchiveDialogOpen(false);
      setSelectedContact(null);
      fetchContacts();
    } catch (error: any) {
      logger.error('Error archiving contact', { error });
      toast.error('Failed to archive contact');
    }
  };

  const handleBulkArchive = async () => {
    if (selectedContacts.length === 0) return;

    try {
      const promises = selectedContacts.map(contactId =>
        supabase.rpc('archive_contact' as any, {
          p_contact_id: contactId,
        })
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        toast.error(`Failed to archive ${errors.length} contact(s)`);
      } else {
        toast.success(`Archived ${selectedContacts.length} contact(s) successfully`);
      }

      setSelectedContacts([]);
      fetchContacts();
    } catch (error: any) {
      logger.error('Error bulk archiving contacts', { error });
      toast.error('Failed to archive contacts');
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedContacts.length === 0) return;

    try {
      const promises = selectedContacts.map(contactId =>
        supabase.rpc('update_contact' as any, {
          p_contact_id: contactId,
          p_status: newStatus,
        })
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        toast.error(`Failed to update ${errors.length} contact(s)`);
      } else {
        toast.success(`Updated ${selectedContacts.length} contact(s) successfully`);
      }

      setSelectedContacts([]);
      fetchContacts();
    } catch (error: any) {
      logger.error('Error bulk updating contacts', { error });
      toast.error('Failed to update contacts');
    }
  };

  const handleToggleSelectContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'archived':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'customer':
        return 'default';
      case 'lead':
        return 'default';
      case 'user':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const exportColumns: ExportColumn[] = [
    { key: 'full_name', label: 'Full Name' },
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'company_name', label: 'Company' },
    { key: 'contact_type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
    { key: 'tags', label: 'Tags', format: formatArrayForExport },
    { key: 'created_at', label: 'Created At', format: formatDateForExport },
    { key: 'updated_at', label: 'Updated At', format: formatDateForExport },
  ];

  const exportFilterCriteria = {
    search,
    status: statusFilter,
    type: typeFilter,
    tags: tagFilter,
  };

  const filteredContacts = contacts.filter((contact) => {
    if (statusFilter !== 'all' && contact.status !== statusFilter) return false;
    if (typeFilter !== 'all' && contact.contact_type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM Contacts</h1>
          <p className="text-muted-foreground">
            Manage all your contacts, leads, and prospects in one place
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchContacts}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
          {allTags.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm font-medium mb-2 block">Filter by Tags</Label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const isSelected = tagFilter.includes(tag.name);
                  return (
                    <Badge
                      key={tag.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className="cursor-pointer hover:opacity-80"
                      style={
                        isSelected
                          ? { backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color }
                          : {}
                      }
                      onClick={() => {
                        if (isSelected) {
                          setTagFilter(tagFilter.filter((t) => t !== tag.name));
                        } else {
                          setTagFilter([...tagFilter, tag.name]);
                        }
                      }}
                    >
                      <Tag className="mr-1 h-3 w-3" />
                      {tag.name}
                    </Badge>
                  );
                })}
                {tagFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTagFilter([])}
                    className="h-6 text-xs"
                  >
                    Clear tags
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Contacts ({totalCount.toLocaleString()})
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedContacts.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground">
                  {selectedContacts.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusUpdate('active')}
                >
                  Mark Active
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkStatusUpdate('inactive')}
                >
                  Mark Inactive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkArchive}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedContacts([])}
                >
                  Clear Selection
                </Button>
              </>
            )}
            <ExportButton
              data={filteredContacts}
              columns={exportColumns}
              filename="crm-contacts"
              pageType="crm-contacts"
              filterCriteria={exportFilterCriteria}
            />
          </div>
        </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No contacts found</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setCreateDialogOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create First Contact
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAll();
                        }}
                      >
                        {selectedContacts.length === filteredContacts.length && filteredContacts.length > 0 ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => {
                    const isSelected = selectedContacts.includes(contact.id);
                    return (
                      <TableRow
                        key={contact.id}
                        className={`hover:bg-muted/50 ${isSelected ? 'bg-muted' : ''}`}
                      >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleToggleSelectContact(contact.id)}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell 
                        className="font-medium cursor-pointer"
                        onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                      >
                        {contact.full_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {contact.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {contact.email}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {contact.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.company_name ? (
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {contact.company_name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTypeBadgeVariant(contact.contact_type)}>
                          {contact.contact_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(contact.status)}>
                          {contact.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {contact.source || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(contact.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedContact(contact);
                                setEditForm({
                                  first_name: contact.first_name || '',
                                  last_name: contact.last_name || '',
                                  email: contact.email || '',
                                  phone: contact.phone || '',
                                  company_name: contact.company_name || '',
                                  contact_type: contact.contact_type,
                                  status: contact.status,
                                  source: contact.source || '',
                                });
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {contact.status !== 'archived' && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedContact(contact);
                                  setArchiveDialogOpen(true);
                                }}
                                className="text-destructive"
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Contact Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Contact</DialogTitle>
            <DialogDescription>
              Add a new contact to your CRM database
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input
                  value={createForm.first_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, first_name: e.target.value })
                  }
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input
                  value={createForm.last_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, last_name: e.target.value })
                  }
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, phone: e.target.value })
                  }
                  placeholder="+254 700 000 000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name</label>
              <Input
                value={createForm.company_name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, company_name: e.target.value })
                }
                placeholder="Company Inc."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Type</label>
                <Select
                  value={createForm.contact_type}
                  onValueChange={(value: any) =>
                    setCreateForm({ ...createForm, contact_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Source</label>
                <Input
                  value={createForm.source}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, source: e.target.value })
                  }
                  placeholder="Website, Referral, etc."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateContact}>
              Create Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update contact information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  placeholder="+254 700 000 000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name</label>
              <Input
                value={editForm.company_name}
                onChange={(e) =>
                  setEditForm({ ...editForm, company_name: e.target.value })
                }
                placeholder="Company Inc."
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Type</label>
                <Select
                  value={editForm.contact_type}
                  onValueChange={(value: any) =>
                    setEditForm({ ...editForm, contact_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={editForm.status}
                  onValueChange={(value: any) =>
                    setEditForm({ ...editForm, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                    <SelectItem value="duplicate">Duplicate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Source</label>
                <Input
                  value={editForm.source}
                  onChange={(e) =>
                    setEditForm({ ...editForm, source: e.target.value })
                  }
                  placeholder="Website, Referral, etc."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false);
              setSelectedContact(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateContact}>
              Update Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Contact Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this contact? They will be moved to archived status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchiveContact}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

