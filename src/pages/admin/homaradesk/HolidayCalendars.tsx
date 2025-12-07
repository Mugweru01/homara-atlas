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
import { Calendar } from '@/components/ui/calendar';
import {
  Plus,
  Edit,
  Trash,
  Calendar as CalendarIcon,
  RefreshCw,
  MoreVertical,
  Search,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';

interface HolidayCalendar {
  id: string;
  name: string;
  description?: string;
  timezone: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface Holiday {
  id: string;
  calendar_id: string;
  holiday_date: string;
  holiday_name: string;
  is_recurring: boolean;
}

export default function HolidayCalendars() {
  const permissions = usePermissions();
  
  if (!permissions.canViewHolidayCalendars) {
    return null; // ProtectedRoute will handle redirect
  }
  
  const [calendars, setCalendars] = useState<HolidayCalendar[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null);
  const [editingCalendar, setEditingCalendar] = useState<HolidayCalendar | null>(null);
  const [calendarForm, setCalendarForm] = useState({
    name: '',
    description: '',
    timezone: 'Africa/Nairobi',
    is_default: false,
  });
  const [holidayForm, setHolidayForm] = useState({
    holiday_date: '',
    holiday_name: '',
    is_recurring: false,
  });

  useEffect(() => {
    fetchCalendars();
  }, []);

  useEffect(() => {
    if (selectedCalendar) {
      fetchHolidays(selectedCalendar);
    }
  }, [selectedCalendar]);

  const fetchCalendars = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_holiday_calendars')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setCalendars([]);
          return;
        }
        throw error;
      }

      setCalendars(data || []);
    } catch (error: any) {
      logger.error('Error fetching calendars:', error);
      toast.error('Error', {
        description: error.message || 'Failed to fetch calendars',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidays = async (calendarId: string) => {
    try {
      const { data, error } = await supabase
        .from('homaradesk_holidays')
        .select('*')
        .eq('calendar_id', calendarId)
        .order('holiday_date', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setHolidays([]);
          return;
        }
        throw error;
      }

      setHolidays(data || []);
    } catch (error: any) {
      logger.error('Error fetching holidays:', error);
      toast.error('Error', {
        description: 'Failed to fetch holidays',
      });
    }
  };

  const handleSaveCalendar = async () => {
    try {
      const calendarData = {
        name: calendarForm.name,
        description: calendarForm.description || null,
        timezone: calendarForm.timezone,
        is_default: calendarForm.is_default,
        updated_at: new Date().toISOString(),
      };

      if (editingCalendar) {
        const { error } = await supabase
          .from('homaradesk_holiday_calendars')
          .update(calendarData)
          .eq('id', editingCalendar.id);

        if (error) throw error;
        toast.success('Success', {
          description: 'Calendar updated',
        });
      } else {
        const { error } = await supabase
          .from('homaradesk_holiday_calendars')
          .insert(calendarData);

        if (error) throw error;
        toast.success('Success', {
          description: 'Calendar created',
        });
      }

      setCalendarDialogOpen(false);
      setEditingCalendar(null);
      setCalendarForm({
        name: '',
        description: '',
        timezone: 'Africa/Nairobi',
        is_default: false,
      });
      fetchCalendars();
    } catch (error: any) {
      logger.error('Error saving calendar:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save calendar',
      });
    }
  };

  const handleSaveHoliday = async () => {
    if (!selectedCalendar) {
      toast.error('Error', {
        description: 'Please select a calendar first',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('homaradesk_holidays')
        .insert({
          calendar_id: selectedCalendar,
          holiday_date: holidayForm.holiday_date,
          holiday_name: holidayForm.holiday_name,
          is_recurring: holidayForm.is_recurring,
        });

      if (error) throw error;

      toast.success('Success', {
        description: 'Holiday added',
      });

      setHolidayDialogOpen(false);
      setHolidayForm({
        holiday_date: '',
        holiday_name: '',
        is_recurring: false,
      });
      fetchHolidays(selectedCalendar);
    } catch (error: any) {
      logger.error('Error saving holiday:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save holiday',
      });
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this calendar? All holidays will be deleted.')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_holiday_calendars')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Success', {
        description: 'Calendar deleted',
      });
      fetchCalendars();
    } catch (error: any) {
      logger.error('Error deleting calendar:', error);
      toast.error('Error', {
        description: error.message || 'Failed to delete calendar',
      });
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Success', {
        description: 'Holiday deleted',
      });
      if (selectedCalendar) fetchHolidays(selectedCalendar);
    } catch (error: any) {
      logger.error('Error deleting holiday:', error);
      toast.error('Error', {
        description: error.message || 'Failed to delete holiday',
      });
    }
  };

  const openCreateCalendarDialog = () => {
    setEditingCalendar(null);
    setCalendarForm({
      name: '',
      description: '',
      timezone: 'Africa/Nairobi',
      is_default: false,
    });
    setCalendarDialogOpen(true);
  };

  const openEditCalendarDialog = (calendar: HolidayCalendar) => {
    setEditingCalendar(calendar);
    setCalendarForm({
      name: calendar.name,
      description: calendar.description || '',
      timezone: calendar.timezone,
      is_default: calendar.is_default,
    });
    setCalendarDialogOpen(true);
  };

  const filteredCalendars = calendars.filter((calendar) => {
    const matchesSearch = search === '' ||
      calendar.name.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Holiday Calendars</h1>
          <p className="text-muted-foreground">
            Manage holiday calendars for SLA calculations
          </p>
        </div>
        <Button onClick={openCreateCalendarDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Calendar
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search calendars..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchCalendars} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Calendars List */}
        <Card>
          <CardHeader>
            <CardTitle>Calendars ({filteredCalendars.length})</CardTitle>
            <CardDescription>
              Holiday calendar definitions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCalendars.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium">No calendars found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {calendars.length === 0
                    ? 'Create your first holiday calendar.'
                    : 'Try adjusting your search.'}
                </p>
                {calendars.length === 0 && (
                  <Button onClick={openCreateCalendarDialog} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Calendar
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCalendars.map((calendar) => (
                  <div
                    key={calendar.id}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      selectedCalendar === calendar.id ? 'bg-primary/10 border-primary' : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedCalendar(calendar.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{calendar.name}</div>
                          {calendar.is_default && (
                            <Badge variant="default">Default</Badge>
                          )}
                        </div>
                        {calendar.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {calendar.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Timezone: {calendar.timezone}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            openEditCalendarDialog(calendar);
                          }}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCalendar(calendar.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Holidays List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Holidays</CardTitle>
                <CardDescription>
                  {selectedCalendar
                    ? `Holidays for ${calendars.find(c => c.id === selectedCalendar)?.name || 'selected calendar'}`
                    : 'Select a calendar to view holidays'}
                </CardDescription>
              </div>
              {selectedCalendar && (
                <Button size="sm" onClick={() => setHolidayDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedCalendar ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a calendar to view holidays</p>
              </div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No holidays defined</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setHolidayDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {holidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div>
                      <div className="font-medium">{holiday.holiday_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(holiday.holiday_date), 'MMMM d, yyyy')}
                        {holiday.is_recurring && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Recurring
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Calendar Dialog */}
      <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCalendar ? 'Edit Calendar' : 'Create Calendar'}
            </DialogTitle>
            <DialogDescription>
              {editingCalendar
                ? 'Update your holiday calendar.'
                : 'Create a new holiday calendar for SLA calculations.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Calendar Name *</Label>
              <Input
                value={calendarForm.name}
                onChange={(e) => setCalendarForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Kenya Public Holidays"
                required
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={calendarForm.description}
                onChange={(e) => setCalendarForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div>
              <Label>Timezone *</Label>
              <Select
                value={calendarForm.timezone}
                onValueChange={(value) => setCalendarForm((prev) => ({ ...prev, timezone: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Nairobi">Africa/Nairobi</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_default"
                checked={calendarForm.is_default}
                onCheckedChange={(checked: boolean) => setCalendarForm((prev) => ({ ...prev, is_default: checked }))}
              />
              <Label htmlFor="is_default">Set as default calendar</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCalendarDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCalendar} disabled={!calendarForm.name.trim()}>
              {editingCalendar ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Holiday Dialog */}
      <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>
              Add a holiday to the selected calendar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Holiday Name *</Label>
              <Input
                value={holidayForm.holiday_name}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, holiday_name: e.target.value }))}
                placeholder="e.g., New Year's Day"
                required
              />
            </div>

            <div>
              <Label>Holiday Date *</Label>
              <Input
                type="date"
                value={holidayForm.holiday_date}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, holiday_date: e.target.value }))}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_recurring"
                checked={holidayForm.is_recurring}
                onCheckedChange={(checked: boolean) => setHolidayForm((prev) => ({ ...prev, is_recurring: checked }))}
              />
              <Label htmlFor="is_recurring">Recurring (annual)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveHoliday} disabled={!holidayForm.holiday_name.trim() || !holidayForm.holiday_date}>
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

