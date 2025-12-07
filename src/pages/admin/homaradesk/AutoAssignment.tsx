import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
  Settings,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';

interface AutoAssignmentRule {
  id: string;
  name: string;
  description?: string;
  conditions: Record<string, any>;
  assign_to_team_id?: string;
  assign_to_admin_id?: string;
  set_priority?: string;
  add_tags?: string[];
  rule_priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Team {
  id: string;
  name: string;
}

interface Admin {
  id: string;
  name: string;
}

export default function AutoAssignment() {
  const permissions = usePermissions();
  
  if (!permissions.canViewAutoAssignment) {
    return null; // ProtectedRoute will handle redirect
  }
  
  const [rules, setRules] = useState<AutoAssignmentRule[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoAssignmentRule | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    ticket_type: '',
    priority: '',
    category: '',
    assign_to_team_id: '',
    assign_to_admin_id: '',
    set_priority: '',
    add_tags: '',
    rule_priority: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('homaradesk_auto_assignment_rules')
        .select('*')
        .order('rule_priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (rulesError) {
        if (rulesError.code === '42P01' || rulesError.code === 'PGRST116' || 
            rulesError.message?.includes('does not exist') || rulesError.message?.includes('schema cache')) {
          setRules([]);
        } else {
          throw rulesError;
        }
      } else {
        setRules(rulesData || []);
      }

      // Fetch teams
      const { data: teamsData } = await supabase
        .from('homaradesk_teams')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (teamsData) {
        setTeams(teamsData);
      }

      // Fetch admins
      const { data: adminsData } = await supabase
        .from('admins')
        .select('id, user_id, status')
        .eq('status', 'active');

      if (adminsData) {
        const adminUserIds = adminsData.map((a: any) => a.user_id);
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', adminUserIds);

        if (adminProfiles) {
          const adminIdToUserId = new Map(adminsData.map((a: any) => [a.user_id, a.id]));
          const adminsWithNames = adminProfiles.map((p: any) => {
            const adminId = adminIdToUserId.get(p.id);
            return {
              id: adminId,
              name: p.full_name,
            };
          }).filter((a: any) => a.id);

          setAdmins(adminsWithNames);
        }
      }
    } catch (error: any) {
      logger.error('Error fetching auto-assignment data:', error);
      console.error('Auto-assignment fetch error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setForm({
      name: '',
      description: '',
      ticket_type: '',
      priority: '',
      category: '',
      assign_to_team_id: '',
      assign_to_admin_id: '',
      set_priority: '',
      add_tags: '',
      rule_priority: 0,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleEditRule = (rule: AutoAssignmentRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      description: rule.description || '',
      ticket_type: rule.conditions.ticket_type || '',
      priority: rule.conditions.priority || '',
      category: rule.conditions.category || '',
      assign_to_team_id: rule.assign_to_team_id || '',
      assign_to_admin_id: rule.assign_to_admin_id || '',
      set_priority: rule.set_priority || '',
      add_tags: rule.add_tags?.join(', ') || '',
      rule_priority: rule.rule_priority,
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const handleSaveRule = async () => {
    try {
      const conditions: Record<string, any> = {};
      if (form.ticket_type) conditions.ticket_type = form.ticket_type;
      if (form.priority) conditions.priority = form.priority;
      if (form.category) conditions.category = form.category;

      const ruleData: any = {
        name: form.name,
        description: form.description || null,
        conditions,
        rule_priority: form.rule_priority,
        is_active: form.is_active,
      };

      if (form.assign_to_team_id) {
        ruleData.assign_to_team_id = form.assign_to_team_id;
      }
      if (form.assign_to_admin_id) {
        ruleData.assign_to_admin_id = form.assign_to_admin_id;
      }
      if (form.set_priority) {
        ruleData.set_priority = form.set_priority;
      }
      if (form.add_tags) {
        ruleData.add_tags = form.add_tags.split(',').map(t => t.trim()).filter(Boolean);
      }

      if (editingRule) {
        const { error } = await supabase
          .from('homaradesk_auto_assignment_rules')
          .update(ruleData)
          .eq('id', editingRule.id);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Rule updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('homaradesk_auto_assignment_rules')
          .insert(ruleData);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Rule created successfully',
        });
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      logger.error('Error saving rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save rule',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_auto_assignment_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Rule deleted successfully',
      });

      fetchData();
    } catch (error: any) {
      logger.error('Error deleting rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (rule: AutoAssignmentRule) => {
    try {
      const { error } = await supabase
        .from('homaradesk_auto_assignment_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Rule ${!rule.is_active ? 'activated' : 'deactivated'}`,
      });

      fetchData();
    } catch (error: any) {
      logger.error('Error toggling rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update rule',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auto-Assignment Rules</h1>
          <p className="text-muted-foreground">
            Configure automatic ticket assignment based on conditions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreateRule}>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">How Auto-Assignment Works:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Rules are evaluated in order of priority (highest first)</li>
                <li>First matching rule is applied to the ticket</li>
                <li>Rules can assign to teams or individual admins</li>
                <li>Rules can also set priority and add tags automatically</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Assignment Rules ({rules.length})</CardTitle>
          <CardDescription>
            Rules are evaluated in priority order when tickets are created
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No assignment rules configured</p>
              <p className="text-sm mt-2">
                Create your first rule to automatically assign tickets
              </p>
              <Button onClick={handleCreateRule} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Rule
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Badge variant="outline">{rule.rule_priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rule.name}</div>
                          {rule.description && (
                            <div className="text-xs text-muted-foreground">{rule.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {rule.conditions.ticket_type && (
                            <div>
                              <span className="text-muted-foreground">Type:</span>{' '}
                              <Badge variant="secondary">{rule.conditions.ticket_type}</Badge>
                            </div>
                          )}
                          {rule.conditions.priority && (
                            <div>
                              <span className="text-muted-foreground">Priority:</span>{' '}
                              <Badge variant="secondary">{rule.conditions.priority}</Badge>
                            </div>
                          )}
                          {rule.conditions.category && (
                            <div>
                              <span className="text-muted-foreground">Category:</span>{' '}
                              <Badge variant="secondary">{rule.conditions.category}</Badge>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {rule.assign_to_team_id && (
                            <div>
                              <span className="text-muted-foreground">Assign to Team:</span>{' '}
                              {teams.find(t => t.id === rule.assign_to_team_id)?.name || 'Unknown'}
                            </div>
                          )}
                          {rule.assign_to_admin_id && (
                            <div>
                              <span className="text-muted-foreground">Assign to:</span>{' '}
                              {admins.find(a => a.id === rule.assign_to_admin_id)?.name || 'Unknown'}
                            </div>
                          )}
                          {rule.set_priority && (
                            <div>
                              <span className="text-muted-foreground">Set Priority:</span>{' '}
                              <Badge>{rule.set_priority}</Badge>
                            </div>
                          )}
                          {rule.add_tags && rule.add_tags.length > 0 && (
                            <div>
                              <span className="text-muted-foreground">Add Tags:</span>{' '}
                              {rule.add_tags.map((tag, idx) => (
                                <Badge key={idx} variant="outline" className="ml-1">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {rule.is_active ? (
                          <Badge variant="default">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(rule.created_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(rule)}
                          >
                            {rule.is_active ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRule(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule.id)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Assignment Rule' : 'Create Assignment Rule'}
            </DialogTitle>
            <DialogDescription>
              Configure conditions and actions for automatic ticket assignment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., High Priority Billing Issues"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                className="mt-1"
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Conditions (All must match)</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="ticket_type">Ticket Type</Label>
                  <Select
                    value={form.ticket_type}
                    onValueChange={(value) => setForm({ ...form, ticket_type: value })}
                  >
                    <SelectTrigger id="ticket_type" className="mt-1">
                      <SelectValue placeholder="Any type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any Type</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="feature_request">Feature Request</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(value) => setForm({ ...form, priority: value })}
                  >
                    <SelectTrigger id="priority" className="mt-1">
                      <SelectValue placeholder="Any priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any Priority</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g., billing, booking (leave empty for any)"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Actions</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="assign_to_team">Assign to Team</Label>
                  <Select
                    value={form.assign_to_team_id}
                    onValueChange={(value) => setForm({ ...form, assign_to_team_id: value, assign_to_admin_id: '' })}
                  >
                    <SelectTrigger id="assign_to_team" className="mt-1">
                      <SelectValue placeholder="No team assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Team Assignment</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assign_to_admin">Assign to Admin</Label>
                  <Select
                    value={form.assign_to_admin_id}
                    onValueChange={(value) => setForm({ ...form, assign_to_admin_id: value, assign_to_team_id: '' })}
                  >
                    <SelectTrigger id="assign_to_admin" className="mt-1">
                      <SelectValue placeholder="No admin assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Admin Assignment</SelectItem>
                      {admins.map((admin) => (
                        <SelectItem key={admin.id} value={admin.id}>
                          {admin.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="set_priority">Set Priority</Label>
                  <Select
                    value={form.set_priority}
                    onValueChange={(value) => setForm({ ...form, set_priority: value })}
                  >
                    <SelectTrigger id="set_priority" className="mt-1">
                      <SelectValue placeholder="Don't change priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Don't Change</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="add_tags">Add Tags (comma-separated)</Label>
                  <Input
                    id="add_tags"
                    value={form.add_tags}
                    onChange={(e) => setForm({ ...form, add_tags: e.target.value })}
                    placeholder="e.g., urgent, billing, vip"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rule_priority">Rule Priority</Label>
                  <Input
                    id="rule_priority"
                    type="number"
                    value={form.rule_priority}
                    onChange={(e) => setForm({ ...form, rule_priority: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Higher numbers are evaluated first
                  </p>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="is_active" className="cursor-pointer">
                      Rule is active
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} disabled={!form.name.trim()}>
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

