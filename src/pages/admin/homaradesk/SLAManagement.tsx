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
  Clock,
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

interface SLA {
  id: string;
  name: string;
  description?: string;
  first_response_time: number; // in minutes
  resolution_time: number; // in minutes
  business_hours?: Record<string, any>;
  timezone: string;
  ticket_types?: string[];
  priorities?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SLAManagement() {
  const permissions = usePermissions();
  
  if (!permissions.canViewSLA) {
    return null; // ProtectedRoute will handle redirect
  }
  
  const [slas, setSlas] = useState<SLA[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSLA, setEditingSLA] = useState<SLA | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    first_response_time: 60,
    resolution_time: 240,
    timezone: 'Africa/Nairobi',
    ticket_types: [] as string[],
    priorities: [] as string[],
    is_active: true,
  });

  useEffect(() => {
    fetchSLAs();
  }, []);

  const fetchSLAs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('homaradesk_slas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setSlas([]);
          return;
        }
        throw error;
      }

      setSlas(data || []);
    } catch (error: any) {
      logger.error('Error fetching SLAs:', error);
      console.error('SLA fetch error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch SLAs',
        variant: 'destructive',
      });
      setSlas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSLA = () => {
    setEditingSLA(null);
    setForm({
      name: '',
      description: '',
      first_response_time: 60,
      resolution_time: 240,
      timezone: 'Africa/Nairobi',
      ticket_types: [],
      priorities: [],
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleEditSLA = (sla: SLA) => {
    setEditingSLA(sla);
    setForm({
      name: sla.name,
      description: sla.description || '',
      first_response_time: sla.first_response_time || 60,
      resolution_time: sla.resolution_time || 240,
      timezone: sla.timezone || 'Africa/Nairobi',
      ticket_types: sla.ticket_types || [],
      priorities: sla.priorities || [],
      is_active: sla.is_active,
    });
    setDialogOpen(true);
  };

  const handleSaveSLA = async () => {
    try {
      const slaData: any = {
        name: form.name,
        description: form.description || null,
        first_response_time: form.first_response_time,
        resolution_time: form.resolution_time,
        timezone: form.timezone,
        ticket_types: form.ticket_types.length > 0 ? form.ticket_types : null,
        priorities: form.priorities.length > 0 ? form.priorities : null,
        is_active: form.is_active,
      };

      if (editingSLA) {
        const { error } = await supabase
          .from('homaradesk_slas')
          .update(slaData)
          .eq('id', editingSLA.id);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'SLA updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('homaradesk_slas')
          .insert(slaData);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'SLA created successfully',
        });
      }

      setDialogOpen(false);
      fetchSLAs();
    } catch (error: any) {
      logger.error('Error saving SLA:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save SLA',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSLA = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SLA? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_slas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'SLA deleted successfully',
      });

      fetchSLAs();
    } catch (error: any) {
      logger.error('Error deleting SLA:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete SLA',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SLA Management</h1>
          <p className="text-muted-foreground">
            Define Service Level Agreements for ticket response and resolution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchSLAs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreateSLA}>
            <Plus className="mr-2 h-4 w-4" />
            Create SLA
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">About SLAs:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>SLAs define target response and resolution times for tickets</li>
                <li>Can be applied to specific ticket types and priorities</li>
                <li>Due dates are calculated automatically when tickets are created</li>
                <li>Overdue tickets are highlighted in the dashboard</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SLAs Table */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Definitions ({slas.length})</CardTitle>
          <CardDescription>
            Service Level Agreements for ticket handling
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : slas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No SLAs configured</p>
              <p className="text-sm mt-2">
                Create your first SLA to set response and resolution targets
              </p>
              <Button onClick={handleCreateSLA} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create SLA
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>First Response</TableHead>
                    <TableHead>Resolution</TableHead>
                    <TableHead>Applies To</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slas.map((sla) => (
                    <TableRow key={sla.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{sla.name}</div>
                          {sla.description && (
                            <div className="text-xs text-muted-foreground">{sla.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatTime(sla.first_response_time)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatTime(sla.resolution_time)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {sla.ticket_types && sla.ticket_types.length > 0 ? (
                            <div>
                              <span className="text-muted-foreground">Types:</span>{' '}
                              {sla.ticket_types.map((type, idx) => (
                                <Badge key={idx} variant="secondary" className="ml-1">{type}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">All types</span>
                          )}
                          {sla.priorities && sla.priorities.length > 0 && (
                            <div>
                              <span className="text-muted-foreground">Priorities:</span>{' '}
                              {sla.priorities.map((priority, idx) => (
                                <Badge key={idx} variant="outline" className="ml-1">{priority}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{sla.timezone}</span>
                      </TableCell>
                      <TableCell>
                        {sla.is_active ? (
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
                          {format(new Date(sla.created_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditSLA(sla)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSLA(sla.id)}
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
              {editingSLA ? 'Edit SLA' : 'Create SLA'}
            </DialogTitle>
            <DialogDescription>
              Define response and resolution time targets
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sla_name">SLA Name *</Label>
              <Input
                id="sla_name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Standard Support SLA"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sla_description">Description</Label>
              <Input
                id="sla_description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                className="mt-1"
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Response Times</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="first_response_time">First Response Time (minutes) *</Label>
                  <Input
                    id="first_response_time"
                    type="number"
                    value={form.first_response_time}
                    onChange={(e) => setForm({ ...form, first_response_time: parseInt(e.target.value) || 0 })}
                    placeholder="60"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Target: {formatTime(form.first_response_time)}
                  </p>
                </div>
                <div>
                  <Label htmlFor="resolution_time">Resolution Time (minutes) *</Label>
                  <Input
                    id="resolution_time"
                    type="number"
                    value={form.resolution_time}
                    onChange={(e) => setForm({ ...form, resolution_time: parseInt(e.target.value) || 0 })}
                    placeholder="240"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Target: {formatTime(form.resolution_time)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Applicability (Optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Leave empty to apply to all tickets, or specify types/priorities
              </p>
              <div className="space-y-2">
                <div>
                  <Label>Ticket Types (comma-separated)</Label>
                  <Input
                    value={form.ticket_types.join(', ')}
                    onChange={(e) => setForm({ 
                      ...form, 
                      ticket_types: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                    })}
                    placeholder="support, bug, billing (leave empty for all)"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Priorities (comma-separated)</Label>
                  <Input
                    value={form.priorities.join(', ')}
                    onChange={(e) => setForm({ 
                      ...form, 
                      priorities: e.target.value.split(',').map(p => p.trim()).filter(Boolean) 
                    })}
                    placeholder="urgent, critical (leave empty for all)"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  placeholder="Africa/Nairobi"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used for business hours calculations
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="sla_is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="sla_is_active" className="cursor-pointer">
                  SLA is active
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSLA} disabled={!form.name.trim() || form.first_response_time <= 0 || form.resolution_time <= 0}>
              {editingSLA ? 'Update SLA' : 'Create SLA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

