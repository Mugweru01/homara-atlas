import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Shield,
  Smartphone,
  Network,
  Trash2,
  Plus,
  Clock,
  Bell,
  Lock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface SecurityPreferences {
  admin_id: string;
  require_2fa: boolean;
  require_ip_whitelist: boolean;
  session_timeout_minutes: number;
  allow_concurrent_sessions: boolean;
  require_password_change_days: number;
  notify_on_new_login: boolean;
  notify_on_password_change: boolean;
  notify_on_profile_change: boolean;
}

interface IPWhitelist {
  id: string;
  ip_address: string;
  ip_range: string | null;
  label: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface TrustedDevice {
  id: string;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  is_trusted: boolean;
  trusted_until: string | null;
  last_used_at: string;
  created_at: string;
}

export default function Security() {
  const [preferences, setPreferences] = useState<SecurityPreferences | null>(null);
  const [ipWhitelist, setIpWhitelist] = useState<IPWhitelist[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Add IP dialog state
  const [isAddIPOpen, setIsAddIPOpen] = useState(false);
  const [newIP, setNewIP] = useState('');
  const [newIPLabel, setNewIPLabel] = useState('');
  const [currentIP, setCurrentIP] = useState<string>('');

  // Fetch current IP on mount
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setCurrentIP(data.ip))
      .catch(() => setCurrentIP(''));
  }, []);

  const fetchData = async () => {
    try {
      // Get security preferences
      const { data: prefsData, error: prefsError } = await supabase
        .rpc('get_admin_security_preferences');

      if (prefsError) throw prefsError;
      
      if (prefsData && prefsData.length > 0) {
        setPreferences(prefsData[0]);
      }

      // Get IP whitelist
      const { data: ipData, error: ipError } = await supabase
        .rpc('get_ip_whitelist');

      if (ipError) throw ipError;
      setIpWhitelist(ipData || []);

      // Get trusted devices
      const { data: devicesData, error: devicesError } = await supabase
        .rpc('get_trusted_devices');

      if (devicesError) throw devicesError;
      setTrustedDevices(devicesData || []);

    } catch (error: any) {
      console.error('Error fetching security data:', error);
      toast.error('Failed to load security settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdatePreferences = async (updates: Partial<SecurityPreferences>) => {
    setIsSaving(true);
    try {
      // Build params object, only including defined values
      const params: any = {};
      if (updates.require_2fa !== undefined) params.p_require_2fa = updates.require_2fa;
      if (updates.require_ip_whitelist !== undefined) params.p_require_ip_whitelist = updates.require_ip_whitelist;
      if (updates.session_timeout_minutes !== undefined) params.p_session_timeout_minutes = updates.session_timeout_minutes;
      if (updates.allow_concurrent_sessions !== undefined) params.p_allow_concurrent_sessions = updates.allow_concurrent_sessions;
      if (updates.require_password_change_days !== undefined) params.p_require_password_change_days = updates.require_password_change_days;
      if (updates.notify_on_new_login !== undefined) params.p_notify_on_new_login = updates.notify_on_new_login;
      if (updates.notify_on_password_change !== undefined) params.p_notify_on_password_change = updates.notify_on_password_change;
      if (updates.notify_on_profile_change !== undefined) params.p_notify_on_profile_change = updates.notify_on_profile_change;

      const { data, error } = await supabase.rpc('update_admin_security_preferences', params);

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      console.log('Update response:', data);
      toast.success('Security preferences updated');
      fetchData();
    } catch (error: any) {
      console.error('Error updating preferences:', error);
      toast.error(error.message || 'Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddIP = async () => {
    if (!newIP) {
      toast.error('Please enter an IP address');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('add_ip_to_whitelist', {
        p_ip_address: newIP,
        p_label: newIPLabel || null,
      });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      if (data && !data.success) {
        toast.error(data.error || 'Failed to add IP address');
        return;
      }

      toast.success('IP address added to whitelist');
      setIsAddIPOpen(false);
      setNewIP('');
      setNewIPLabel('');
      fetchData();
    } catch (error: any) {
      console.error('Error adding IP:', error);
      toast.error(error.message || 'Failed to add IP address');
    }
  };

  const handleRemoveIP = async (ipId: string) => {
    try {
      const { data, error } = await supabase.rpc('remove_ip_from_whitelist', {
        p_whitelist_id: ipId,
      });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      if (data && !data.success) {
        toast.error(data.error || 'Failed to remove IP address');
        return;
      }

      toast.success('IP address removed from whitelist');
      fetchData();
    } catch (error: any) {
      console.error('Error removing IP:', error);
      toast.error(error.message || 'Failed to remove IP address');
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    try {
      const { data, error } = await supabase.rpc('revoke_trusted_device', {
        p_device_id: deviceId,
      });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      if (data && !data.success) {
        toast.error(data.error || 'Failed to revoke device');
        return;
      }

      toast.success('Device trust revoked');
      fetchData();
    } catch (error: any) {
      console.error('Error revoking device:', error);
      toast.error(error.message || 'Failed to revoke device');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your admin account security preferences and access controls
        </p>
      </div>

      {/* Security Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Preferences
          </CardTitle>
          <CardDescription>
            Configure your account security settings and authentication requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 2FA Requirement */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Require Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require 2FA for all login attempts
              </p>
            </div>
            <Switch
              checked={preferences?.require_2fa || false}
              onCheckedChange={(checked) => handleUpdatePreferences({ require_2fa: checked })}
              disabled={isSaving}
            />
          </div>

          {/* IP Whitelist Requirement */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Require IP Whitelist</Label>
              <p className="text-sm text-muted-foreground">
                Only allow login from whitelisted IP addresses
              </p>
            </div>
            <Switch
              checked={preferences?.require_ip_whitelist || false}
              onCheckedChange={(checked) => handleUpdatePreferences({ require_ip_whitelist: checked })}
              disabled={isSaving}
            />
          </div>

          {/* Concurrent Sessions */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Allow Concurrent Sessions</Label>
              <p className="text-sm text-muted-foreground">
                Allow multiple active sessions simultaneously
              </p>
            </div>
            <Switch
              checked={preferences?.allow_concurrent_sessions || false}
              onCheckedChange={(checked) => handleUpdatePreferences({ allow_concurrent_sessions: checked })}
              disabled={isSaving}
            />
          </div>

          {/* Session Timeout */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Session Timeout (minutes)
            </Label>
            <Input
              type="number"
              value={preferences?.session_timeout_minutes || 480}
              onChange={(e) => handleUpdatePreferences({ session_timeout_minutes: parseInt(e.target.value) })}
              min={30}
              max={1440}
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground">
              Automatically log out after this period of inactivity (30-1440 minutes)
            </p>
          </div>

          {/* Password Change Requirement */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Require Password Change (days)
            </Label>
            <Input
              type="number"
              value={preferences?.require_password_change_days || 90}
              onChange={(e) => handleUpdatePreferences({ require_password_change_days: parseInt(e.target.value) })}
              min={30}
              max={365}
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground">
              Require password change every N days (30-365)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Security Notifications
          </CardTitle>
          <CardDescription>
            Get notified about important security events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New Login Detected</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when you log in from a new device or location
              </p>
            </div>
            <Switch
              checked={preferences?.notify_on_new_login || false}
              onCheckedChange={(checked) => handleUpdatePreferences({ notify_on_new_login: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Password Changes</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when your password is changed
              </p>
            </div>
            <Switch
              checked={preferences?.notify_on_password_change || false}
              onCheckedChange={(checked) => handleUpdatePreferences({ notify_on_password_change: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Profile Changes</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when your profile information is updated
              </p>
            </div>
            <Switch
              checked={preferences?.notify_on_profile_change || false}
              onCheckedChange={(checked) => handleUpdatePreferences({ notify_on_profile_change: checked })}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* IP Whitelist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                IP Whitelist
              </CardTitle>
              <CardDescription>
                Manage allowed IP addresses for admin access
              </CardDescription>
            </div>
            <Dialog open={isAddIPOpen} onOpenChange={setIsAddIPOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add IP Address
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add IP Address to Whitelist</DialogTitle>
                  <DialogDescription>
                    Add a new IP address or range to your whitelist
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {currentIP && (
                    <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Your Current IP</p>
                        <p className="text-xs text-muted-foreground font-mono">{currentIP}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewIP(currentIP);
                          setNewIPLabel('Current Location');
                        }}
                      >
                        Use This IP
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="ip-address">IP Address</Label>
                    <Input
                      id="ip-address"
                      placeholder="192.168.1.1 or 192.168.1.0/24"
                      value={newIP}
                      onChange={(e) => setNewIP(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter a single IP address or CIDR range
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ip-label">Label (Optional)</Label>
                    <Input
                      id="ip-label"
                      placeholder="Home, Office, etc."
                      value={newIPLabel}
                      onChange={(e) => setNewIPLabel(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddIPOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddIP}>Add IP Address</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {preferences?.require_ip_whitelist && ipWhitelist.length === 0 && (
            <div className="flex items-start gap-2 p-4 mb-4 border border-yellow-300 bg-yellow-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900">IP Whitelist Required</p>
                <p className="text-sm text-yellow-700 mt-1">
                  You have enabled IP whitelist requirement but haven't added any IP addresses. 
                  Add at least one IP address to prevent being locked out.
                </p>
              </div>
            </div>
          )}

          {ipWhitelist.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ipWhitelist.map((ip) => (
                  <TableRow key={ip.id}>
                    <TableCell className="font-mono text-sm">
                      {ip.ip_address}
                    </TableCell>
                    <TableCell>{ip.label || '-'}</TableCell>
                    <TableCell>
                      {ip.is_active ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ip.last_used_at 
                        ? formatDistanceToNow(new Date(ip.last_used_at), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(ip.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveIP(ip.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No IP addresses in whitelist</p>
              <p className="text-sm mt-1">Add IP addresses to restrict access</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trusted Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Trusted Devices
          </CardTitle>
          <CardDescription>
            Devices that have been authenticated with 2FA
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trustedDevices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trustedDevices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {device.device_name || 'Unknown Device'}
                        </p>
                        {device.user_agent && (
                          <p className="text-xs text-muted-foreground truncate max-w-md">
                            {device.user_agent}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {device.ip_address || '-'}
                    </TableCell>
                    <TableCell>
                      {device.is_trusted ? (
                        <Badge variant="default">Trusted</Badge>
                      ) : (
                        <Badge variant="destructive">Revoked</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(device.last_used_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(device.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {device.is_trusted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevokeDevice(device.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No trusted devices</p>
              <p className="text-sm mt-1">Devices will appear here after 2FA authentication</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

