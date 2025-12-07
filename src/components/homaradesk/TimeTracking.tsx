import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Plus, Play, Square, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { format } from 'date-fns';
import { useAdmin } from '@/hooks/useAdmin';

interface TimeEntry {
  id: string;
  time_spent_minutes: number;
  billable: boolean;
  category?: string;
  description?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  agent_name?: string;
}

interface TimeTrackingProps {
  ticketId: string;
  totalTimeSpent?: number;
  billableTime?: number;
}

export function TimeTracking({ ticketId, totalTimeSpent = 0, billableTime = 0 }: TimeTrackingProps) {
  const { user } = useAdmin();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [form, setForm] = useState({
    time_spent_minutes: 0,
    billable: true,
    category: '',
    description: '',
  });

  useEffect(() => {
    fetchEntries();
  }, [ticketId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning && timerStart) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timerStart.getTime()) / 1000 / 60);
        setForm((prev) => ({ ...prev, time_spent_minutes: elapsed }));
      }, 60000); // Update every minute
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerStart]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_time_entries')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setEntries([]);
          return;
        }
        throw error;
      }

      // Fetch agent names
      const agentIds = [...new Set((data || []).map((e: any) => e.agent_id).filter(Boolean))];
      const agentsMap = new Map();
      if (agentIds.length > 0) {
        const { data: admins } = await supabase
          .from('admins')
          .select('id, user_id')
          .in('id', agentIds);

        if (admins) {
          const adminUserIds = admins.map((a: any) => a.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', adminUserIds);

          if (profiles) {
            const adminIdToUserId = new Map(admins.map((a: any) => [a.user_id, a.id]));
            profiles.forEach((p: any) => {
              const adminId = adminIdToUserId.get(p.id);
              if (adminId) {
                agentsMap.set(adminId, p.full_name);
              }
            });
          }
        }
      }

      const processedEntries = (data || []).map((entry: any) => ({
        ...entry,
        agent_name: entry.agent_id ? agentsMap.get(entry.agent_id) : null,
      }));

      setEntries(processedEntries);
    } catch (error: any) {
      logger.error('Error fetching time entries:', error);
      toast.error('Error', {
        description: 'Failed to fetch time entries',
      });
    } finally {
      setLoading(false);
    }
  };

  const startTimer = () => {
    setTimerRunning(true);
    setTimerStart(new Date());
    setForm((prev) => ({ ...prev, time_spent_minutes: 0 }));
  };

  const stopTimer = () => {
    setTimerRunning(false);
    setTimerStart(null);
  };

  const handleSave = async () => {
    if (form.time_spent_minutes <= 0) {
      toast.error('Error', {
        description: 'Time spent must be greater than 0',
      });
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error('Error', {
          description: 'You must be logged in',
        });
        return;
      }

      // Get admin ID
      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .single();

      const { error } = await supabase
        .from('homaradesk_time_entries')
        .insert({
          ticket_id: ticketId,
          agent_id: admin?.id || null,
          time_spent_minutes: form.time_spent_minutes,
          billable: form.billable,
          category: form.category || null,
          description: form.description || null,
          started_at: timerStart?.toISOString() || null,
          ended_at: timerRunning ? null : new Date().toISOString(),
        });

      if (error) throw error;

      toast.success('Success', {
        description: 'Time entry added successfully',
      });

      setDialogOpen(false);
      setForm({
        time_spent_minutes: 0,
        billable: true,
        category: '',
        description: '',
      });
      stopTimer();
      fetchEntries();
    } catch (error: any) {
      logger.error('Error saving time entry:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save time entry',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this time entry?')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_time_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Success', {
        description: 'Time entry deleted',
      });

      fetchEntries();
    } catch (error: any) {
      logger.error('Error deleting time entry:', error);
      toast.error('Error', {
        description: 'Failed to delete time entry',
      });
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Tracking
          </CardTitle>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Time
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-muted-foreground">Total Time</div>
            <div className="text-2xl font-bold">{formatTime(totalTimeSpent)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Billable Time</div>
            <div className="text-2xl font-bold text-green-600">{formatTime(billableTime)}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No time entries yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {formatTime(entry.time_spent_minutes)}
                  </TableCell>
                  <TableCell>{entry.category || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {entry.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.billable ? 'default' : 'secondary'}>
                      {entry.billable ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>{entry.agent_name || '-'}</TableCell>
                  <TableCell>
                    {format(new Date(entry.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add Time Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
            <DialogDescription>
              Log time spent on this ticket
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              {!timerRunning ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startTimer}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Timer
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopTimer}
                  className="flex-1"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Timer
                </Button>
              )}
            </div>

            <div>
              <Label>Time Spent (minutes) *</Label>
              <Input
                type="number"
                min="1"
                value={form.time_spent_minutes}
                onChange={(e) => setForm((prev) => ({ ...prev, time_spent_minutes: parseInt(e.target.value) || 0 }))}
                disabled={timerRunning}
              />
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="communication">Communication</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What did you work on?"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="billable"
                checked={form.billable}
                onCheckedChange={(checked: boolean) => setForm((prev) => ({ ...prev, billable: checked }))}
              />
              <Label htmlFor="billable">Billable</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={timerRunning}>
              Save Time Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

