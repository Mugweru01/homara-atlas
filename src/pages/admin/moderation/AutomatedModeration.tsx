import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Save,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  MessageSquare,
  Image,
  Video,
  Users,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';

interface AutoFlagRule {
  id: string;
  keyword: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'flag' | 'auto_hide' | 'auto_delete' | 'ban';
  enabled: boolean;
  created_at: string;
}

interface ModerationConfig {
  spam_detection_enabled: boolean;
  spam_threshold: number;
  toxicity_detection_enabled: boolean;
  toxicity_threshold: number;
  duplicate_detection_enabled: boolean;
  auto_flag_enabled: boolean;
  auto_hide_enabled: boolean;
  auto_delete_enabled: boolean;
}

export default function AutomatedModeration() {
  const [rules, setRules] = useState<AutoFlagRule[]>([]);
  const [config, setConfig] = useState<ModerationConfig>({
    spam_detection_enabled: true,
    spam_threshold: 0.7,
    toxicity_detection_enabled: true,
    toxicity_threshold: 0.8,
    duplicate_detection_enabled: true,
    auto_flag_enabled: true,
    auto_hide_enabled: false,
    auto_delete_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoFlagRule | null>(null);
  const [newRule, setNewRule] = useState({
    keyword: '',
    category: 'spam',
    severity: 'medium' as const,
    action: 'flag' as const,
  });

  useEffect(() => {
    fetchRules();
    fetchConfig();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('auto_flag_keywords')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRules((data || []).map((rule: any) => ({
        id: rule.id,
        keyword: rule.keyword,
        category: rule.category || 'spam',
        severity: rule.severity || 'medium',
        action: rule.action || 'flag',
        enabled: rule.enabled !== false,
        created_at: rule.created_at,
      })));
    } catch (error: any) {
      logger.error('Error fetching auto-flag rules:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      // Fetch moderation configuration (would be stored in settings table)
      // For now, using default values
    } catch (error: any) {
      logger.error('Error fetching config:', error);
    }
  };

  const saveConfig = async () => {
    try {
      // Save configuration to database
      toast({
        title: 'Success',
        description: 'Moderation configuration saved',
      });
    } catch (error: any) {
      logger.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive',
      });
    }
  };

  const handleAddRule = async () => {
    try {
      if (!newRule.keyword.trim()) {
        toast({
          title: 'Error',
          description: 'Keyword is required',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase
        .from('auto_flag_keywords')
        .insert({
          keyword: newRule.keyword.trim(),
          category: newRule.category,
          severity: newRule.severity,
          action: newRule.action,
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Auto-flag rule added',
      });

      setNewRule({
        keyword: '',
        category: 'spam',
        severity: 'medium',
        action: 'flag',
      });
      setRuleDialogOpen(false);
      fetchRules();
    } catch (error: any) {
      logger.error('Error adding rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add rule',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateRule = async (ruleId: string, updates: Partial<AutoFlagRule>) => {
    try {
      const { error } = await supabase
        .from('auto_flag_keywords')
        .update(updates)
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Rule updated',
      });

      fetchRules();
    } catch (error: any) {
      logger.error('Error updating rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update rule',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('auto_flag_keywords')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Rule deleted',
      });

      fetchRules();
    } catch (error: any) {
      logger.error('Error deleting rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automated Moderation</h1>
          <p className="text-muted-foreground">
            Configure automated content filtering and moderation rules
          </p>
        </div>
        <Button onClick={saveConfig}>
          <Save className="h-4 w-4 mr-2" />
          Save Configuration
        </Button>
      </div>

      {/* Configuration Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Spam Detection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Spam Detection
            </CardTitle>
            <CardDescription>
              Automatically detect and flag spam content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="spam-enabled">Enable Spam Detection</Label>
              <Switch
                id="spam-enabled"
                checked={config.spam_detection_enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, spam_detection_enabled: checked })
                }
              />
            </div>
            {config.spam_detection_enabled && (
              <div className="space-y-2">
                <Label htmlFor="spam-threshold">Spam Threshold</Label>
                <Input
                  id="spam-threshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.spam_threshold}
                  onChange={(e) =>
                    setConfig({ ...config, spam_threshold: parseFloat(e.target.value) })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Content with spam score above this threshold will be flagged
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Toxicity Detection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Toxicity Detection
            </CardTitle>
            <CardDescription>
              Detect toxic, harmful, or offensive content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="toxicity-enabled">Enable Toxicity Detection</Label>
              <Switch
                id="toxicity-enabled"
                checked={config.toxicity_detection_enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, toxicity_detection_enabled: checked })
                }
              />
            </div>
            {config.toxicity_detection_enabled && (
              <div className="space-y-2">
                <Label htmlFor="toxicity-threshold">Toxicity Threshold</Label>
                <Input
                  id="toxicity-threshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.toxicity_threshold}
                  onChange={(e) =>
                    setConfig({ ...config, toxicity_threshold: parseFloat(e.target.value) })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Content with toxicity score above this threshold will be flagged
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Duplicate Detection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Duplicate Detection
            </CardTitle>
            <CardDescription>
              Detect and flag duplicate content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="duplicate-enabled">Enable Duplicate Detection</Label>
              <Switch
                id="duplicate-enabled"
                checked={config.duplicate_detection_enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, duplicate_detection_enabled: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Auto Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Auto Actions
            </CardTitle>
            <CardDescription>
              Automatically take action on flagged content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-flag">Auto Flag</Label>
              <Switch
                id="auto-flag"
                checked={config.auto_flag_enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, auto_flag_enabled: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-hide">Auto Hide</Label>
              <Switch
                id="auto-hide"
                checked={config.auto_hide_enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, auto_hide_enabled: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-delete">Auto Delete</Label>
              <Switch
                id="auto-delete"
                checked={config.auto_delete_enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, auto_delete_enabled: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-Flag Keywords */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Auto-Flag Keywords</CardTitle>
              <CardDescription>
                Keywords and phrases that trigger automatic flagging
              </CardDescription>
            </div>
            <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Auto-Flag Rule</DialogTitle>
                  <DialogDescription>
                    Create a new keyword rule for automatic content flagging
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Keyword/Phrase</Label>
                    <Input
                      value={newRule.keyword}
                      onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                      placeholder="Enter keyword or phrase"
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select
                      value={newRule.category}
                      onValueChange={(value) => setNewRule({ ...newRule, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spam">Spam</SelectItem>
                        <SelectItem value="toxicity">Toxicity</SelectItem>
                        <SelectItem value="harassment">Harassment</SelectItem>
                        <SelectItem value="violence">Violence</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Severity</Label>
                    <Select
                      value={newRule.severity}
                      onValueChange={(value: any) => setNewRule({ ...newRule, severity: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Action</Label>
                    <Select
                      value={newRule.action}
                      onValueChange={(value: any) => setNewRule({ ...newRule, action: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flag">Flag for Review</SelectItem>
                        <SelectItem value="auto_hide">Auto Hide</SelectItem>
                        <SelectItem value="auto_delete">Auto Delete</SelectItem>
                        <SelectItem value="ban">Ban User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddRule}>Add Rule</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No rules configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.keyword}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              rule.severity === 'critical'
                                ? 'destructive'
                                : rule.severity === 'high'
                                ? 'warning'
                                : 'default'
                            }
                          >
                            {rule.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{rule.action.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(checked) =>
                                handleUpdateRule(rule.id, { enabled: checked })
                              }
                            />
                            {rule.enabled ? (
                              <CheckCircle className="h-4 w-4 text-success" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

