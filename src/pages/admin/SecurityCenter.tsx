import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, AlertTriangle, CheckCircle, Lock, Unlock, Key,
  RefreshCw, XCircle, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface PasswordPolicy {
  id: string;
  policy_name: string;
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  max_age_days: number;
  prevent_reuse_count: number;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  enforce_for_admins: boolean;
  enforce_for_users: boolean;
}

interface SecurityScan {
  id: string;
  scan_type: string;
  severity: string;
  title: string;
  description: string;
  affected_count: number;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

interface FailedAttempt {
  ip_address: string;
  email: string;
  attempt_count: number;
  last_attempt: string;
  is_locked_out: boolean;
}

interface LockoutStats {
  currently_locked: number;
  locked_today: number;
  total_this_week: number;
  avg_duration_minutes: number;
}

export default function SecurityCenter() {
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [scans, setScans] = useState<SecurityScan[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedAttempt[]>([]);
  const [lockoutStats, setLockoutStats] = useState<LockoutStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchPasswordPolicy(),
        fetchSecurityScans(),
        fetchFailedAttempts(),
        fetchLockoutStats(),
      ]);
    } catch (error: any) {
      console.error('Error fetching security data:', error);
      toast.error('Failed to load security data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPasswordPolicy = async () => {
    const { data, error } = await supabase.rpc('get_active_password_policy');
    if (error) throw error;
    setPolicy(data);
  };

  const fetchSecurityScans = async () => {
    const { data, error } = await supabase.rpc('get_security_scan_history', { p_limit: 20 });
    if (error) throw error;
    setScans(data || []);
  };

  const fetchFailedAttempts = async () => {
    const { data, error } = await supabase.rpc('get_failed_login_attempts', { p_hours: 24 });
    if (error) throw error;
    setFailedAttempts(data || []);
  };

  const fetchLockoutStats = async () => {
    const { data, error } = await supabase.rpc('get_lockout_statistics');
    if (error) throw error;
    setLockoutStats(data);
  };

  const handleRunSecurityScan = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.rpc('run_security_scan');
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`Security scan complete. Found ${data.issues_found} issues.`);
        await fetchSecurityScans();
      } else {
        toast.error(data.error || 'Failed to run security scan');
      }
    } catch (error: any) {
      console.error('Error running security scan:', error);
      toast.error('Failed to run security scan');
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpdatePolicy = async () => {
    if (!policy) return;
    
    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc('update_password_policy', {
        p_policy: policy as any
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success('Password policy updated successfully');
      } else {
        toast.error(data.error || 'Failed to update policy');
      }
    } catch (error: any) {
      console.error('Error updating policy:', error);
      toast.error('Failed to update password policy');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolveIssue = async (scanId: string, status: string) => {
    try {
      const { data, error } = await supabase.rpc('resolve_security_issue', {
        p_scan_id: scanId,
        p_status: status
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(data.message);
        await fetchSecurityScans();
      } else {
        toast.error(data.error || 'Failed to resolve issue');
      }
    } catch (error: any) {
      console.error('Error resolving issue:', error);
      toast.error('Failed to resolve security issue');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Security Center
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage password policies, security scans, and account lockouts
        </p>
      </div>

      {/* Lockout Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Locked</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {lockoutStats?.currently_locked || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locked Today</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lockoutStats?.locked_today || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lockoutStats?.total_this_week || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(lockoutStats?.avg_duration_minutes || 0)}m
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="policy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="policy">Password Policy</TabsTrigger>
          <TabsTrigger value="scans">Security Scans</TabsTrigger>
          <TabsTrigger value="attempts">Failed Attempts</TabsTrigger>
        </TabsList>

        {/* Password Policy Tab */}
        <TabsContent value="policy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Password Policy Configuration
              </CardTitle>
              <CardDescription>
                Set password requirements and security rules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {policy && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="min_length">Minimum Length</Label>
                      <Input
                        id="min_length"
                        type="number"
                        value={policy.min_length}
                        onChange={(e) => setPolicy({ ...policy, min_length: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max_age">Password Max Age (days)</Label>
                      <Input
                        id="max_age"
                        type="number"
                        value={policy.max_age_days}
                        onChange={(e) => setPolicy({ ...policy, max_age_days: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prevent_reuse">Prevent Reuse (last N passwords)</Label>
                      <Input
                        id="prevent_reuse"
                        type="number"
                        value={policy.prevent_reuse_count}
                        onChange={(e) => setPolicy({ ...policy, prevent_reuse_count: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max_attempts">Max Login Attempts</Label>
                      <Input
                        id="max_attempts"
                        type="number"
                        value={policy.max_login_attempts}
                        onChange={(e) => setPolicy({ ...policy, max_login_attempts: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lockout_duration">Lockout Duration (minutes)</Label>
                      <Input
                        id="lockout_duration"
                        type="number"
                        value={policy.lockout_duration_minutes}
                        onChange={(e) => setPolicy({ ...policy, lockout_duration_minutes: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="uppercase">Require Uppercase Letters</Label>
                      <Switch
                        id="uppercase"
                        checked={policy.require_uppercase}
                        onCheckedChange={(checked) => setPolicy({ ...policy, require_uppercase: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="lowercase">Require Lowercase Letters</Label>
                      <Switch
                        id="lowercase"
                        checked={policy.require_lowercase}
                        onCheckedChange={(checked) => setPolicy({ ...policy, require_lowercase: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="numbers">Require Numbers</Label>
                      <Switch
                        id="numbers"
                        checked={policy.require_numbers}
                        onCheckedChange={(checked) => setPolicy({ ...policy, require_numbers: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="special">Require Special Characters</Label>
                      <Switch
                        id="special"
                        checked={policy.require_special_chars}
                        onCheckedChange={(checked) => setPolicy({ ...policy, require_special_chars: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="admins">Enforce for Admins</Label>
                      <Switch
                        id="admins"
                        checked={policy.enforce_for_admins}
                        onCheckedChange={(checked) => setPolicy({ ...policy, enforce_for_admins: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="users">Enforce for Users</Label>
                      <Switch
                        id="users"
                        checked={policy.enforce_for_users}
                        onCheckedChange={(checked) => setPolicy({ ...policy, enforce_for_users: checked })}
                      />
                    </div>
                  </div>

                  <Button onClick={handleUpdatePolicy} disabled={isSaving} className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Update Policy'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Scans Tab */}
        <TabsContent value="scans" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Security Scans</h3>
              <p className="text-sm text-muted-foreground">
                Automated security vulnerability detection
              </p>
            </div>
            <Button onClick={handleRunSecurityScan} disabled={isScanning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning...' : 'Run Scan'}
            </Button>
          </div>

          <div className="space-y-3">
            {scans.length > 0 ? (
              scans.map((scan) => (
                <Card key={scan.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={getSeverityColor(scan.severity)}>
                            <span className="flex items-center gap-1">
                              {getSeverityIcon(scan.severity)}
                              {scan.severity.toUpperCase()}
                            </span>
                          </Badge>
                          <Badge variant="outline">{scan.scan_type.replace('_', ' ')}</Badge>
                          {scan.status === 'resolved' && (
                            <Badge variant="secondary">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                        </div>

                        <h4 className="font-medium mb-1">{scan.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2">{scan.description}</p>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Affected: {scan.affected_count}</span>
                          <span>
                            {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      {scan.status === 'open' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveIssue(scan.id, 'resolved')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveIssue(scan.id, 'false_positive')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-20 text-green-600" />
                  <p className="text-muted-foreground">No security scans found</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Run a scan to check for security issues
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Failed Attempts Tab */}
        <TabsContent value="attempts" className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Failed Login Attempts (Last 24 Hours)</h3>
            <p className="text-sm text-muted-foreground">
              Monitor suspicious login activity
            </p>
          </div>

          <div className="space-y-3">
            {failedAttempts.length > 0 ? (
              failedAttempts.map((attempt, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{attempt.email}</div>
                        <div className="text-sm text-muted-foreground">
                          IP: {attempt.ip_address}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(attempt.last_attempt), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-bold text-red-600">{attempt.attempt_count}</div>
                          <div className="text-sm text-muted-foreground">attempts</div>
                        </div>
                        {attempt.is_locked_out && (
                          <Badge variant="destructive">
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-20 text-green-600" />
                  <p className="text-muted-foreground">No failed login attempts</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your system is secure!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

