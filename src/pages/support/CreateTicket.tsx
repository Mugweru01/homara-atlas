import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft,
  Send,
  AlertCircle,
  FileText,
  Bug,
  Lightbulb,
  CreditCard,
  Settings,
  HelpCircle,
  Paperclip,
  X,
} from 'lucide-react';
import { logger } from '@/lib/production-logger';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'react-router-dom';

const ticketTypes = [
  { value: 'support', label: 'General Support', icon: HelpCircle },
  { value: 'bug', label: 'Bug Report', icon: Bug },
  { value: 'feature_request', label: 'Feature Request', icon: Lightbulb },
  { value: 'billing', label: 'Billing Issue', icon: CreditCard },
  { value: 'technical', label: 'Technical Issue', icon: Settings },
];

const categories = [
  'Account',
  'Booking',
  'Payment',
  'Property',
  'Technical',
  'Other',
];

interface FileAttachment {
  file: File;
  preview?: string;
  uploading?: boolean;
  uploaded?: boolean;
  url?: string;
}

export default function CreateTicket() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    ticket_type: 'support',
    category: '',
    priority: 'normal',
  });
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = files.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      uploading: false,
      uploaded: false,
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    const attachment = attachments[index];
    if (attachment.preview) {
      URL.revokeObjectURL(attachment.preview);
    }
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.title.trim() || !form.description.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to create a ticket',
          variant: 'destructive',
        });
        navigate('/admin/login');
        return;
      }

      // Create ticket first
      const { data: ticketData, error: ticketError } = await supabase
        .from('homaradesk_tickets')
        .insert({
          title: form.title,
          description: form.description,
          ticket_type: form.ticket_type,
          category: form.category || null,
          priority: form.priority,
          requester_id: user.id,
          source: 'web',
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Upload attachments if any
      const uploadedFiles: string[] = [];
      if (attachments.length > 0) {
        for (let i = 0; i < attachments.length; i++) {
          const attachment = attachments[i];
          try {
            const fileExt = attachment.file.name.split('.').pop();
            const fileName = `${ticketData.id}/${Date.now()}-${i}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('ticket-attachments')
              .upload(fileName, attachment.file);

            if (uploadError) {
              logger.error('Error uploading file:', uploadError);
              continue;
            }

            const { data: urlData } = supabase.storage
              .from('ticket-attachments')
              .getPublicUrl(fileName);

            if (urlData?.publicUrl) {
              uploadedFiles.push(urlData.publicUrl);
            }
          } catch (fileError) {
            logger.error('Error processing file:', fileError);
          }
        }

        // If files were uploaded, add them to the first comment
        if (uploadedFiles.length > 0) {
          await supabase
            .from('homaradesk_ticket_comments')
            .insert({
              ticket_id: ticketData.id,
              content: 'Files attached with ticket creation',
              author_id: user.id,
              author_type: 'user',
              is_internal: false,
              is_public: true,
              attachments: uploadedFiles.map(url => ({ url, name: attachments.find((_, i) => uploadedFiles.indexOf(url) === i)?.file.name || 'file' })),
            });
        }
      }

      toast({
        title: 'Success',
        description: `Ticket ${ticketData.ticket_number} created successfully`,
      });

      navigate(`/support/tickets/${ticketData.id}`);
    } catch (error: any) {
      logger.error('Error creating ticket:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create ticket',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedType = ticketTypes.find(t => t.value === form.ticket_type);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/support/tickets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Support Ticket</h1>
          <p className="text-muted-foreground">
            Describe your issue and we'll help you resolve it
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Ticket Information</CardTitle>
            <CardDescription>
              Provide details about your issue or request
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Ticket Type */}
            <div>
              <Label>What type of issue is this? *</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
                {ticketTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setForm({ ...form, ticket_type: type.value })}
                      className={`p-4 border rounded-lg text-left transition-all ${
                        form.ticket_type === type.value
                          ? 'border-primary bg-primary/5 ring-2 ring-primary'
                          : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-2 ${
                        form.ticket_type === type.value ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                      <div className="text-sm font-medium">{type.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <Label htmlFor="title">Subject *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Brief description of your issue"
                className="mt-1"
                maxLength={255}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {form.title.length}/255 characters
              </p>
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="category">Category (Optional)</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
              >
                <SelectTrigger id="category" className="mt-1">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat.toLowerCase()}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Please provide as much detail as possible about your issue..."
                rows={8}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Include steps to reproduce, error messages, or any other relevant information
              </p>
            </div>

            {/* File Attachments */}
            <div>
              <Label>Attachments (Optional)</Label>
              <div className="mt-2 space-y-2">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  ref={fileInputRef}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  Add Files
                </Button>
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50"
                      >
                        {attachment.preview ? (
                          <img
                            src={attachment.preview}
                            alt={attachment.file.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <FileText className="h-10 w-10 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(attachment.file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Upload screenshots, documents, or other files that might help us understand your issue
              </p>
            </div>

            {/* Priority */}
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm({ ...form, priority: value })}
              >
                <SelectTrigger id="priority" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Not urgent</SelectItem>
                  <SelectItem value="normal">Normal - Standard priority</SelectItem>
                  <SelectItem value="high">High - Important</SelectItem>
                  <SelectItem value="urgent">Urgent - Needs immediate attention</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Help Text */}
            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Tips for faster resolution:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Be specific and include all relevant details</li>
                    <li>Include error messages if applicable</li>
                    <li>Mention what you were trying to do when the issue occurred</li>
                    <li>Attach screenshots if helpful (you can add these after creating the ticket)</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link to="/support/tickets">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading || !form.title.trim() || !form.description.trim()}>
            {loading ? (
              <>
                <Send className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Create Ticket
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

