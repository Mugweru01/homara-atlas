import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
  Mail,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';

interface EmailTemplate {
  id: string;
  template_name: string;
  template_key: string;
  subject: string;
  body_html: string;
  body_text?: string;
  variables?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function EmailTemplates() {
  const permissions = usePermissions();
  
  if (!permissions.canViewEmailTemplates) {
    return null; // ProtectedRoute will handle redirect
  }
  
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({
    template_name: '',
    template_key: '',
    subject: '',
    body_html: '',
    body_text: '',
    variables: '',
    is_active: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('template_name');

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116' || 
            error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          setTemplates([]);
          return;
        }
        throw error;
      }

      setTemplates(data || []);
    } catch (error: any) {
      logger.error('Error fetching email templates:', error);
      console.error('Templates fetch error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch templates',
        variant: 'destructive',
      });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setForm({
      template_name: '',
      template_key: '',
      subject: '',
      body_html: '',
      body_text: '',
      variables: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setForm({
      template_name: template.template_name,
      template_key: template.template_key,
      subject: template.subject,
      body_html: template.body_html,
      body_text: template.body_text || '',
      variables: Array.isArray(template.variables) ? template.variables.join(', ') : '',
      is_active: template.is_active,
    });
    setDialogOpen(true);
  };

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    setPreviewDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const templateData: any = {
        template_name: form.template_name,
        template_key: form.template_key,
        subject: form.subject,
        body_html: form.body_html,
        body_text: form.body_text || null,
        variables: form.variables ? form.variables.split(',').map(v => v.trim()).filter(Boolean) : null,
        is_active: form.is_active,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Template updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert(templateData);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Template created successfully',
        });
      }

      setDialogOpen(false);
      fetchTemplates();
    } catch (error: any) {
      logger.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save template',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });

      fetchTemplates();
    } catch (error: any) {
      logger.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete template',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-muted-foreground">
            Manage email templates for ticket notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchTemplates} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreateTemplate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Email Templates:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Use variables like {'{{ticket_number}}'}, {'{{customer_name}}'}, {'{{ticket_url}}'}</li>
                <li>Templates are used for ticket creation, updates, and responses</li>
                <li>HTML templates support rich formatting</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Templates ({templates.length})</CardTitle>
          <CardDescription>
            Email templates for automated ticket communications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No email templates configured</p>
              <p className="text-sm mt-2">
                Create your first template for ticket notifications
              </p>
              <Button onClick={handleCreateTemplate} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="font-medium">{template.template_name}</div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {template.template_key}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md truncate text-sm">
                          {template.subject}
                        </div>
                      </TableCell>
                      <TableCell>
                        {Array.isArray(template.variables) && template.variables.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {template.variables.slice(0, 3).map((varName, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {varName}
                              </Badge>
                            ))}
                            {template.variables.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{template.variables.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {template.is_active ? (
                          <Badge variant="default">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(template.updated_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreviewTemplate(template)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Email Template' : 'Create Email Template'}
            </DialogTitle>
            <DialogDescription>
              Create email templates with variable placeholders
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template_name">Template Name *</Label>
                <Input
                  id="template_name"
                  value={form.template_name}
                  onChange={(e) => setForm({ ...form, template_name: e.target.value })}
                  placeholder="e.g., Ticket Created Notification"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="template_key">Template Key *</Label>
                <Input
                  id="template_key"
                  value={form.template_key}
                  onChange={(e) => setForm({ ...form, template_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="e.g., ticket_created"
                  className="mt-1"
                  disabled={!!editingTemplate}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier (cannot be changed)
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g., Ticket {{ticket_number}} has been created"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="body_html">HTML Body *</Label>
              <Textarea
                id="body_html"
                value={form.body_html}
                onChange={(e) => setForm({ ...form, body_html: e.target.value })}
                placeholder="<html>...</html>"
                rows={12}
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <Label htmlFor="body_text">Plain Text Body (Optional)</Label>
              <Textarea
                id="body_text"
                value={form.body_text}
                onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                placeholder="Plain text version"
                rows={6}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="variables">Variables (comma-separated)</Label>
              <Input
                id="variables"
                value={form.variables}
                onChange={(e) => setForm({ ...form, variables: e.target.value })}
                placeholder="ticket_number, customer_name, ticket_url"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                List variables used in template (for documentation)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Template is active
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!form.template_name.trim() || !form.template_key.trim() || !form.subject.trim() || !form.body_html.trim()}>
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview: {previewTemplate?.template_name}</DialogTitle>
            <DialogDescription>
              Preview of email template
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Subject</Label>
                <div className="mt-1 p-3 bg-muted rounded-lg">
                  {previewTemplate.subject}
                </div>
              </div>
              <div>
                <Label>HTML Body</Label>
                <div 
                  className="mt-1 p-4 bg-muted rounded-lg border"
                  dangerouslySetInnerHTML={{ __html: previewTemplate.body_html }}
                />
              </div>
              {previewTemplate.body_text && (
                <div>
                  <Label>Plain Text Body</Label>
                  <div className="mt-1 p-3 bg-muted rounded-lg whitespace-pre-wrap">
                    {previewTemplate.body_text}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

