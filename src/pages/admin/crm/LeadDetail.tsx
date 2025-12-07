import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ArrowLeft,
  Edit,
  Save,
  Star,
  Target,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { ContactActivityTimeline } from '@/components/crm/ContactActivityTimeline';

interface Lead {
  id: string;
  contact_id: string | null;
  user_id: string | null;
  source_id: string | null;
  source_name: string | null;
  status: string;
  lead_score: number;
  assigned_to: string | null;
  expected_value: number | null;
  conversion_probability: number;
  qualification_date: string | null;
  conversion_date: string | null;
  lost_reason: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  contact?: {
    full_name: string;
    email: string | null;
    phone: string | null;
  };
}

interface ScoreHistory {
  id: string;
  previous_score: number | null;
  new_score: number;
  score_change: number;
  reason: string | null;
  created_at: string;
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<Lead | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});

  useEffect(() => {
    if (id) {
      fetchLeadDetails();
    }
  }, [id]);

  const fetchLeadDetails = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_lead_details' as any, {
        p_lead_id: id,
      });

      if (error) throw error;

      if (data) {
        const leadData = data.lead?.lead;
        setLead(leadData as Lead);
        setEditForm(leadData as Partial<Lead>);
        setScoreHistory((data.score_history as ScoreHistory[]) || []);
      }
    } catch (error: any) {
      logger.error('Error fetching lead details', { error });
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!id) return;

    try {
      const { error } = await supabase.rpc('update_crm_lead' as any, {
        p_lead_id: id,
        p_status: editForm.status || undefined,
        p_assigned_to: editForm.assigned_to || undefined,
        p_expected_value: editForm.expected_value || undefined,
        p_conversion_probability: editForm.conversion_probability || undefined,
        p_notes: editForm.notes || undefined,
      });

      if (error) throw error;

      toast.success('Lead updated successfully');
      setEditMode(false);
      fetchLeadDetails();
    } catch (error: any) {
      logger.error('Error updating lead', { error });
      toast.error('Failed to update lead');
    }
  };

  const handleConvertLead = async () => {
    if (!id) return;

    try {
      const { error } = await supabase.rpc('convert_lead_to_contact' as any, {
        p_lead_id: id,
      });

      if (error) throw error;

      toast.success('Lead converted successfully');
      fetchLeadDetails();
      
      // Navigate to contact if exists
      if (lead?.contact_id) {
        navigate(`/crm/contacts/${lead.contact_id}`);
      }
    } catch (error: any) {
      logger.error('Error converting lead', { error });
      toast.error('Failed to convert lead');
    }
  };

  const handleRecalculateScore = async () => {
    if (!id) return;

    try {
      const { error } = await supabase.rpc('calculate_crm_lead_score' as any, {
        p_lead_id: id,
      });

      if (error) throw error;

      toast.success('Lead score recalculated');
      fetchLeadDetails();
    } catch (error: any) {
      logger.error('Error recalculating score', { error });
      toast.error('Failed to recalculate score');
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 75) {
      return <Badge className="bg-red-500 text-white">Hot ({score})</Badge>;
    } else if (score >= 50) {
      return <Badge className="bg-orange-500 text-white">Warm ({score})</Badge>;
    } else if (score >= 25) {
      return <Badge className="bg-yellow-500 text-white">Cold ({score})</Badge>;
    }
    return <Badge variant="outline">Low ({score})</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      new: { variant: 'default' as const, label: 'New' },
      contacted: { variant: 'secondary' as const, label: 'Contacted' },
      qualified: { variant: 'default' as const, label: 'Qualified' },
      converted: { variant: 'default' as const, label: 'Converted' },
      lost: { variant: 'destructive' as const, label: 'Lost' },
      nurturing: { variant: 'secondary' as const, label: 'Nurturing' },
    };
    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Lead not found</p>
        <Button onClick={() => navigate('/crm/leads')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Leads
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/crm/leads')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {lead.contact?.full_name || lead.contact?.email || 'Unknown Lead'}
            </h1>
            <p className="text-muted-foreground">Lead Details & Management</p>
          </div>
        </div>
        <div className="flex gap-2">
          {lead.status !== 'converted' && lead.status !== 'lost' && (
            <>
              <Button variant="outline" onClick={handleRecalculateScore}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Recalculate Score
              </Button>
              <Button variant="outline" onClick={() => setUpdateStatusDialogOpen(true)}>
                Update Status
              </Button>
              <Button onClick={handleConvertLead}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Convert to Contact
              </Button>
            </>
          )}
          {!editMode ? (
            <Button onClick={() => setEditMode(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Lead
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEditMode(false); setEditForm(lead); }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateLead}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead Score</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lead.lead_score}</div>
            {getScoreBadge(lead.lead_score)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="mt-2">{getStatusBadge(lead.status)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expected Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lead.expected_value ? `KSh ${lead.expected_value.toLocaleString()}` : 'N/A'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Probability</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lead.conversion_probability}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="score">Score Breakdown</TabsTrigger>
          {lead.contact_id && <TabsTrigger value="activity">Activity Timeline</TabsTrigger>}
          <TabsTrigger value="history">Score History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editMode ? (
                    <>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={editForm.status || ''}
                          onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="qualified">Qualified</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                            <SelectItem value="nurturing">Nurturing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Value (KSh)</Label>
                        <Input
                          type="number"
                          value={editForm.expected_value || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, expected_value: parseFloat(e.target.value) || null })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Conversion Probability (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={editForm.conversion_probability || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, conversion_probability: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={editForm.notes || ''}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          rows={6}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label className="text-muted-foreground">Source</Label>
                        <p className="mt-1">{lead.source_name || 'Not specified'}</p>
                      </div>
                      {lead.contact?.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <a href={`mailto:${lead.contact.email}`} className="text-primary hover:underline">
                            {lead.contact.email}
                          </a>
                        </div>
                      )}
                      {lead.contact?.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <a href={`tel:${lead.contact.phone}`} className="text-primary hover:underline">
                            {lead.contact.phone}
                          </a>
                        </div>
                      )}
                      <div>
                        <Label className="text-muted-foreground">Notes</Label>
                        <p className="mt-1 whitespace-pre-wrap">{lead.notes || 'No notes'}</p>
                      </div>
                      {lead.qualification_date && (
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <Label className="text-muted-foreground">Qualified</Label>
                            <p className="mt-1">{format(new Date(lead.qualification_date), 'PPpp')}</p>
                          </div>
                        </div>
                      )}
                      {lead.conversion_date && (
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <div>
                            <Label className="text-muted-foreground">Converted</Label>
                            <p className="mt-1">{format(new Date(lead.conversion_date), 'PPpp')}</p>
                          </div>
                        </div>
                      )}
                      {lead.lost_reason && (
                        <div className="flex items-center gap-3">
                          <XCircle className="h-5 w-5 text-red-500" />
                          <div>
                            <Label className="text-muted-foreground">Lost Reason</Label>
                            <p className="mt-1">{lead.lost_reason}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Created</Label>
                    <p className="mt-1 text-sm">{format(new Date(lead.created_at), 'PPpp')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Updated</Label>
                    <p className="mt-1 text-sm">{format(new Date(lead.updated_at), 'PPpp')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Score Breakdown Tab */}
        <TabsContent value="score" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Current Score</span>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">{lead.lead_score}</div>
                    {getScoreBadge(lead.lead_score)}
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-4">
                  <div
                    className="bg-primary h-4 rounded-full transition-all"
                    style={{ width: `${lead.lead_score}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Lead score is calculated based on engagement activities, profile completeness, and interactions.
                </p>
                <Button onClick={handleRecalculateScore} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recalculate Score
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Timeline Tab */}
        {lead.contact_id && (
          <TabsContent value="activity" className="space-y-4">
            <ContactActivityTimeline contactId={lead.contact_id} />
          </TabsContent>
        )}

        {/* Score History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Score History</CardTitle>
            </CardHeader>
            <CardContent>
              {scoreHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No score history available
                </div>
              ) : (
                <div className="space-y-4">
                  {scoreHistory.map((history) => (
                    <div key={history.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Score: {history.previous_score || 0} → {history.new_score}</span>
                          <Badge variant={history.score_change > 0 ? 'default' : 'secondary'}>
                            {history.score_change > 0 ? '+' : ''}{history.score_change}
                          </Badge>
                        </div>
                        {history.reason && (
                          <p className="text-sm text-muted-foreground mt-1">{history.reason}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(history.created_at), 'PPpp')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Update Status Dialog */}
      <Dialog open={updateStatusDialogOpen} onOpenChange={setUpdateStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Lead Status</DialogTitle>
            <DialogDescription>
              Change the status of this lead
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select
                value={editForm.status || lead.status}
                onValueChange={(value) => setEditForm({ ...editForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="nurturing">Nurturing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.status === 'lost' && (
              <div className="space-y-2">
                <Label>Lost Reason</Label>
                <Textarea
                  placeholder="Why was this lead lost?"
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { handleUpdateLead(); setUpdateStatusDialogOpen(false); }}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

