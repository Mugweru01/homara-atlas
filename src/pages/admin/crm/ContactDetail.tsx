import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar,
  User,
  Tag,
  FileText,
  Plus,
  Trash2,
  Pin,
  Lock,
  Clock,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { ContactActivityTimeline } from '@/components/crm/ContactActivityTimeline';

interface CRMContact {
  id: string;
  user_id: string | null;
  contact_type: 'user' | 'lead' | 'prospect' | 'customer';
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postal_code: string | null;
  country: string | null;
  status: 'active' | 'inactive' | 'archived' | 'duplicate';
  source: string | null;
  assigned_to: string | null;
  notes: string | null;
  custom_fields: Record<string, any> | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface ContactNote {
  id: string;
  note_type: string;
  title: string | null;
  content: string;
  is_pinned: boolean;
  is_private: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ContactTag {
  id: string;
  name: string;
  color: string;
  category: string | null;
  description: string | null;
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<CRMContact | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [allTags, setAllTags] = useState<ContactTag[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [addNoteDialogOpen, setAddNoteDialogOpen] = useState(false);
  const [assignTagDialogOpen, setAssignTagDialogOpen] = useState(false);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  
  // Form states
  const [editForm, setEditForm] = useState<Partial<CRMContact>>({});
  const [newNote, setNewNote] = useState({
    note_type: 'general',
    title: '',
    content: '',
    is_pinned: false,
    is_private: false,
  });

  useEffect(() => {
    if (id) {
      fetchContactDetails();
      fetchAllTags();
      fetchCustomFieldDefinitions();
    }
  }, [id]);

  const fetchContactDetails = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_contact_details' as any, {
        p_contact_id: id,
      });

      if (error) throw error;

      if (data) {
        setContact(data.contact as CRMContact);
        setNotes(data.notes || []);
        setTags(data.tags || []);
        setEditForm(data.contact as Partial<CRMContact>);
        setCustomFieldValues((data.contact as any).custom_fields || {});
      }
    } catch (error: any) {
      logger.error('Error fetching contact details', { error });
      toast.error('Failed to load contact details');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTags = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_tags' as any);

      if (error) throw error;

      setAllTags(data || []);
    } catch (error: any) {
      logger.error('Error fetching tags', { error });
    }
  };

  const fetchCustomFieldDefinitions = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_custom_field_definitions' as any);

      if (error) throw error;

      setCustomFields(data || []);
    } catch (error: any) {
      logger.error('Error fetching custom field definitions', { error });
    }
  };

  const handleUpdateContact = async () => {
    if (!contact || !id) return;

    try {
      const { error } = await supabase.rpc('update_contact' as any, {
        p_contact_id: id,
        p_first_name: editForm.first_name || null,
        p_last_name: editForm.last_name || null,
        p_email: editForm.email || null,
        p_phone: editForm.phone || null,
        p_company_name: editForm.company_name || null,
        p_status: editForm.status || null,
        p_contact_type: editForm.contact_type || null,
        p_assigned_to: editForm.assigned_to || null,
        p_notes: editForm.notes || null,
        p_custom_fields: editForm.custom_fields || null,
      });

      if (error) throw error;

      toast.success('Contact updated successfully');
      setEditMode(false);
      fetchContactDetails();
    } catch (error: any) {
      logger.error('Error updating contact', { error });
      toast.error(error?.message || 'Failed to update contact');
    }
  };

  const handleAddNote = async () => {
    if (!id || !newNote.content.trim()) {
      toast.error('Note content is required');
      return;
    }

    try {
      const { error } = await supabase.rpc('add_contact_note' as any, {
        p_contact_id: id,
        p_note_type: newNote.note_type,
        p_title: newNote.title || null,
        p_content: newNote.content,
        p_is_pinned: newNote.is_pinned,
        p_is_private: newNote.is_private,
      });

      if (error) throw error;

      toast.success('Note added successfully');
      setAddNoteDialogOpen(false);
      setNewNote({
        note_type: 'general',
        title: '',
        content: '',
        is_pinned: false,
        is_private: false,
      });
      fetchContactDetails();
    } catch (error: any) {
      logger.error('Error adding note', { error });
      toast.error('Failed to add note');
    }
  };

  const handleAssignTag = async (tagId: string) => {
    if (!id) return;

    try {
      const { error } = await supabase.rpc('assign_tag_to_contact' as any, {
        p_contact_id: id,
        p_tag_id: tagId,
      });

      if (error) throw error;

      toast.success('Tag assigned successfully');
      setAssignTagDialogOpen(false);
      fetchContactDetails();
    } catch (error: any) {
      logger.error('Error assigning tag', { error });
      toast.error('Failed to assign tag');
    }
  };

  const handleUnassignTag = async (tagId: string) => {
    if (!id) return;

    try {
      const { error } = await supabase.rpc('unassign_tag_from_contact' as any, {
        p_contact_id: id,
        p_tag_id: tagId,
      });

      if (error) throw error;

      toast.success('Tag removed successfully');
      fetchContactDetails();
    } catch (error: any) {
      logger.error('Error unassigning tag', { error });
      toast.error('Failed to remove tag');
    }
  };

  const handleUpdateCustomField = async (fieldKey: string, value: any) => {
    if (!id) return;

    try {
      const { error } = await supabase.rpc('update_contact_custom_field' as any, {
        p_contact_id: id,
        p_field_key: fieldKey,
        p_value: value,
      });

      if (error) throw error;

      setCustomFieldValues({ ...customFieldValues, [fieldKey]: value });
      toast.success('Custom field updated');
      fetchContactDetails();
    } catch (error: any) {
      logger.error('Error updating custom field', { error });
      toast.error('Failed to update custom field');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'archived':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'customer':
        return 'default';
      case 'lead':
        return 'default';
      case 'user':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading contact details...</p>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Contact not found</p>
        <Button onClick={() => navigate('/crm/contacts')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/crm/contacts')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {contact.full_name || 'Unknown Contact'}
            </h1>
            <p className="text-muted-foreground">
              Contact Details & Information
            </p>
          </div>
        </div>
        {!editMode ? (
          <Button onClick={() => setEditMode(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Contact
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setEditMode(false);
              setEditForm(contact);
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateContact}>
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notes">
            Notes ({notes.length})
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Information */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editMode ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>First Name</Label>
                          <Input
                            value={editForm.first_name || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, first_name: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          <Input
                            value={editForm.last_name || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, last_name: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={editForm.email || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, email: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={editForm.phone || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, phone: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                          value={editForm.company_name || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, company_name: e.target.value })
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{contact.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {contact.contact_type}
                          </p>
                        </div>
                      </div>
                      {contact.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-primary hover:underline"
                          >
                            {contact.email}
                          </a>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <a
                            href={`tel:${contact.phone}`}
                            className="text-primary hover:underline"
                          >
                            {contact.phone}
                          </a>
                        </div>
                      )}
                      {contact.company_name && (
                        <div className="flex items-center gap-3">
                          <Building className="h-5 w-5 text-muted-foreground" />
                          <span>{contact.company_name}</span>
                        </div>
                      )}
                      {(contact.city || contact.county) && (
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                          <span>
                            {[contact.city, contact.county, contact.country]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {contact.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Internal Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Status & Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge variant={getStatusBadgeVariant(contact.status)}>
                        {contact.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <div className="mt-1">
                      <Badge variant={getTypeBadgeVariant(contact.contact_type)}>
                        {contact.contact_type}
                      </Badge>
                    </div>
                  </div>
                  {contact.source && (
                    <div>
                      <Label className="text-muted-foreground">Source</Label>
                      <p className="mt-1 text-sm">{contact.source}</p>
                    </div>
                  )}
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Created</Label>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(contact.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Updated</Label>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {new Date(contact.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Tags</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssignTagDialogOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Tag
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tags assigned</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          style={{ backgroundColor: tag.color + '20', color: tag.color }}
                          className="cursor-pointer hover:opacity-80"
                        >
                          <Tag className="mr-1 h-3 w-3" />
                          {tag.name}
                          <button
                            onClick={() => handleUnassignTag(tag.id)}
                            className="ml-2 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {customFields.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Custom Fields</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {customFields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label>{field.name}</Label>
                        {editMode ? (
                          field.field_type === 'textarea' ? (
                            <Textarea
                              value={customFieldValues[field.field_key] || field.default_value || ''}
                              onChange={(e) =>
                                handleUpdateCustomField(field.field_key, e.target.value)
                              }
                              placeholder={field.placeholder || ''}
                            />
                          ) : field.field_type === 'dropdown' ? (
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={customFieldValues[field.field_key] || field.default_value || ''}
                              onChange={(e) =>
                                handleUpdateCustomField(field.field_key, e.target.value)
                              }
                            >
                              <option value="">Select...</option>
                              {field.field_options?.options?.map((opt: string) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : field.field_type === 'checkbox' ? (
                            <input
                              type="checkbox"
                              checked={customFieldValues[field.field_key] || false}
                              onChange={(e) =>
                                handleUpdateCustomField(field.field_key, e.target.checked)
                              }
                            />
                          ) : (
                            <Input
                              type={field.field_type === 'number' ? 'number' : 'text'}
                              value={customFieldValues[field.field_key] || field.default_value || ''}
                              onChange={(e) =>
                                handleUpdateCustomField(field.field_key, e.target.value)
                              }
                              placeholder={field.placeholder || ''}
                            />
                          )
                        ) : (
                          <p className="text-sm">
                            {customFieldValues[field.field_key] || field.default_value || (
                              <span className="text-muted-foreground">Not set</span>
                            )}
                          </p>
                        )}
                        {field.description && (
                          <p className="text-xs text-muted-foreground">{field.description}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Notes</CardTitle>
                <Button onClick={() => setAddNoteDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Note
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No notes yet. Add your first note to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {notes
                    .sort((a, b) => {
                      if (a.is_pinned && !b.is_pinned) return -1;
                      if (!a.is_pinned && b.is_pinned) return 1;
                      return (
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                      );
                    })
                    .map((note) => (
                      <Card key={note.id} className="relative">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {note.is_pinned && (
                                <Pin className="h-4 w-4 text-muted-foreground" />
                              )}
                              {note.is_private && (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              )}
                              <Badge variant="outline">{note.note_type}</Badge>
                              {note.title && (
                                <span className="font-medium">{note.title}</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(note.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          {contact && <ContactActivityTimeline contactId={contact.id} />}
        </TabsContent>
      </Tabs>

      {/* Add Note Dialog */}
      <Dialog open={addNoteDialogOpen} onOpenChange={setAddNoteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note about this contact
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Note Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={newNote.note_type}
                  onChange={(e) =>
                    setNewNote({ ...newNote, note_type: e.target.value })
                  }
                >
                  <option value="general">General</option>
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                  <option value="email">Email</option>
                  <option value="follow-up">Follow-up</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Title (Optional)</Label>
                <Input
                  value={newNote.title}
                  onChange={(e) =>
                    setNewNote({ ...newNote, title: e.target.value })
                  }
                  placeholder="Note title"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea
                value={newNote.content}
                onChange={(e) =>
                  setNewNote({ ...newNote, content: e.target.value })
                }
                placeholder="Enter your note here..."
                rows={6}
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newNote.is_pinned}
                  onChange={(e) =>
                    setNewNote({ ...newNote, is_pinned: e.target.checked })
                  }
                />
                <span className="text-sm">Pin this note</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newNote.is_private}
                  onChange={(e) =>
                    setNewNote({ ...newNote, is_private: e.target.checked })
                  }
                />
                <span className="text-sm">Private (only visible to me)</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote}>
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Tag Dialog */}
      <Dialog open={assignTagDialogOpen} onOpenChange={setAssignTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Tag</DialogTitle>
            <DialogDescription>
              Select a tag to assign to this contact
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {allTags
                .filter((tag) => !tags.some((t) => t.id === tag.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAssignTag(tag.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{tag.name}</p>
                      {tag.description && (
                        <p className="text-xs text-muted-foreground">{tag.description}</p>
                      )}
                    </div>
                    <Tag className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              {allTags.filter((tag) => !tags.some((t) => t.id === tag.id)).length === 0 && (
                <p className="text-center py-4 text-muted-foreground">
                  All available tags are already assigned
                </p>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTagDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

