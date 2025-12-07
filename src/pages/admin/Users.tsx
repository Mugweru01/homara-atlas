import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { logger } from '@/lib/production-logger';
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
  ShieldCheck, 
  ShieldOff, 
  Users as UsersIcon, 
  Filter, 
  Download, 
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Mail,
  Calendar,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
  Clock,
  Home,
  Link as LinkIcon,
  Activity,
  FileText,
  ExternalLink,
  Tag,
  Save,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContactActivityTimeline } from '@/components/crm/ContactActivityTimeline';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions } from '@/hooks/usePermissions';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_verified: boolean;
  created_at: string;
}

export default function AdminUsers() {
  const { isSuperAdmin, isSeniorAdmin } = useAdmin();
  const permissions = usePermissions();
  const isJuniorAdmin = !isSuperAdmin && !isSeniorAdmin;
  
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [userTags, setUserTags] = useState<Record<string, any[]>>({});
  const [registrationDateFrom, setRegistrationDateFrom] = useState<string>('');
  const [registrationDateTo, setRegistrationDateTo] = useState<string>('');
  const [lastActivityFrom, setLastActivityFrom] = useState<string>('');
  const [lastActivityTo, setLastActivityTo] = useState<string>('');
  const [savedFilters, setSavedFilters] = useState<any[]>([]);
  const [saveFilterDialogOpen, setSaveFilterDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagAssignmentDialogOpen, setTagAssignmentDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  
  // CRM states
  const [crmContact, setCrmContact] = useState<any>(null);
  const [crmLoading, setCrmLoading] = useState(false);
  
  // Form states
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    role: 'customer',
  });

  useEffect(() => {
    fetchUsers();
    fetchTags();
    fetchSavedFilters();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      fetchUserTags();
    }
  }, [users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_verified, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      logger.error('Error fetching users', { error });
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_tags' as any).catch(() => ({ data: [], error: null }));

      if (error && error.code !== '42883') {
        logger.error('Error fetching tags', { error });
      }

      setAvailableTags(data || []);
    } catch (error) {
      logger.error('Error fetching tags', { error });
    }
  };

  const fetchSavedFilters = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_saved_filters', { p_page_type: 'users' })
        .catch(() => ({ data: [], error: null }));

      if (error && error.code !== '42883') {
        logger.error('Error fetching saved filters:', error);
      }

      setSavedFilters(data || []);
    } catch (error) {
      logger.error('Error fetching saved filters:', error);
    }
  };

  const applySavedFilter = (filter: any) => {
    const criteria = filter.filter_criteria || {};
    setSearch(criteria.search || '');
    setRoleFilter(criteria.role || 'all');
    setStatusFilter(criteria.status || 'all');
    setTagFilter(criteria.tag || 'all');
    setRegistrationDateFrom(criteria.registrationDateFrom || '');
    setRegistrationDateTo(criteria.registrationDateTo || '');
    setLastActivityFrom(criteria.lastActivityFrom || '');
    setLastActivityTo(criteria.lastActivityTo || '');

    // Track usage
    supabase.rpc('track_filter_usage', { p_filter_id: filter.id }).catch(() => {});
    toast.success(`Applied filter: ${filter.filter_name}`);
  };

  const saveCurrentFilter = async () => {
    if (!filterName.trim()) {
      toast.error('Filter name is required');
      return;
    }

    try {
      const criteria = {
        search,
        role: roleFilter,
        status: statusFilter,
        tag: tagFilter,
        registrationDateFrom,
        registrationDateTo,
        lastActivityFrom,
        lastActivityTo,
      };

      const { data, error } = await supabase
        .rpc('save_filter', {
          p_filter_name: filterName.trim(),
          p_page_type: 'users',
          p_filter_criteria: criteria,
          p_filter_description: filterDescription || null,
          p_is_public: false,
          p_is_default: false,
        })
        .catch(() => ({ data: null, error: null }));

      if (error) {
        throw error;
      }

      toast.success('Filter saved successfully');
      setSaveFilterDialogOpen(false);
      setFilterName('');
      setFilterDescription('');
      fetchSavedFilters();
    } catch (error: any) {
      logger.error('Error saving filter:', error);
      toast.error(error.message || 'Failed to save filter');
    }
  };

  const fetchUserTags = async () => {
    try {
      const userIds = users.map(u => u.id);
      if (userIds.length === 0) return;

      // Fetch CRM contacts for users
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, user_id')
        .in('user_id', userIds)
        .catch(() => ({ data: [] }));

      if (!contacts || contacts.length === 0) {
        setUserTags({});
        return;
      }

      const contactIds = contacts.map(c => c.id);
      const contactToUser = Object.fromEntries(
        contacts.map(c => [c.id, c.user_id])
      );

      // Fetch tag assignments
      const { data: tagAssignments } = await supabase
        .from('crm_contact_tag_assignments')
        .select(`
          contact_id,
          tag_id,
          tags:crm_contact_tags(id, name, color, category)
        `)
        .in('contact_id', contactIds)
        .catch(() => ({ data: [] }));

      // Build user tags map
      const tagsMap: Record<string, any[]> = {};
      (tagAssignments || []).forEach((assignment: any) => {
        const userId = contactToUser[assignment.contact_id];
        if (userId) {
          if (!tagsMap[userId]) {
            tagsMap[userId] = [];
          }
          tagsMap[userId].push(assignment.tags);
        }
      });

      setUserTags(tagsMap);
    } catch (error) {
      logger.error('Error fetching user tags', { error });
    }
  };

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast.success(
        currentStatus ? 'User verification removed' : 'User verified successfully',
        {
          description: currentStatus ? 'The user is no longer verified' : 'User can now access verified features',
        }
      );
      fetchUsers();
    } catch (error) {
      logger.error('Error updating user verification', { error, userId });
      toast.error('Failed to update user');
    }
  };

  const openViewDialog = async (user: Profile) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
    await fetchCrmContact(user.id);
  };

  const fetchCrmContact = async (userId: string) => {
    setCrmLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('user_id', userId)
        .single()
        .catch(() => ({ data: null, error: null }));

      if (error && error.code !== 'PGRST116') {
        logger.error('Error fetching CRM contact:', error);
      }

      setCrmContact(data);
    } catch (error) {
      logger.error('Error fetching CRM contact:', error);
    } finally {
      setCrmLoading(false);
    }
  };

  const createOrLinkCrmContact = async () => {
    if (!selectedUser) return;

    try {
      // Check if contact already exists
      const { data: existing } = await supabase
        .from('crm_contacts')
        .select('id')
        .eq('user_id', selectedUser.id)
        .single()
        .catch(() => ({ data: null }));

      if (existing) {
        toast.success('CRM contact already linked');
        await fetchCrmContact(selectedUser.id);
        return;
      }

      // Create new CRM contact linked to user
      const nameParts = (selectedUser.full_name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data, error } = await supabase
        .from('crm_contacts')
        .insert({
          user_id: selectedUser.id,
          first_name: firstName,
          last_name: lastName,
          email: selectedUser.email,
          contact_type: 'user',
          source: 'admin_panel',
        })
        .select()
        .single()
        .catch(() => ({ data: null, error: null }));

      if (error && error.code !== '42P01') {
        throw error;
      }

      if (data) {
        toast.success('CRM contact created and linked');
        await fetchCrmContact(selectedUser.id);
      }
    } catch (error: any) {
      logger.error('Error creating CRM contact:', error);
      toast.error('Failed to create CRM contact');
    }
  };

  const openEditDialog = (user: Profile) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'customer',
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (user: Profile) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          role: editForm.role,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('User updated successfully');
      setEditDialogOpen(false);
      fetchUsers();
    } catch (error) {
      logger.error('Error updating user', { error });
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('User deleted successfully', {
        description: 'All user data has been permanently removed',
      });
      setDeleteDialogOpen(false);
      fetchUsers();
    } catch (error) {
      logger.error('Error deleting user', { error });
      toast.error('Failed to delete user');
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleBulkAction = async (action: 'verify' | 'unverify' | 'delete' | 'assign_tag') => {
    if (selectedUsers.length === 0) {
      toast.error('No users selected');
      return;
    }

    if (action === 'assign_tag') {
      setTagAssignmentDialogOpen(true);
      return;
    }

    try {
      if (action === 'delete') {
        if (isJuniorAdmin) {
          toast.error('You do not have permission to delete users');
          return;
        }
        const { error } = await supabase
          .from('profiles')
          .delete()
          .in('id', selectedUsers);

        if (error) throw error;
        toast.success(`${selectedUsers.length} users deleted successfully`);
      } else if (action === 'verify' || action === 'unverify') {
        const { error } = await supabase
          .from('profiles')
          .update({ is_verified: action === 'verify' })
          .in('id', selectedUsers);

        if (error) throw error;
        toast.success(`${selectedUsers.length} users ${action === 'verify' ? 'verified' : 'unverified'}`);
      }

      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      logger.error('Error performing bulk action', { error, action });
      toast.error('Failed to perform bulk action');
    }
  };

  const handleBulkTagAssignment = async (tagId: string) => {
    if (selectedUsers.length === 0 || !tagId) return;

    try {
      // Get or create CRM contacts for selected users
      const contacts: any[] = [];
      for (const userId of selectedUsers) {
        let contact = await supabase
          .from('crm_contacts')
          .select('id')
          .eq('user_id', userId)
          .single()
          .catch(() => ({ data: null }));

        if (!contact.data) {
          // Create contact
          const nameParts = (users.find(u => u.id === userId)?.full_name || '').split(' ');
          const newContact = await supabase
            .from('crm_contacts')
            .insert({
              user_id: userId,
              first_name: nameParts[0] || '',
              last_name: nameParts.slice(1).join(' ') || '',
              email: users.find(u => u.id === userId)?.email || null,
              contact_type: 'user',
              source: 'admin_panel',
            })
            .select('id')
            .single()
            .catch(() => ({ data: null }));

          if (newContact.data) {
            contacts.push(newContact.data.id);
          }
        } else {
          contacts.push(contact.data.id);
        }
      }

      // Assign tag to all contacts
      let successCount = 0;
      for (const contactId of contacts) {
        const { error } = await supabase.rpc('assign_tag_to_contact' as any, {
          p_contact_id: contactId,
          p_tag_id: tagId,
        }).catch(() => ({ error: null }));

        if (!error) successCount++;
      }

      toast.success(`Tag assigned to ${successCount} users`);
      setTagAssignmentDialogOpen(false);
      setSelectedUsers([]);
      fetchUsers();
      fetchUserTags();
    } catch (error) {
      logger.error('Error assigning tags', { error });
      toast.error('Failed to assign tags');
    }
  };

  const exportUsers = () => {
    const csv = [
      ['Name', 'Email', 'Role', 'Verified', 'Joined'].join(','),
      ...filteredUsers.map(user => [
        user.full_name || 'N/A',
        user.email || 'N/A',
        user.role || 'customer',
        user.is_verified ? 'Yes' : 'No',
        new Date(user.created_at).toLocaleString(),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Users exported successfully');
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !search ||
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'verified' && user.is_verified) ||
      (statusFilter === 'unverified' && !user.is_verified);

    const matchesTag = tagFilter === 'all' || 
      (userTags[user.id] && userTags[user.id].some((tag: any) => tag.id === tagFilter));

    const matchesRegistrationDate = 
      (!registrationDateFrom || new Date(user.created_at) >= new Date(registrationDateFrom)) &&
      (!registrationDateTo || new Date(user.created_at) <= new Date(registrationDateTo + 'T23:59:59'));

    return matchesSearch && matchesRole && matchesStatus && matchesTag && matchesRegistrationDate;
  });

  const getStats = () => {
    return {
      total: users.length,
      verified: users.filter(u => u.is_verified).length,
      landlords: users.filter(u => u.role === 'landlord').length,
      customers: users.filter(u => u.role === 'customer').length,
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-muted/50 rounded-lg animate-shimmer"></div>
          <div className="h-5 w-64 bg-muted/30 rounded animate-shimmer"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted/20 rounded-xl animate-shimmer" style={{ animationDelay: `${i * 50}ms` }}></div>
          ))}
        </div>
        <Card className="border-border/50">
          <CardHeader>
            <div className="h-6 w-32 bg-muted/50 rounded animate-shimmer"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted/20 rounded animate-shimmer" style={{ animationDelay: `${i * 50}ms` }}></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 rounded-xl bg-info/10">
            <UsersIcon className="h-6 w-6 text-info" />
          </div>
          Users Management
        </h1>
        <p className="text-muted-foreground mt-1">
          View and manage all platform users • {filteredUsers.length} users shown
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
        {[
          { label: 'Total Users', value: stats.total, color: 'primary', icon: UsersIcon },
          { label: 'Verified', value: stats.verified, color: 'success', icon: UserCheck },
          { label: 'Landlords', value: stats.landlords, color: 'warning', icon: Home },
          { label: 'Customers', value: stats.customers, color: 'info', icon: UserCheck },
        ].map((stat, index) => (
          <Card key={stat.label} className="border-border/50 hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg bg-${stat.color}/10`}>
                  <stat.icon className={`h-5 w-5 text-${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk Actions Bar */}
      {selectedUsers.length > 0 && (
        <Card className="border-primary/50 shadow-glow animate-fade-up" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                <span className="text-primary font-bold">{selectedUsers.length}</span> user{selectedUsers.length > 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleBulkAction('verify')}
                  className="hover:bg-success/10 hover:text-success hover:border-success/50"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Verify All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleBulkAction('unverify')}
                  className="hover:bg-warning/10 hover:text-warning hover:border-warning/50"
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Unverify All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleBulkAction('assign_tag')}
                  className="hover:bg-primary/10 hover:text-primary hover:border-primary/50"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Assign Tag
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedUsers([])}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Card */}
      <Card className="border-border/50 shadow-soft animate-fade-up" style={{ animationDelay: '200ms' }}>
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-card/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">All Users</CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchUsers}
                className="hover:bg-accent hover:scale-105 transition-all duration-200"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Link to="/admin/users/analytics">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="hover:bg-accent hover:scale-105 transition-all duration-200"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportUsers}
                className="hover:bg-accent hover:scale-105 transition-all duration-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[150px] h-10">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="landlord">Landlord</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'verified' | 'unverified')}>
                <SelectTrigger className="w-[150px] h-10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-[180px] h-10">
                  <SelectValue placeholder="Tag Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {availableTags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: tag.color || '#3b82f6' }}
                        />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {savedFilters.length > 0 && (
                <Select onValueChange={(value) => {
                  const filter = savedFilters.find(f => f.id === value);
                  if (filter) applySavedFilter(filter);
                }}>
                  <SelectTrigger className="w-[180px] h-10">
                    <SelectValue placeholder="Saved Filters" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedFilters.map(filter => (
                      <SelectItem key={filter.id} value={filter.id}>
                        {filter.filter_name}
                        {filter.is_default && <span className="ml-2 text-xs text-muted-foreground">(Default)</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="h-10"
              >
                {showAdvancedFilters ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                Advanced
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSaveFilterDialogOpen(true)}
                className="h-10"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Filter
              </Button>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="p-4 bg-muted/30 rounded-lg space-y-3 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Date Filters</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRegistrationDateFrom('');
                      setRegistrationDateTo('');
                      setLastActivityFrom('');
                      setLastActivityTo('');
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Registration Date From</Label>
                    <Input
                      type="date"
                      value={registrationDateFrom}
                      onChange={(e) => setRegistrationDateFrom(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Registration Date To</Label>
                    <Input
                      type="date"
                      value={registrationDateTo}
                      onChange={(e) => setRegistrationDateTo(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last Activity From</Label>
                    <Input
                      type="date"
                      value={lastActivityFrom}
                      onChange={(e) => setLastActivityFrom(e.target.value)}
                      className="h-9"
                      disabled
                      title="Coming soon - requires activity tracking"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last Activity To</Label>
                    <Input
                      type="date"
                      value={lastActivityTo}
                      onChange={(e) => setLastActivityTo(e.target.value)}
                      className="h-9"
                      disabled
                      title="Coming soon - requires activity tracking"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">User</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Joined</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-full bg-muted/50">
                          <Search className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-lg">No users found</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Try adjusting your search or filters
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user, index) => (
                    <TableRow 
                      key={user.id} 
                      className="group hover:bg-accent/50 transition-all duration-200 border-b border-border/30 animate-fade-in"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleSelectUser(user.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-info/20 to-info/10 flex items-center justify-center text-sm font-semibold">
                            {user.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-medium group-hover:text-primary transition-colors">
                              {user.full_name || 'Unnamed User'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          {user.email || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant="outline" 
                            className={`capitalize font-medium w-fit ${
                              user.role === 'landlord' 
                                ? 'bg-warning/10 text-warning border-warning/20' 
                                : user.role === 'admin'
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-info/10 text-info border-info/20'
                            }`}
                          >
                            {user.role || 'customer'}
                          </Badge>
                          {userTags[user.id] && userTags[user.id].length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {userTags[user.id].slice(0, 2).map((tag: any) => (
                                <Badge
                                  key={tag.id}
                                  variant="outline"
                                  className="text-xs"
                                  style={{
                                    borderColor: tag.color || '#3b82f6',
                                    color: tag.color || '#3b82f6',
                                    backgroundColor: `${tag.color || '#3b82f6'}15`,
                                  }}
                                >
                                  {tag.name}
                                </Badge>
                              ))}
                              {userTags[user.id].length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{userTags[user.id].length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.is_verified ? (
                          <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 transition-colors font-medium">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground font-medium">
                            <Clock className="h-3 w-3 mr-1" />
                            Not Verified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(user.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                              className="hover:scale-110 transition-all duration-200"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => openViewDialog(user)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {!isJuniorAdmin && (
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => toggleVerification(user.id, user.is_verified)}>
                          {user.is_verified ? (
                                <>
                                  <ShieldOff className="h-4 w-4 mr-2" />
                                  Remove Verification
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="h-4 w-4 mr-2" />
                                  Verify User
                                </>
                              )}
                            </DropdownMenuItem>
                            {!isJuniorAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => openDeleteDialog(user)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer Info */}
          {filteredUsers.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Showing <span className="font-medium text-foreground">{filteredUsers.length}</span> of <span className="font-medium text-foreground">{users.length}</span> users
              </p>
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse"></span>
                Last updated: just now
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View User Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[85vh] animate-scale-in">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-info/10">
                <Eye className="h-5 w-5 text-info" />
              </div>
              <div>
                <DialogTitle className="text-xl">User Details</DialogTitle>
                <DialogDescription>
                  Complete information about this user
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedUser && (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="crm">CRM</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-4">
                <ScrollArea className="max-h-[50vh] pr-4">
                  <div className="space-y-6">
                    {/* User Profile */}
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <UsersIcon className="h-4 w-4 text-primary" />
                        Profile Information
                      </h3>
                      <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                          <p className="font-medium">{selectedUser.full_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Email</p>
                          <p className="font-medium text-sm">{selectedUser.email || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Role</p>
                          <Badge variant="outline" className="capitalize">
                            {selectedUser.role || 'customer'}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">User ID</p>
                          <p className="font-mono text-xs">{selectedUser.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Verification Status */}
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-success" />
                        Verification Status
                      </h3>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Verification Status</p>
                        {selectedUser.is_verified ? (
                          <Badge className="bg-success text-success-foreground">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            Not Verified
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Timeline */}
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Account Timeline
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary"></div>
                          <span className="text-muted-foreground">Joined:</span>
                          <span className="font-medium">
                            {new Date(selectedUser.created_at).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="crm" className="mt-4">
                <ScrollArea className="max-h-[50vh] pr-4">
                  <div className="space-y-4">
                    {crmLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : crmContact ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                          <div>
                            <h3 className="font-semibold flex items-center gap-2">
                              <LinkIcon className="h-4 w-4 text-primary" />
                              CRM Contact Linked
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Contact ID: {crmContact.id.slice(0, 8)}...
                            </p>
                          </div>
                          <Link to={`/crm/contacts/${crmContact.id}`}>
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View in CRM
                            </Button>
                          </Link>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-2">Contact Type</p>
                          <Badge variant="outline" className="capitalize">
                            {crmContact.contact_type || 'user'}
                          </Badge>
                        </div>
                        {crmContact.notes && (
                          <div className="p-4 bg-muted/30 rounded-lg">
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Notes
                            </h4>
                            <p className="text-sm whitespace-pre-wrap">{crmContact.notes}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                          <LinkIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="font-medium mb-2">No CRM Contact Linked</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Create a CRM contact to track activities and notes
                        </p>
                        <Button onClick={createOrLinkCrmContact}>
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Create & Link CRM Contact
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <ScrollArea className="max-h-[50vh] pr-4">
                  {crmContact ? (
                    <ContactActivityTimeline contactId={crmContact.id} />
                  ) : (
                    <div className="text-center py-8">
                      <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                        <Activity className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="font-medium mb-2">No Activity Timeline</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Link a CRM contact to view activity timeline
                      </p>
                      <Button onClick={createOrLinkCrmContact} variant="outline">
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Create CRM Contact
                      </Button>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            {selectedUser && (
              <Button onClick={() => {
                setViewDialogOpen(false);
                openEditDialog(selectedUser);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] animate-scale-in">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Edit className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Edit User</DialogTitle>
                <DialogDescription>
                  Update user information and permissions
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                placeholder="Enter full name"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="Enter email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editForm.role} onValueChange={(value) => setEditForm({ ...editForm, role: value })}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="landlord">Landlord</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Filter Dialog */}
      <Dialog open={saveFilterDialogOpen} onOpenChange={setSaveFilterDialogOpen}>
        <DialogContent className="sm:max-w-[500px] animate-scale-in">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Save className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Save Filter Preset</DialogTitle>
                <DialogDescription>
                  Save your current filter settings for quick access
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Filter Name *</Label>
              <Input
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="e.g., Verified Landlords"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={filterDescription}
                onChange={(e) => setFilterDescription(e.target.value)}
                placeholder="Describe what this filter is for..."
                rows={3}
              />
            </div>
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Current Filter Settings:</p>
              <div className="space-y-1 text-sm">
                {search && <p>• Search: {search}</p>}
                {roleFilter !== 'all' && <p>• Role: {roleFilter}</p>}
                {statusFilter !== 'all' && <p>• Status: {statusFilter}</p>}
                {tagFilter !== 'all' && <p>• Tag: {availableTags.find(t => t.id === tagFilter)?.name}</p>}
                {(registrationDateFrom || registrationDateTo) && (
                  <p>• Registration: {registrationDateFrom || '...'} to {registrationDateTo || '...'}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSaveFilterDialogOpen(false);
              setFilterName('');
              setFilterDescription('');
            }}>
              Cancel
            </Button>
            <Button onClick={saveCurrentFilter}>
              <Save className="h-4 w-4 mr-2" />
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Assignment Dialog */}
      <Dialog open={tagAssignmentDialogOpen} onOpenChange={setTagAssignmentDialogOpen}>
        <DialogContent className="sm:max-w-[500px] animate-scale-in">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Assign Tag to Users</DialogTitle>
                <DialogDescription>
                  Assign a tag to {selectedUsers.length} selected user{selectedUsers.length !== 1 ? 's' : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Tag</Label>
              <Select onValueChange={handleBulkTagAssignment}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Choose a tag..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTags.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No tags available. Create tags in CRM first.
                    </div>
                  ) : (
                    availableTags.map(tag => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: tag.color || '#3b82f6' }}
                          />
                          <span>{tag.name}</span>
                          {tag.category && (
                            <span className="text-xs text-muted-foreground">({tag.category})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Note: Tags will be assigned via CRM contacts. If a user doesn't have a CRM contact, one will be created automatically.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTagAssignmentDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px] animate-scale-in">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogTitle className="text-xl">Delete User</DialogTitle>
                <DialogDescription>
                  This action cannot be undone
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm text-destructive">
                Are you sure you want to permanently delete{' '}
                <span className="font-semibold">{selectedUser?.full_name || selectedUser?.email}</span>?
                This will remove all their data and cannot be recovered.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
