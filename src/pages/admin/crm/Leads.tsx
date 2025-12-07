import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Download,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  ArrowRight,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { format } from 'date-fns';
import { ExportButton } from '@/components/admin/ExportButton';
import { formatDateForExport, type ExportColumn } from '@/lib/export-utils';

interface Lead {
  id: string;
  contact_id: string | null;
  user_id: string | null;
  source_id: string | null;
  source_name: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' | 'nurturing';
  lead_score: number;
  assigned_to: string | null;
  expected_value: number | null;
  conversion_probability: number;
  qualification_date: string | null;
  conversion_date: string | null;
  created_at: string;
  contact_full_name: string | null;
  contact_email: string | null;
  total_count: number;
}

interface PipelineStats {
  total_leads: number;
  new_leads: number;
  contacted_leads: number;
  qualified_leads: number;
  converted_leads: number;
  lost_leads: number;
  total_pipeline_value: number;
  avg_lead_score: number;
  conversion_rate: number;
}

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchLeads();
    fetchStats();
    fetchSources();
  }, [statusFilter, sourceFilter, scoreFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_leads' as any, {
        p_status: statusFilter === 'all' ? null : statusFilter,
        p_source_id: sourceFilter === 'all' ? null : sourceFilter,
        p_min_score: scoreFilter === 'hot' ? 75 : scoreFilter === 'warm' ? 50 : scoreFilter === 'cold' ? 0 : null,
        p_max_score: scoreFilter === 'hot' ? 100 : scoreFilter === 'warm' ? 74 : null,
        p_limit: 100,
        p_offset: 0,
      });

      if (error) throw error;

      let filteredLeads = (data as any[]) || [];
      
      // Apply search filter
      if (searchQuery) {
        filteredLeads = filteredLeads.filter(
          (lead) =>
            lead.contact_full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.contact_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.source_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setLeads(filteredLeads);
    } catch (error: any) {
      logger.error('Error fetching leads', { error });
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_lead_pipeline_stats' as any);

      if (error) throw error;

      setStats(data as PipelineStats);
    } catch (error: any) {
      logger.error('Error fetching stats', { error });
    }
  };

  const fetchSources = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_lead_sources')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setSources((data as any) || []);
    } catch (error: any) {
      logger.error('Error fetching sources', { error });
    }
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

  const handleLeadClick = (leadId: string) => {
    navigate(`/crm/leads/${leadId}`);
  };

  const exportColumns: ExportColumn[] = [
    { key: 'contact_full_name', label: 'Contact Name' },
    { key: 'contact_email', label: 'Email' },
    { key: 'source_name', label: 'Source' },
    { key: 'status', label: 'Status' },
    { key: 'lead_score', label: 'Lead Score' },
    { key: 'expected_value', label: 'Expected Value' },
    { key: 'conversion_probability', label: 'Conversion Probability (%)' },
    { key: 'qualification_date', label: 'Qualified Date', format: formatDateForExport },
    { key: 'conversion_date', label: 'Conversion Date', format: formatDateForExport },
    { key: 'created_at', label: 'Created At', format: formatDateForExport },
  ];

  const exportFilterCriteria = {
    status: statusFilter,
    source: sourceFilter,
    score: scoreFilter,
    search: searchQuery,
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Manage and track leads through your sales pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchLeads(); fetchStats(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <ExportButton
            data={leads}
            columns={exportColumns}
            filename="crm-leads"
            pageType="crm-leads"
            filterCriteria={exportFilterCriteria}
          />
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_leads}</div>
              <p className="text-xs text-muted-foreground">All pipeline stages</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                KSh {stats.total_pipeline_value?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">Expected revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Lead Score</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.avg_lead_score || 0)}</div>
              <p className="text-xs text-muted-foreground">Quality indicator</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.conversion_rate?.toFixed(1) || '0'}%
              </div>
              <p className="text-xs text-muted-foreground">Leads converted</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stage Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.new_leads}</div>
                <p className="text-xs text-muted-foreground">New</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.contacted_leads}</div>
                <p className="text-xs text-muted-foreground">Contacted</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.qualified_leads}</div>
                <p className="text-xs text-muted-foreground">Qualified</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.converted_leads}</div>
                <p className="text-xs text-muted-foreground">Converted</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.lost_leads}</div>
                <p className="text-xs text-muted-foreground">Lost</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Leads List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lead List</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[250px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchLeads();
                  }
                }}
              />
              <Button variant="outline" size="icon" onClick={fetchLeads}>
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="nurturing">Nurturing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="hot">Hot (75-100)</SelectItem>
                <SelectItem value="warm">Warm (50-74)</SelectItem>
                <SelectItem value="cold">Cold (25-49)</SelectItem>
                <SelectItem value="low">Low (0-24)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No leads found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => handleLeadClick(lead.id)}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {lead.contact_full_name || lead.contact_email || 'Unknown Lead'}
                        </h3>
                        {getStatusBadge(lead.status)}
                        {getScoreBadge(lead.lead_score)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {lead.source_name && (
                          <span>Source: {lead.source_name}</span>
                        )}
                        {lead.expected_value && (
                          <span>Value: KSh {lead.expected_value.toLocaleString()}</span>
                        )}
                        <span>Created: {format(new Date(lead.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

