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
  Star,
  RefreshCw,
  MoreVertical,
  Search,
  Play,
  Pause,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { format } from 'date-fns';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions } from '@/hooks/usePermissions';

interface Survey {
  id: string;
  name: string;
  survey_type: string;
  trigger_event: string;
  trigger_delay_minutes: number;
  questions: any[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SatisfactionSurveys() {
  const { user } = useAdmin();
  const permissions = usePermissions();
  
  if (!permissions.canViewSurveys) {
    return null; // ProtectedRoute will handle redirect
  }
  
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [form, setForm] = useState({
    name: '',
    survey_type: 'csat',
    trigger_event: 'ticket_closed',
    trigger_delay_minutes: 0,
    questions: [] as any[],
    is_active: true,
  });

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homaradesk_surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' ||
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setSurveys([]);
          return;
        }
        throw error;
      }

      setSurveys(data || []);
    } catch (error: any) {
      logger.error('Error fetching surveys:', error);
      toast.error('Error', {
        description: error.message || 'Failed to fetch surveys',
      });
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    setForm((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { question: '', type: 'rating', required: true },
      ],
    }));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === index ? { ...q, [field]: value } : q
      ),
    }));
  };

  const removeQuestion = (index: number) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (form.questions.length === 0) {
      toast.error('Error', {
        description: 'At least one question is required',
      });
      return;
    }

    try {
      const surveyData = {
        name: form.name,
        survey_type: form.survey_type,
        trigger_event: form.trigger_event,
        trigger_delay_minutes: form.trigger_delay_minutes,
        questions: form.questions,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingSurvey) {
        const { error } = await supabase
          .from('homaradesk_surveys')
          .update(surveyData)
          .eq('id', editingSurvey.id);

        if (error) throw error;
        toast.success('Success', {
          description: 'Survey updated',
        });
      } else {
        const { error } = await supabase
          .from('homaradesk_surveys')
          .insert(surveyData);

        if (error) throw error;
        toast.success('Success', {
          description: 'Survey created',
        });
      }

      setDialogOpen(false);
      setEditingSurvey(null);
      setForm({
        name: '',
        survey_type: 'csat',
        trigger_event: 'ticket_closed',
        trigger_delay_minutes: 0,
        questions: [],
        is_active: true,
      });
      fetchSurveys();
    } catch (error: any) {
      logger.error('Error saving survey:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save survey',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this survey?')) return;

    try {
      const { error } = await supabase
        .from('homaradesk_surveys')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Success', {
        description: 'Survey deleted',
      });
      fetchSurveys();
    } catch (error: any) {
      logger.error('Error deleting survey:', error);
      toast.error('Error', {
        description: error.message || 'Failed to delete survey',
      });
    }
  };

  const toggleSurvey = async (survey: Survey) => {
    try {
      const { error } = await supabase
        .from('homaradesk_surveys')
        .update({ is_active: !survey.is_active })
        .eq('id', survey.id);

      if (error) throw error;
      toast.success('Success', {
        description: `Survey ${!survey.is_active ? 'activated' : 'deactivated'}`,
      });
      fetchSurveys();
    } catch (error: any) {
      logger.error('Error toggling survey:', error);
      toast.error('Error', {
        description: error.message || 'Failed to toggle survey',
      });
    }
  };

  const openCreateDialog = () => {
    setEditingSurvey(null);
    setForm({
      name: '',
      survey_type: 'csat',
      trigger_event: 'ticket_closed',
      trigger_delay_minutes: 0,
      questions: [],
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (survey: Survey) => {
    setEditingSurvey(survey);
    setForm({
      name: survey.name,
      survey_type: survey.survey_type,
      trigger_event: survey.trigger_event,
      trigger_delay_minutes: survey.trigger_delay_minutes,
      questions: Array.isArray(survey.questions) ? survey.questions : [],
      is_active: survey.is_active,
    });
    setDialogOpen(true);
  };

  const filteredSurveys = surveys.filter((survey) => {
    const matchesSearch = search === '' ||
      survey.name.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Satisfaction Surveys</h1>
          <p className="text-muted-foreground">
            Automated customer satisfaction surveys
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Survey
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search surveys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchSurveys} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Surveys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Surveys ({filteredSurveys.length})</CardTitle>
          <CardDescription>
            Manage your customer satisfaction surveys
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSurveys.length === 0 ? (
            <div className="text-center py-8">
              <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">No surveys found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {surveys.length === 0
                  ? 'Create your first satisfaction survey.'
                  : 'Try adjusting your search.'}
              </p>
              {surveys.length === 0 && (
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Survey
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSurveys.map((survey) => (
                  <TableRow key={survey.id}>
                    <TableCell className="font-medium">{survey.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {survey.survey_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {survey.trigger_event.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {Array.isArray(survey.questions) ? survey.questions.length : 0} questions
                    </TableCell>
                    <TableCell>
                      <Badge variant={survey.is_active ? 'default' : 'secondary'}>
                        {survey.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(survey.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleSurvey(survey)}>
                            {survey.is_active ? (
                              <>
                                <Pause className="mr-2 h-4 w-4" /> Deactivate
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" /> Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(survey)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <BarChart3 className="mr-2 h-4 w-4" /> View Responses
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(survey.id)}
                            className="text-destructive"
                          >
                            <Trash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSurvey ? 'Edit Survey' : 'Create Survey'}
            </DialogTitle>
            <DialogDescription>
              {editingSurvey
                ? 'Update your survey configuration.'
                : 'Create a new customer satisfaction survey.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Survey Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Post-Resolution CSAT Survey"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Survey Type *</Label>
                <Select
                  value={form.survey_type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, survey_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csat">CSAT (1-5 Stars)</SelectItem>
                    <SelectItem value="nps">NPS (0-10)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Trigger Event *</Label>
                <Select
                  value={form.trigger_event}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, trigger_event: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ticket_closed">Ticket Closed</SelectItem>
                    <SelectItem value="ticket_resolved">Ticket Resolved</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Trigger Delay (minutes)</Label>
              <Input
                type="number"
                min="0"
                value={form.trigger_delay_minutes}
                onChange={(e) => setForm((prev) => ({ ...prev, trigger_delay_minutes: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Delay before sending survey after trigger event
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Questions *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>
              {form.questions.length === 0 ? (
                <div className="p-4 border rounded-md text-center text-muted-foreground">
                  <p>No questions added. Click "Add Question" to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.questions.map((question, index) => (
                    <div key={index} className="p-3 border rounded-md space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Question {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQuestion(index)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <Label className="text-xs">Question Text</Label>
                        <Input
                          value={question.question || ''}
                          onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                          placeholder="Enter question..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={question.type || 'rating'}
                            onValueChange={(value) => updateQuestion(index, 'type', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rating">Rating</SelectItem>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="yes_no">Yes/No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2 pt-6">
                          <Checkbox
                            checked={question.required !== false}
                            onCheckedChange={(checked: boolean) => updateQuestion(index, 'required', checked)}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || form.questions.length === 0}>
              {editingSurvey ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

