import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  ShieldCheck, 
  User, 
  Mail, 
  Phone, 
  FileText, 
  Download,
  ExternalLink,
  Clock,
  Award,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BulkActionsBar } from '@/components/admin/BulkActionsBar';
import { AdvancedFilter, FilterCriteria } from '@/components/admin/AdvancedFilter';
import { ExportButton } from '@/components/admin/ExportButton';
import { formatDateForExport, formatBooleanForExport } from '@/lib/export-utils';

interface LandlordProfile {
  full_name: string | null;
  email: string | null;
}

interface Verification {
  id: string;
  landlord_id: string;
  verification_email: string | null;
  verification_phone: string | null;
  status: string;
  trust_score: number;
  phone_verified: boolean;
  email_verified: boolean;
  identity_verified: boolean;
  submitted_at: string;
  id_document_url: string | null;
  proof_of_ownership_url: string | null;
  additional_documents: string[] | null;
  landlord?: LandlordProfile;
}

export default function AdminVerifications() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [filteredVerifications, setFilteredVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});

  useEffect(() => {
    fetchVerifications();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [verifications, filterCriteria]);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      // Fetch verifications first
      const { data: verificationsData, error: verificationsError} = await supabase
        .from('landlord_verifications')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (verificationsError) throw verificationsError;

      // If we have verifications, fetch the associated profile data
      if (verificationsData && verificationsData.length > 0) {
        const landlordIds = verificationsData.map(v => v.landlord_id);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', landlordIds);

        if (profilesError) {
          logger.warn('Error fetching profiles', { error: profilesError });
          // Continue even if profiles fail - we'll just show verification data without names
        }

        // Merge the data
        const mergedData = verificationsData.map(verification => ({
          ...verification,
          landlord: profilesData?.find(p => p.id === verification.landlord_id) || null
        }));

        setVerifications(mergedData);
      } else {
        setVerifications([]);
      }

      toast.success('Verifications loaded successfully');
    } catch (error) {
      logger.error('Error fetching verifications', { error });
      toast.error('Failed to load verifications');
    } finally {
      setLoading(false);
    }
  };

  const approveVerification = async (verificationId: string) => {
    try {
      const { error } = await supabase
        .from('landlord_verifications')
        .update({ 
          status: 'approved',
          trust_score: 100,
          phone_verified: true,
          email_verified: true,
          identity_verified: true,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', verificationId);

      if (error) throw error;

      toast.success('Verification approved successfully', {
        description: 'Landlord can now list properties',
      });
      fetchVerifications();
    } catch (error) {
      logger.error('Error approving verification', { error, verificationId });
      toast.error('Failed to approve verification');
    }
  };

  const rejectVerification = async () => {
    if (!selectedVerification || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      const { error } = await supabase
        .from('landlord_verifications')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedVerification.id);

      if (error) throw error;

      toast.success('Verification rejected', {
        description: 'Landlord has been notified',
      });
      setIsRejectDialogOpen(false);
      setSelectedVerification(null);
      setRejectionReason('');
      fetchVerifications();
    } catch (error) {
      logger.error('Error rejecting verification', { error, verificationId: selectedVerification.id });
      toast.error('Failed to reject verification');
    }
  };

  const openDetailsDialog = (verification: Verification) => {
    setSelectedVerification(verification);
    setIsDetailsDialogOpen(true);
  };

  const applyFilters = () => {
    let filtered = [...verifications];

    // Apply search filter
    if (filterCriteria.search) {
      const searchLower = filterCriteria.search.toLowerCase();
      filtered = filtered.filter(v => 
        v.landlord?.full_name?.toLowerCase().includes(searchLower) ||
        v.landlord?.email?.toLowerCase().includes(searchLower) ||
        v.verification_email?.toLowerCase().includes(searchLower) ||
        v.verification_phone?.includes(searchLower)
      );
    }

    // Apply status filter
    if (filterCriteria.status) {
      filtered = filtered.filter(v => v.status === filterCriteria.status);
    }

    // Apply trust score filter
    if (filterCriteria.trust_score_min) {
      filtered = filtered.filter(v => v.trust_score >= Number(filterCriteria.trust_score_min));
    }
    if (filterCriteria.trust_score_max) {
      filtered = filtered.filter(v => v.trust_score <= Number(filterCriteria.trust_score_max));
    }

    // Apply verification status filters
    if (filterCriteria.email_verified !== undefined) {
      filtered = filtered.filter(v => v.email_verified === (filterCriteria.email_verified === 'true'));
    }
    if (filterCriteria.phone_verified !== undefined) {
      filtered = filtered.filter(v => v.phone_verified === (filterCriteria.phone_verified === 'true'));
    }
    if (filterCriteria.identity_verified !== undefined) {
      filtered = filtered.filter(v => v.identity_verified === (filterCriteria.identity_verified === 'true'));
    }

    setFilteredVerifications(filtered);
  };

  const getStatusStats = () => {
    return {
      total: filteredVerifications.length,
      pending: filteredVerifications.filter(v => v.status === 'pending').length,
      approved: filteredVerifications.filter(v => v.status === 'approved').length,
      rejected: filteredVerifications.filter(v => v.status === 'rejected').length,
    };
  };

  // Bulk selection handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVerifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVerifications.map(v => v.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk action handler
  const handleBulkAction = async (action: string, note?: string) => {
    try {
      const selectedArray = Array.from(selectedIds);
      
      if (action === 'approve') {
        const { data, error } = await supabase.rpc('bulk_update_verifications', {
          p_verification_ids: selectedArray,
          p_status: 'approved',
          p_admin_notes: note,
        });

        if (error) throw error;
        
        toast.success(`Approved ${data.updated} verification(s)`, {
          description: data.failed > 0 ? `${data.failed} failed` : undefined
        });
        
        fetchVerifications();
        return data;
      } else if (action === 'reject') {
        const { data, error } = await supabase.rpc('bulk_update_verifications', {
          p_verification_ids: selectedArray,
          p_status: 'rejected',
          p_rejection_reason: note || 'Verification rejected',
          p_admin_notes: note,
        });

        if (error) throw error;
        
        toast.success(`Rejected ${data.updated} verification(s)`, {
          description: data.failed > 0 ? `${data.failed} failed` : undefined
        });
        
        fetchVerifications();
        return data;
      }

      return { success: false, updated: 0, failed: 0 };
    } catch (error) {
      logger.error('Bulk action error', { error, action });
      toast.error('Bulk action failed');
      throw error;
    }
  };

  const stats = getStatusStats();

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
          <div className="p-2 rounded-xl bg-warning/10">
            <ShieldCheck className="h-6 w-6 text-warning" />
          </div>
          Landlord Verifications
        </h1>
        <p className="text-muted-foreground mt-1">
          Review verification requests with documents • {stats.pending} pending review
        </p>
      </div>

      {/* Advanced Filter */}
      <AdvancedFilter
        pageType="verifications"
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'in_review', label: 'In Review' },
            ],
            placeholder: 'Filter by status'
          },
          {
            key: 'trust_score_min',
            label: 'Min Trust Score',
            type: 'number',
            placeholder: 'e.g., 50'
          },
          {
            key: 'trust_score_max',
            label: 'Max Trust Score',
            type: 'number',
            placeholder: 'e.g., 100'
          },
          {
            key: 'email_verified',
            label: 'Email Verified',
            type: 'select',
            options: [
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ],
          },
          {
            key: 'phone_verified',
            label: 'Phone Verified',
            type: 'select',
            options: [
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ],
          },
          {
            key: 'identity_verified',
            label: 'Identity Verified',
            type: 'select',
            options: [
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ],
          },
        ]}
        onFilterChange={setFilterCriteria}
        searchPlaceholder="Search by name, email, or phone..."
      />

      {/* Status Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
        {[
          { label: 'Total', value: stats.total, color: 'primary', icon: ShieldCheck },
          { label: 'Pending', value: stats.pending, color: 'warning', icon: Clock },
          { label: 'Approved', value: stats.approved, color: 'success', icon: CheckCircle },
          { label: 'Rejected', value: stats.rejected, color: 'destructive', icon: XCircle },
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
            <CardTitle className="text-xl font-semibold">All Verification Requests</CardTitle>
            <div className="flex items-center gap-2">
              <ExportButton
                data={filteredVerifications}
                columns={[
                  { key: 'landlord.full_name', label: 'Landlord Name' },
                  { key: 'landlord.email', label: 'Primary Email' },
                  { key: 'verification_email', label: 'Verification Email' },
                  { key: 'verification_phone', label: 'Phone Number' },
                  { key: 'status', label: 'Status' },
                  { key: 'trust_score', label: 'Trust Score' },
                  { 
                    key: 'email_verified', 
                    label: 'Email Verified',
                    format: formatBooleanForExport 
                  },
                  { 
                    key: 'phone_verified', 
                    label: 'Phone Verified',
                    format: formatBooleanForExport 
                  },
                  { 
                    key: 'identity_verified', 
                    label: 'Identity Verified',
                    format: formatBooleanForExport 
                  },
                  { 
                    key: 'submitted_at', 
                    label: 'Submitted At',
                    format: formatDateForExport 
                  },
                  { key: 'id_document_url', label: 'ID Document URL' },
                  { key: 'proof_of_ownership_url', label: 'Proof of Ownership URL' },
                ]}
                filename="verifications"
                pageType="verifications"
                filterCriteria={filterCriteria}
                size="sm"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchVerifications}
                className="hover:bg-accent hover:scale-105 transition-all duration-200"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Bulk Actions Bar */}
          <BulkActionsBar
            selectedCount={selectedIds.size}
            totalCount={filteredVerifications.length}
            actions={[
              { 
                value: 'approve', 
                label: 'Approve Selected', 
                variant: 'default',
                requiresNote: false 
              },
              { 
                value: 'reject', 
                label: 'Reject Selected', 
                variant: 'destructive',
                requiresNote: true,
                noteLabel: 'Rejection Reason',
                notePlaceholder: 'Provide a detailed reason for rejection...'
              },
            ]}
            onAction={handleBulkAction}
            onClearSelection={clearSelection}
            entityName="verification"
          />

          {/* Table */}
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === verifications.length && verifications.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">Landlord</TableHead>
                  <TableHead className="font-semibold">Contact Info</TableHead>
                  <TableHead className="font-semibold">Documents</TableHead>
                  <TableHead className="font-semibold">Trust Score</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Submitted</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVerifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-full bg-muted/50">
                          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-lg">No verifications found</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {Object.keys(filterCriteria).length > 0 
                              ? 'Try adjusting your filters'
                              : 'All verification requests will appear here'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVerifications.map((verification, index) => (
                    <TableRow 
                      key={verification.id} 
                      className="group hover:bg-accent/50 transition-all duration-200 border-b border-border/30 animate-fade-in"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(verification.id)}
                          onCheckedChange={() => toggleSelection(verification.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-warning/20 to-warning/10 flex items-center justify-center text-sm font-semibold">
                            {verification.landlord?.full_name?.charAt(0).toUpperCase() || 'L'}
                          </div>
                          <div>
                            <div className="font-medium group-hover:text-primary transition-colors">
                              {verification.landlord?.full_name || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {verification.landlord?.email || verification.verification_email || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Mail className="h-3 w-3" />
                            <span>{verification.verification_email || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3" />
                            <span>{verification.verification_phone || 'N/A'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {verification.id_document_url && (
                            <Badge variant="outline" className="text-xs w-fit">
                              <FileText className="h-3 w-3 mr-1" />
                              ID Document
                            </Badge>
                          )}
                          {verification.proof_of_ownership_url && (
                            <Badge variant="outline" className="text-xs w-fit">
                              <FileText className="h-3 w-3 mr-1" />
                              Proof of Ownership
                            </Badge>
                          )}
                          {verification.additional_documents && verification.additional_documents.length > 0 && (
                            <Badge variant="outline" className="text-xs w-fit">
                              <FileText className="h-3 w-3 mr-1" />
                              +{verification.additional_documents.length} more
                            </Badge>
                          )}
                          {!verification.id_document_url && !verification.proof_of_ownership_url && (
                            <span className="text-xs text-muted-foreground">No documents</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-warning" />
                          <span className="font-semibold">{verification.trust_score}</span>
                          <span className="text-xs text-muted-foreground">/100</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {verification.status === 'approved' && (
                          <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 transition-colors font-medium">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                        {verification.status === 'pending' && (
                          <Badge variant="outline" className="border-warning text-warning hover:bg-warning/10 transition-colors font-medium">
                            <div className="h-1.5 w-1.5 rounded-full bg-warning mr-1.5 animate-pulse"></div>
                            Pending
                          </Badge>
                        )}
                        {verification.status === 'rejected' && (
                          <Badge variant="outline" className="border-destructive text-destructive hover:bg-destructive/10 transition-colors font-medium">
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejected
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(verification.submitted_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailsDialog(verification)}
                            className="hover:bg-info/10 hover:text-info hover:scale-110 transition-all duration-200"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {verification.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => approveVerification(verification.id)}
                                className="hover:bg-success/10 hover:text-success hover:scale-110 transition-all duration-200"
                                title="Approve verification"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedVerification(verification);
                                  setIsRejectDialogOpen(true);
                                }}
                                className="hover:bg-destructive/10 hover:text-destructive hover:scale-110 transition-all duration-200"
                                title="Reject verification"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer Info */}
          {verifications.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <p>
                Showing <span className="font-medium text-foreground">{filteredVerifications.length}</span> 
                {filteredVerifications.length !== verifications.length && (
                  <> of <span className="font-medium text-foreground">{verifications.length}</span></>
                )} verification requests
              </p>
              <p className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse"></span>
                Last updated: just now
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-[500px] animate-scale-in">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle className="text-xl">Reject Verification</DialogTitle>
            </div>
            <DialogDescription>
              Please provide a detailed reason for rejecting this verification request. The landlord will receive this feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Enter rejection reason (e.g., unclear documents, missing information, suspicious activity)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {rejectionReason.length}/500 characters
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setSelectedVerification(null);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={rejectVerification}
              disabled={!rejectionReason.trim() || rejectionReason.length > 500}
              className="bg-gradient-to-r from-destructive to-destructive/80"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject Verification
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] animate-scale-in">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <ShieldCheck className="h-5 w-5 text-warning" />
              </div>
              <div>
                <DialogTitle className="text-xl">Verification Details</DialogTitle>
                <DialogDescription>
                  Complete information about this landlord verification request
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedVerification && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Landlord Information */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Landlord Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                      <p className="font-medium">{selectedVerification.landlord?.full_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Email (Primary)</p>
                      <p className="font-medium text-sm">{selectedVerification.landlord?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Verification Email</p>
                      <p className="font-medium text-sm">{selectedVerification.verification_email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                      <p className="font-medium">{selectedVerification.verification_phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Verification Status */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4 text-warning" />
                    Verification Status
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Trust Score</p>
                      <p className="text-2xl font-bold">{selectedVerification.trust_score}/100</p>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Current Status</p>
                      <div className="mt-1">
                        {selectedVerification.status === 'approved' && (
                          <Badge className="bg-success text-success-foreground">Approved</Badge>
                        )}
                        {selectedVerification.status === 'pending' && (
                          <Badge variant="outline" className="border-warning text-warning">Pending Review</Badge>
                        )}
                        {selectedVerification.status === 'rejected' && (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Verification Checks */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`p-2 rounded-lg text-center ${selectedVerification.email_verified ? 'bg-success/10' : 'bg-muted/30'}`}>
                      <p className="text-xs mb-1">Email</p>
                      {selectedVerification.email_verified ? (
                        <CheckCircle className="h-4 w-4 mx-auto text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 mx-auto text-muted-foreground" />
                      )}
                    </div>
                    <div className={`p-2 rounded-lg text-center ${selectedVerification.phone_verified ? 'bg-success/10' : 'bg-muted/30'}`}>
                      <p className="text-xs mb-1">Phone</p>
                      {selectedVerification.phone_verified ? (
                        <CheckCircle className="h-4 w-4 mx-auto text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 mx-auto text-muted-foreground" />
                      )}
                    </div>
                    <div className={`p-2 rounded-lg text-center ${selectedVerification.identity_verified ? 'bg-success/10' : 'bg-muted/30'}`}>
                      <p className="text-xs mb-1">Identity</p>
                      {selectedVerification.identity_verified ? (
                        <CheckCircle className="h-4 w-4 mx-auto text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 mx-auto text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Submitted Documents */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-info" />
                    Submitted Documents
                  </h3>
                  <div className="space-y-2">
                    {selectedVerification.id_document_url ? (
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-info/10">
                            <FileText className="h-4 w-4 text-info" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">ID Document</p>
                            <p className="text-xs text-muted-foreground">Government-issued identification</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(selectedVerification.id_document_url!, '_blank')}
                            className="hover:bg-info/10"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="hover:bg-info/10"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <p className="text-sm text-destructive">No ID document submitted</p>
                      </div>
                    )}

                    {selectedVerification.proof_of_ownership_url ? (
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-info/10">
                            <FileText className="h-4 w-4 text-info" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Proof of Ownership</p>
                            <p className="text-xs text-muted-foreground">Property ownership documentation</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(selectedVerification.proof_of_ownership_url!, '_blank')}
                            className="hover:bg-info/10"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="hover:bg-info/10"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <p className="text-sm text-destructive">No proof of ownership submitted</p>
                      </div>
                    )}

                    {selectedVerification.additional_documents && selectedVerification.additional_documents.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground mt-2">Additional Documents ({selectedVerification.additional_documents.length})</p>
                        {selectedVerification.additional_documents.map((doc, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-info/10">
                                <FileText className="h-4 w-4 text-info" />
                              </div>
                              <p className="font-medium text-sm">Document {idx + 1}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => window.open(doc, '_blank')}
                                className="hover:bg-info/10"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="hover:bg-info/10"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Timeline */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Timeline
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <span className="font-medium">
                        {new Date(selectedVerification.submitted_at).toLocaleString('en-US', {
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
            {selectedVerification?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailsDialogOpen(false);
                    setSelectedVerification(selectedVerification);
                    setIsRejectDialogOpen(true);
                  }}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    if (selectedVerification) {
                      approveVerification(selectedVerification.id);
                      setIsDetailsDialogOpen(false);
                    }
                  }}
                  className="bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Verification
                </Button>
              </>
            )}
            {selectedVerification?.status !== 'pending' && (
              <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
                Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

