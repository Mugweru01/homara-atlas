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
  Home
} from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_verified: boolean;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  
  // Form states
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    role: 'customer',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_verified, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
      toast.success('Users loaded successfully');
    } catch (error) {
      logger.error('Error fetching users', { error });
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
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

  const openViewDialog = (user: Profile) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
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

  const handleBulkAction = async (action: 'verify' | 'unverify' | 'delete') => {
    if (selectedUsers.length === 0) {
      toast.error('No users selected');
      return;
    }

    try {
      if (action === 'delete') {
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

    return matchesSearch && matchesRole && matchesStatus;
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
          <div className="flex flex-wrap gap-3 mb-6">
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
                        <Badge 
                          variant="outline" 
                          className={`capitalize font-medium ${
                            user.role === 'landlord' 
                              ? 'bg-warning/10 text-warning border-warning/20' 
                              : user.role === 'admin'
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-info/10 text-info border-info/20'
                          }`}
                        >
                          {user.role || 'customer'}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
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
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => openDeleteDialog(user)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
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
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] animate-scale-in">
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
            <ScrollArea className="max-h-[60vh] pr-4">
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
