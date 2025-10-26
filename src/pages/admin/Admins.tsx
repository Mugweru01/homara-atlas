import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  UserPlus, 
  Search, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Users,
  RefreshCw,
  Crown,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { useAdmin } from '@/hooks/useAdmin';

interface Admin {
  id: string;
  email: string;
  admin_role: string;
  status: string;
  created_at: string;
}

export default function AdminsManagement() {
  const { isSuperAdmin } = useAdmin();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    email: '',
    adminRole: 'junior_admin',
    adminCode: '',
  });

  useEffect(() => {
    if (isSuperAdmin) {
      fetchAdmins();
    }
  }, [isSuperAdmin]);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAdmins(data || []);
      toast.success('Admins loaded successfully');
    } catch (error) {
      logger.error('Error fetching admins', { error });
      toast.error('Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const createAdmin = async () => {
    try {
      // TODO: Implement admin creation via Edge Function
      // This should:
      // 1. Validate email and code
      // 2. Create user account
      // 3. Add admin record
      // 4. Send welcome email
      
      toast.info('Admin creation functionality coming soon');
      setIsCreateDialogOpen(false);
    } catch (error) {
      logger.error('Error creating admin', { error });
      toast.error('Failed to create admin');
    }
  };

  const updateAdminStatus = async (adminId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('admins')
        .update({ status: newStatus })
        .eq('id', adminId);

      if (error) throw error;

      toast.success('Admin status updated');
      fetchAdmins();
    } catch (error) {
      logger.error('Error updating admin status', { error });
      toast.error('Failed to update status');
    }
  };

  const filteredAdmins = admins.filter(admin =>
    admin.email.toLowerCase().includes(search.toLowerCase()) ||
    admin.admin_role.toLowerCase().includes(search.toLowerCase())
  );

  const getStats = () => {
    return {
      total: admins.length,
      active: admins.filter(a => a.status === 'active').length,
      superAdmins: admins.filter(a => a.admin_role === 'super_admin').length,
      seniorAdmins: admins.filter(a => a.admin_role === 'senior_admin').length,
    };
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'super_admin': return 'primary';
      case 'senior_admin': return 'info';
      case 'junior_admin': return 'default';
      default: return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'super_admin': return Crown;
      case 'senior_admin': return ShieldCheck;
      case 'junior_admin': return Shield;
      default: return Shield;
    }
  };

  const stats = getStats();

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)] animate-fade-in">
        <Card className="max-w-md shadow-soft border-border/50">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="p-4 rounded-full bg-destructive/10 mx-auto w-fit mb-4">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Only super admins can manage admin users. Please contact a super admin if you need access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <div className="p-2 rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          Admin Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage admin users and their permissions • {stats.active} active admins
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
        {[
          { label: 'Total Admins', value: stats.total, color: 'primary', icon: Users },
          { label: 'Active', value: stats.active, color: 'success', icon: CheckCircle2 },
          { label: 'Super Admins', value: stats.superAdmins, color: 'warning', icon: Crown },
          { label: 'Senior Admins', value: stats.seniorAdmins, color: 'info', icon: ShieldCheck },
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

      {/* Main Card */}
      <Card className="border-border/50 shadow-soft animate-fade-up" style={{ animationDelay: '200ms' }}>
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-card/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">Admin Users</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchAdmins}
                className="hover:bg-accent hover:scale-105 transition-all duration-200"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm"
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-glow transition-all duration-200"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Admin
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] animate-scale-in">
                  <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <UserPlus className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl">Create New Admin</DialogTitle>
                        <DialogDescription>
                          Add a new administrator to the system with specific permissions
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@example.com"
                        value={newAdmin.email}
                        onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">Admin will receive a welcome email</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm font-medium">Admin Role</Label>
                      <Select
                        value={newAdmin.adminRole}
                        onValueChange={(value) => setNewAdmin({...newAdmin, adminRole: value})}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="junior_admin">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              <span>Junior Admin</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="senior_admin">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4" />
                              <span>Senior Admin</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="super_admin">
                            <div className="flex items-center gap-2">
                              <Crown className="h-4 w-4" />
                              <span>Super Admin</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Determines access level and permissions</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code" className="text-sm font-medium">Admin Code</Label>
                      <Input
                        id="code"
                        type="password"
                        placeholder="Enter secure admin code"
                        value={newAdmin.adminCode}
                        onChange={(e) => setNewAdmin({...newAdmin, adminCode: e.target.value})}
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">Required for security verification</p>
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="hover:bg-accent"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={createAdmin}
                      className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create Admin
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/50">
                  <TableHead className="font-semibold">Admin</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-full bg-muted/50">
                          <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-lg">No admins found</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {search ? 'Try adjusting your search' : 'Add your first admin to get started'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAdmins.map((admin, index) => {
                    const RoleIcon = getRoleIcon(admin.admin_role);
                    
                    return (
                      <TableRow 
                        key={admin.id} 
                        className="group hover:bg-accent/50 transition-all duration-200 border-b border-border/30 animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                              admin.admin_role === 'super_admin' 
                                ? 'bg-gradient-to-br from-warning/20 to-warning/10' 
                                : admin.admin_role === 'senior_admin'
                                ? 'bg-gradient-to-br from-info/20 to-info/10'
                                : 'bg-gradient-to-br from-primary/20 to-primary/10'
                            }`}>
                              {admin.email.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium group-hover:text-primary transition-colors">
                              {admin.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={getRoleBadgeColor(admin.admin_role) === 'primary' ? 'default' : 'outline'}
                            className={`
                              ${admin.admin_role === 'super_admin' ? 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20' : ''}
                              ${admin.admin_role === 'senior_admin' ? 'bg-info/10 text-info border-info/20 hover:bg-info/20' : ''}
                              ${admin.admin_role === 'junior_admin' ? 'bg-muted text-muted-foreground hover:bg-muted/80' : ''}
                              font-medium transition-colors
                            `}
                          >
                            <RoleIcon className="h-3 w-3 mr-1" />
                            {admin.admin_role.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {admin.status === 'active' ? (
                            <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 transition-colors font-medium">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : admin.status === 'inactive' ? (
                            <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 transition-colors font-medium">
                              <Clock className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-destructive text-destructive hover:bg-destructive/10 transition-colors font-medium">
                              <XCircle className="h-3 w-3 mr-1" />
                              Suspended
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(admin.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={admin.status}
                            onValueChange={(value) => updateAdminStatus(admin.id, value)}
                          >
                            <SelectTrigger className="w-[130px] ml-auto h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                  <span>Active</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="inactive">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>Inactive</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="suspended">
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                                  <span>Suspended</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer Info */}
          {filteredAdmins.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Showing <span className="font-medium text-foreground">{filteredAdmins.length}</span> of <span className="font-medium text-foreground">{admins.length}</span> admins
              </p>
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse"></span>
                Last updated: just now
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
