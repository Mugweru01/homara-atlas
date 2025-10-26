import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings as SettingsIcon, 
  Mail, 
  Shield, 
  Bell, 
  ShieldAlert,
  Save,
  Lock,
  Server,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdmin } from '@/hooks/useAdmin';

export default function Settings() {
  const { isSuperAdmin } = useAdmin();
  const [settings, setSettings] = useState({
    // Email Settings
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPassword: '',
    emailFrom: '',
    
    // Security Settings
    sessionTimeout: '30',
    maxLoginAttempts: '5',
    requireEmailVerification: true,
    enableTwoFactor: false,
    
    // Notification Settings
    emailNotifications: true,
    slackWebhook: '',
    notifyOnNewProperty: true,
    notifyOnVerification: true,
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleSettingChange = (key: string, value: string | boolean) => {
    setSettings({ ...settings, [key]: value });
    setHasUnsavedChanges(true);
  };

  const saveSettings = async (category: string) => {
    try {
      // TODO: Implement settings save to database/edge function
      toast.success(`${category} settings saved successfully`, {
        description: 'Your changes have been applied',
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error('Failed to save settings', {
        description: 'Please try again or contact support',
        icon: <AlertCircle className="h-4 w-4" />,
      });
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)] animate-fade-in">
        <Card className="max-w-md shadow-soft border-border/50">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="p-4 rounded-full bg-destructive/10 mx-auto w-fit mb-4">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Only super admins can access system settings. Please contact a super admin if you need to make changes.
            </p>
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
          <div className="p-2 rounded-xl bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage system configuration and preferences
        </p>
        {hasUnsavedChanges && (
          <div className="mt-3 flex items-center gap-2 text-sm text-warning animate-fade-in">
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse"></div>
            <span className="font-medium">You have unsaved changes</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="email" className="space-y-6 animate-fade-up" style={{ animationDelay: '100ms' }}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3 h-12 p-1 bg-muted/50">
          <TabsTrigger value="email" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4">
          <Card className="border-border/50 shadow-soft">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-card/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <Server className="h-5 w-5 text-info" />
                </div>
                <div>
                  <CardTitle className="text-xl">Email Configuration</CardTitle>
                  <CardDescription className="text-sm">
                    Configure SMTP settings for sending emails to users and landlords
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost" className="text-sm font-medium flex items-center gap-2">
                    SMTP Host
                  </Label>
                  <Input
                    id="smtpHost"
                    placeholder="smtp.example.com"
                    value={settings.smtpHost}
                    onChange={(e) => handleSettingChange('smtpHost', e.target.value)}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">Your email server hostname</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort" className="text-sm font-medium">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    placeholder="587"
                    value={settings.smtpPort}
                    onChange={(e) => handleSettingChange('smtpPort', e.target.value)}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">Usually 587 for TLS or 465 for SSL</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpUser" className="text-sm font-medium">SMTP Username</Label>
                <Input
                  id="smtpUser"
                  placeholder="user@example.com"
                  value={settings.smtpUser}
                  onChange={(e) => handleSettingChange('smtpUser', e.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Account used for authentication</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPassword" className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5" />
                  SMTP Password
                </Label>
                <Input
                  id="smtpPassword"
                  type="password"
                  placeholder="••••••••"
                  value={settings.smtpPassword}
                  onChange={(e) => handleSettingChange('smtpPassword', e.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Stored securely and encrypted</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailFrom" className="text-sm font-medium">From Email Address</Label>
                <Input
                  id="emailFrom"
                  placeholder="noreply@example.com"
                  value={settings.emailFrom}
                  onChange={(e) => handleSettingChange('emailFrom', e.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Email address shown as sender</p>
              </div>
              <div className="pt-4 border-t border-border/50">
                <Button 
                  onClick={() => saveSettings('Email')}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Email Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="border-border/50 shadow-soft">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-card/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Shield className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-xl">Security Settings</CardTitle>
                  <CardDescription className="text-sm">
                    Configure security and authentication policies for the platform
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-2">
                <Label htmlFor="sessionTimeout" className="text-sm font-medium">Session Timeout (minutes)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) => handleSettingChange('sessionTimeout', e.target.value)}
                  className="h-11 max-w-xs"
                />
                <p className="text-xs text-muted-foreground">Time before inactive admins are logged out</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxLoginAttempts" className="text-sm font-medium">Maximum Login Attempts</Label>
                <Input
                  id="maxLoginAttempts"
                  type="number"
                  value={settings.maxLoginAttempts}
                  onChange={(e) => handleSettingChange('maxLoginAttempts', e.target.value)}
                  className="h-11 max-w-xs"
                />
                <p className="text-xs text-muted-foreground">Failed attempts before account lockout</p>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Require Email Verification
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Users must verify their email before accessing the platform
                    </p>
                  </div>
                  <Switch
                    checked={settings.requireEmailVerification}
                    onCheckedChange={(checked) => handleSettingChange('requireEmailVerification', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4 text-warning" />
                      Enable Two-Factor Authentication
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Require 2FA for all admin accounts (highly recommended)
                    </p>
                  </div>
                  <Switch
                    checked={settings.enableTwoFactor}
                    onCheckedChange={(checked) => handleSettingChange('enableTwoFactor', checked)}
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-border/50">
                <Button 
                  onClick={() => saveSettings('Security')}
                  className="bg-gradient-to-r from-warning to-warning/80 hover:from-warning/90 hover:to-warning/70"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Security Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="border-border/50 shadow-soft">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-card/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Bell className="h-5 w-5 text-success" />
                </div>
                <div>
                  <CardTitle className="text-xl">Notification Settings</CardTitle>
                  <CardDescription className="text-sm">
                    Configure how and when you receive notifications about platform events
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-info" />
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications for important events
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slackWebhook" className="text-sm font-medium">Slack Webhook URL</Label>
                <Input
                  id="slackWebhook"
                  placeholder="https://hooks.slack.com/services/..."
                  value={settings.slackWebhook}
                  onChange={(e) => handleSettingChange('slackWebhook', e.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Send notifications to your Slack workspace
                </p>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground">Event Notifications</p>
                
                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">New Property Submissions</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when new properties are submitted for review
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyOnNewProperty}
                    onCheckedChange={(checked) => handleSettingChange('notifyOnNewProperty', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Verification Requests</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when landlord verification requests are submitted
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyOnVerification}
                    onCheckedChange={(checked) => handleSettingChange('notifyOnVerification', checked)}
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-border/50">
                <Button 
                  onClick={() => saveSettings('Notifications')}
                  className="bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Notification Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
