import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare,
  RefreshCw,
  User,
  Search,
  Loader2,
  LogIn,
  LogOut,
  Circle,
  UtensilsCrossed,
  Coffee,
  CheckCircle2,
  ChevronDown,
  Check,
  Send,
  Ticket,
  MoreVertical,
  X,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useAdmin } from '@/hooks/useAdmin';

interface ChatSession {
  id: string;
  ticket_id?: string;
  visitor_name?: string;
  visitor_email?: string;
  status: string;
  assigned_to?: string;
  started_at: string;
  assigned_at?: string;
  ended_at?: string;
  assigned_to_name?: string;
  ticket_number?: string;
  last_message_at?: string;
  visitor_phone?: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: 'visitor' | 'agent' | 'system';
  sender_id?: string;
  sender_name?: string;
  message_text: string;
  created_at: string;
}

interface AgentQueueStatus {
  admin_id: string;
  status: 'available' | 'lunch' | 'away';
  is_logged_in: boolean;
  current_chat_count: number;
  max_concurrent_chats: number;
  logged_in_at: string;
  last_activity_at: string;
}

type ChatFilter = 'all' | 'my' | 'waiting' | 'active';

export default function LiveChat() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { adminInfo } = useAdmin();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  if (!permissions.canViewLiveChat) {
    return null;
  }
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [agentQueueStatus, setAgentQueueStatus] = useState<AgentQueueStatus | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [chatFilter, setChatFilter] = useState<ChatFilter>('my');
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchAgentQueueStatus = useCallback(async () => {
    if (!adminInfo?.id) return;
    setQueueLoading(true);
    try {
      const { data, error } = await supabase
        .from('homaradesk_agent_queue')
        .select('*')
        .eq('admin_id', adminInfo.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setAgentQueueStatus(data || null);
    } catch (error: any) {
      logger.error('Error fetching agent queue status:', error);
    } finally {
      setQueueLoading(false);
    }
  }, [adminInfo?.id]);

  const handleQueueLogin = async (status: 'available' | 'lunch' | 'away') => {
    if (!adminInfo?.id) return;
    setQueueLoading(true);
    try {
      const { data, error } = await supabase.rpc('agent_queue_login', {
        p_admin_id: adminInfo.id,
        p_status: status,
      });
      if (error) throw error;
      toast.success('Logged into queue', {
        description: `Status: ${status}`,
      });
      setAgentQueueStatus(data as AgentQueueStatus);
      // Trigger assignment of waiting chats if available
      if (status === 'available') {
        // Wait a bit for the queue status to update, then assign
        setTimeout(async () => {
          const { data: assignedCount, error: assignError } = await supabase.rpc('check_and_assign_waiting_chats');
          if (!assignError && assignedCount && assignedCount > 0) {
            toast.success(`${assignedCount} chat(s) assigned to you`);
          }
          // Always refresh sessions to show current state
          fetchSessions();
        }, 1000);
      } else {
        // Refresh sessions even if not available
        setTimeout(() => fetchSessions(), 500);
      }
    } catch (error: any) {
      logger.error('Error logging into queue:', error);
      toast.error('Failed to log into queue', {
        description: error.message,
      });
    } finally {
      setQueueLoading(false);
    }
  };

  const handleQueueLogout = async () => {
    if (!adminInfo?.id) return;
    setQueueLoading(true);
    try {
      const { data, error } = await supabase.rpc('agent_queue_logout', {
        p_admin_id: adminInfo.id,
      });
      if (error) throw error;
      toast.success('Logged out of queue');
      setAgentQueueStatus(null);
    } catch (error: any) {
      logger.error('Error logging out of queue:', error);
      toast.error('Failed to log out of queue', {
        description: error.message,
      });
    } finally {
      setQueueLoading(false);
    }
  };

  const handleUpdateStatus = async (status: 'available' | 'lunch' | 'away') => {
    if (!adminInfo?.id) return;
    setQueueLoading(true);
    try {
      const { data, error } = await supabase.rpc('agent_queue_update_status', {
        p_admin_id: adminInfo.id,
        p_new_status: status,
      });
      if (error) throw error;
      toast.success(`Status updated to ${status}`);
      setAgentQueueStatus(data as AgentQueueStatus);
      // If becoming available, fix unassigned chats and assign waiting chats
      if (status === 'available') {
        // Wait a bit for the status to update, then fix and assign
        setTimeout(async () => {
          // First fix any unassigned active chats
          await supabase.rpc('fix_unassigned_active_chats');
          
          // Then assign waiting chats
          const { data: assignedCount, error: assignError } = await supabase.rpc('check_and_assign_waiting_chats');
          if (!assignError && assignedCount && assignedCount > 0) {
            toast.success(`${assignedCount} chat(s) assigned to you`);
          }
          // Always refresh sessions to show current state
          fetchSessions();
        }, 1000);
      } else {
        // Refresh sessions even if not available
        setTimeout(() => fetchSessions(), 500);
      }
    } catch (error: any) {
      logger.error('Error updating status:', error);
      toast.error('Failed to update status', {
        description: error.message,
      });
    } finally {
      setQueueLoading(false);
    }
  };

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_chat_sessions_with_assignees', {
        p_limit: 100,
        p_status_filter: null,
        p_assigned_to_filter: null,
      });

      if (error) {
        // Fallback to direct query
        if (error.code === '42883') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('homaradesk_chat_sessions')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(100);

          if (fallbackError) {
            if (fallbackError.code === '42P01' || fallbackError.code === 'PGRST116') {
              setSessions([]);
              return;
            }
            throw fallbackError;
          }

          // Fetch assignee names
          const assigneeIds = [...new Set((fallbackData || []).map((s: any) => s.assigned_to).filter(Boolean))];
          const assigneesMap = new Map();

          if (assigneeIds.length > 0) {
            const { data: admins } = await supabase
              .from('admins')
              .select('id, user_id')
              .in('id', assigneeIds);

            if (admins) {
              const adminUserIds = admins.map((a: any) => a.user_id).filter(Boolean);
              if (adminUserIds.length > 0) {
                const { data: profiles } = await supabase
                  .from('profiles')
                  .select('id, full_name')
                  .in('id', adminUserIds);

                if (profiles) {
                  const adminIdToUserId = new Map(admins.map((a: any) => [a.user_id, a.id]));
                  profiles.forEach((p: any) => {
                    const adminId = adminIdToUserId.get(p.id);
                    if (adminId) {
                      assigneesMap.set(adminId, p.full_name);
                    }
                  });
                }
              }
            }
          }

          const processed = (fallbackData || []).map((session: any) => ({
            ...session,
            assigned_to_name: session.assigned_to ? assigneesMap.get(session.assigned_to) : null,
          }));

          setSessions(processed);
          return;
        }
        throw error;
      }

      setSessions(data || []);
    } catch (error: any) {
      logger.error('Error fetching chat sessions:', error);
      toast.error('Failed to fetch chat sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (sessionId: string) => {
    try {
      setMessagesLoading(true);
      
      // Try RPC function first
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_chat_messages_with_senders', {
        p_session_id: sessionId,
      });

      if (!rpcError && rpcData) {
        setMessages(rpcData);
        setTimeout(scrollToBottom, 100);
        return;
      }

      // Always use fallback if RPC fails (handles type mismatches, missing functions, etc.)
      if (rpcError) {
        logger.warn('RPC function error, using fallback:', rpcError);
        // Continue to fallback below
      } else {
        // RPC succeeded, we already returned above
        return;
      }

      // Fallback: Use direct query
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('homaradesk_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (fallbackError) {
        if (fallbackError.code === '42P01' || fallbackError.code === 'PGRST116') {
          setMessages([]);
          return;
        }
        throw fallbackError;
      }

      // Fetch sender names for agents
      const agentIds = [...new Set((fallbackData || []).filter((m: any) => m.sender_type === 'agent').map((m: any) => m.sender_id).filter(Boolean))];
      const agentsMap = new Map();

      if (agentIds.length > 0) {
        const { data: admins } = await supabase
          .from('admins')
          .select('id, user_id')
          .in('id', agentIds);

        if (admins) {
          const adminUserIds = admins.map((a: any) => a.user_id).filter(Boolean);
          if (adminUserIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', adminUserIds);

            if (profiles) {
              const adminIdToUserId = new Map(admins.map((a: any) => [a.user_id, a.id]));
              profiles.forEach((p: any) => {
                const adminId = adminIdToUserId.get(p.id);
                if (adminId) {
                  agentsMap.set(adminId, p.full_name);
                }
              });
            }
          }
        }
      }

      const processed = (fallbackData || []).map((msg: any) => ({
        ...msg,
        sender_name: msg.sender_type === 'agent' && msg.sender_id
          ? agentsMap.get(msg.sender_id) || 'Agent'
          : msg.sender_type === 'visitor'
          ? 'Visitor'
          : 'System',
        message_type: msg.message_type || 'text',
        attachments: msg.attachments || [],
        is_read: msg.is_read || false,
      }));

      setMessages(processed);
      setTimeout(scrollToBottom, 100);
    } catch (error: any) {
      logger.error('Error fetching messages:', error);
      toast.error('Failed to fetch messages', {
        description: error.message || 'Unknown error',
      });
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const handleSendMessage = async () => {
    if (!selectedSession || !newMessage.trim() || !adminInfo?.id) return;

    try {
      // Use the unified function to send messages (handles both homaradesk and support chats)
      // Function signature: p_session_id, p_sender_user_id, p_message_text, p_sender_type
      const { data: messageId, error: sendError } = await supabase.rpc(
        'send_chat_message_unified',
        {
          p_session_id: selectedSession,
          p_sender_user_id: adminInfo.user_id || adminInfo.id,
          p_message_text: newMessage.trim(),
          p_sender_type: 'agent',
        }
      );

      if (sendError) {
        logger.error('Error sending message via unified function:', sendError);
        throw sendError;
      }

      // Message sent successfully via unified function
      setNewMessage('');
      
      // Refresh messages to show the new one
      fetchMessages(selectedSession);
    } catch (error: any) {
      logger.error('Error sending message:', error);
      toast.error('Failed to send message', {
        description: error.message || 'Unknown error',
      });
    }
  };

  const handleCloseChatAndCreateTicket = async (sessionId: string) => {
    if (!permissions.canManageTickets) {
      toast.error('You do not have permission to create tickets.');
      return;
    }
    if (!adminInfo?.id) return;

    try {
      // Check if session exists in either table (support_chats or homaradesk_chat_sessions)
      const [homaradeskCheck, supportCheck] = await Promise.all([
        supabase
          .from('homaradesk_chat_sessions')
          .select('id, status, visitor_name, visitor_email')
          .eq('id', sessionId)
          .single(),
        supabase
          .from('support_chats')
          .select('id, status, customer_id')
          .eq('id', sessionId)
          .single(),
      ]);

      const sessionCheck = homaradeskCheck.data || supportCheck.data;
      const checkError = homaradeskCheck.error && supportCheck.error ? 
        (homaradeskCheck.error.code === 'PGRST116' && supportCheck.error.code === 'PGRST116' ? null : supportCheck.error) : 
        null;

      if (checkError || !sessionCheck) {
        toast.error('Chat session not found', {
          description: 'This chat session may have been deleted. Please refresh.',
        });
        fetchSessions();
        setSelectedSession(null);
        return;
      }

      // Get visitor info for ticket creation
      let visitorName = 'Visitor';
      let visitorEmail = '';
      
      if (homaradeskCheck.data) {
        visitorName = homaradeskCheck.data.visitor_name || 'Visitor';
        visitorEmail = homaradeskCheck.data.visitor_email || '';
      } else if (supportCheck.data) {
        // Get customer info from profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', supportCheck.data.customer_id)
          .single();
        
        if (profile) {
          visitorName = profile.full_name || profile.email?.split('@')[0] || 'Customer';
          visitorEmail = profile.email || '';
        }
      }

      // Call the RPC function
      const { data, error } = await supabase.rpc('close_chat_and_create_ticket', {
        p_session_id: sessionId,
        p_admin_id: adminInfo.id,
        p_ticket_title: null,
        p_ticket_description: null,
      });

      // Check if function returned success=false (even if no error thrown)
      if (data && data.success === false) {
        throw new Error(data.error || data.message || 'Failed to close chat');
      }

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error('Unexpected response from server');
      }

      toast.success('Chat closed and ticket created', {
        description: `Ticket ${data.ticket_number || 'created'} successfully`,
      });

      // Refresh sessions and clear selection
      fetchSessions();
      setSelectedSession(null);
      
      // Navigate to ticket if user wants
      if (data?.ticket_id) {
        navigate(`/homaradesk/tickets/${data.ticket_id}`);
      }
    } catch (error: any) {
      logger.error('Error closing chat and creating ticket:', error);
      toast.error('Failed to close chat and create ticket', {
        description: error.message || 'Unknown error',
      });
    }
  };

  const fetchAvailableAgents = useCallback(async () => {
    try {
      // Get all agents who are logged in and available
      const { data: queueData, error: queueError } = await supabase
        .from('homaradesk_agent_queue')
        .select('admin_id, status, current_chat_count, max_concurrent_chats')
        .eq('is_logged_in', true)
        .eq('status', 'available');

      if (queueError) throw queueError;

      if (!queueData || queueData.length === 0) {
        setAvailableAgents([]);
        return;
      }

      // Filter agents who have capacity (client-side filtering since Supabase doesn't support column-to-column comparison)
      const availableQueueData = queueData.filter(
        (q) => q.current_chat_count < q.max_concurrent_chats
      );

      if (availableQueueData.length === 0) {
        setAvailableAgents([]);
        return;
      }

      // Get admin details
      const adminIds = availableQueueData.map((q) => q.admin_id);
      const { data: adminsData, error: adminsError } = await supabase
        .from('admins')
        .select('id, user_id, email')
        .in('id', adminIds);

      if (adminsError) throw adminsError;

      // Get profile names using user_id
      const userIds = (adminsData || []).map((a) => a.user_id).filter(Boolean);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const agents = (adminsData || []).map((admin) => {
        const profile = profilesData?.find((p) => p.id === admin.user_id);
        return {
          id: admin.user_id || admin.id, // Use user_id for consistency with unified functions
          adminId: admin.id, // Keep admin_id for reference
          name: profile?.full_name || admin.email?.split('@')[0] || 'Agent',
          email: admin.email || '',
        };
      });

      setAvailableAgents(agents);
    } catch (error: any) {
      logger.error('Error fetching available agents:', error);
      setAvailableAgents([]);
    }
  }, []);

  const handleReassignChat = async (sessionId: string, newAgentId: string) => {
    if (!adminInfo?.id) return;

    try {
      const { data, error } = await supabase.rpc('reassign_chat_to_agent', {
        p_session_id: sessionId,
        p_new_agent_id: newAgentId,
        p_reassigned_by: adminInfo.id,
      });

      if (error) throw error;

      toast.success('Chat reassigned successfully');
      fetchSessions();
      fetchAgentQueueStatus();
      fetchAvailableAgents();
    } catch (error: any) {
      logger.error('Error reassigning chat:', error);
      toast.error('Failed to reassign chat', {
        description: error.message || 'Unknown error',
      });
    }
  };

  // Periodically fix unassigned chats and assign waiting chats
  useEffect(() => {
    if (!adminInfo?.id) return;

    const interval = setInterval(async () => {
      try {
        // Fix unassigned active chats
        await supabase.rpc('fix_unassigned_active_chats');
        
        // Assign waiting chats
        await supabase.rpc('check_and_assign_waiting_chats');
        
        // Refresh sessions
        fetchSessions();
      } catch (error) {
        logger.error('Error in periodic chat assignment:', error);
      }
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [adminInfo?.id, fetchSessions]);

  useEffect(() => {
    fetchSessions();
    fetchAgentQueueStatus();

    // Real-time subscriptions
    const sessionsChannel = supabase
      .channel('chat_sessions_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'homaradesk_chat_sessions',
        },
        (payload) => {
          fetchSessions();
          // If a chat was assigned to this agent, refresh queue status and try to assign more
          if (payload.eventType === 'UPDATE' && 
              payload.new.assigned_to === adminInfo?.id && 
              payload.old?.assigned_to !== adminInfo?.id) {
            // New chat assigned to this agent
            fetchAgentQueueStatus();
            // Check for more waiting chats if agent has capacity
            setTimeout(() => {
              supabase.rpc('check_and_assign_waiting_chats').catch(() => {});
            }, 1000);
          }
          // If a new waiting chat was created, try to assign it immediately
          if (payload.eventType === 'INSERT' && payload.new.status === 'waiting') {
            setTimeout(() => {
              supabase.rpc('check_and_assign_waiting_chats').catch(() => {});
            }, 500);
          }
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('chat_messages_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'homaradesk_chat_messages',
        },
        (payload) => {
          if (selectedSession && payload.new.session_id === selectedSession) {
            setMessages((prev) => [...prev, payload.new as ChatMessage]);
            setTimeout(scrollToBottom, 100);
          }
          fetchSessions(); // Update last_message_at in list
        }
      )
      .subscribe();

    const queueChannel = supabase
      .channel('agent_queue_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'homaradesk_agent_queue',
          filter: adminInfo?.id ? `admin_id=eq.${adminInfo.id}` : undefined,
        },
        () => {
          fetchAgentQueueStatus();
        }
      )
      .subscribe();

    return () => {
      sessionsChannel.unsubscribe();
      messagesChannel.unsubscribe();
      queueChannel.unsubscribe();
    };
  }, [fetchSessions, fetchAgentQueueStatus, adminInfo?.id, selectedSession]);

  useEffect(() => {
    if (selectedSession) {
      fetchMessages(selectedSession);
      fetchAvailableAgents();
    } else {
      setMessages([]);
    }
  }, [selectedSession, fetchMessages, fetchAvailableAgents]);

  // Periodically check for waiting chats and assign them (every 5 seconds when available)
  useEffect(() => {
    if (!agentQueueStatus?.is_logged_in || agentQueueStatus.status !== 'available') {
      return;
    }

    const interval = setInterval(() => {
      // Check if agent has capacity
      if (agentQueueStatus.current_chat_count < agentQueueStatus.max_concurrent_chats) {
        supabase.rpc('check_and_assign_waiting_chats')
          .then(({ data, error }) => {
            if (!error && data && data > 0) {
              // Refresh sessions to show newly assigned chats
              fetchSessions();
              // Also refresh queue status to update chat count
              fetchAgentQueueStatus();
            }
          })
          .catch(() => {}); // Silent fail for background assignment
      }
    }, 5000); // Check every 5 seconds for faster assignment

    return () => clearInterval(interval);
  }, [agentQueueStatus, fetchSessions, fetchAgentQueueStatus]);

  useEffect(() => {
    if (selectedSession) {
      fetchMessages(selectedSession);
    }
  }, [selectedSession, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const filteredSessions = useMemo(() => {
    let filtered = sessions.filter((session) => {
      const matchesSearch = search === '' ||
        session.visitor_name?.toLowerCase().includes(search.toLowerCase()) ||
        session.visitor_email?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      switch (chatFilter) {
        case 'my':
          // Show chats assigned to this agent that are active or chatting (exclude closed/ended)
          // Note: assigned_to from unified function is user_id, not admin_id
          return session.assigned_to === adminInfo?.user_id && 
                 (session.status === 'active' || session.status === 'chatting');
        case 'waiting':
          return session.status === 'waiting';
        case 'active':
          return session.status === 'active' || session.status === 'chatting';
        default:
          // Show only closed/ended chats in "All" tab
          return session.status === 'ended' || session.status === 'closed' || session.status === 'resolved';
      }
    });

    // Sort by last_message_at or started_at
    return filtered.sort((a, b) => {
      const aTime = a.last_message_at || a.started_at;
      const bTime = b.last_message_at || b.started_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [sessions, search, chatFilter, adminInfo?.id]);

  const selectedSessionData = sessions.find(s => s.id === selectedSession);
  // Note: assigned_to from unified function is user_id, not admin_id
  const myChatsCount = sessions.filter(s => s.assigned_to === adminInfo?.user_id && (s.status === 'active' || s.status === 'chatting')).length;
  const waitingCount = sessions.filter(s => s.status === 'waiting').length;
  const activeCount = sessions.filter(s => s.status === 'active' || s.status === 'chatting').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'text-green-500';
      case 'lunch':
        return 'text-yellow-500';
      case 'away':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case 'lunch':
        return <UtensilsCrossed className="h-3.5 w-3.5" />;
      case 'away':
        return <Coffee className="h-3.5 w-3.5" />;
      default:
        return <Circle className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">Live Chat</h1>
          <p className="text-sm text-muted-foreground">Manage conversations with visitors</p>
        </div>
        <div className="flex items-center gap-2">
          {agentQueueStatus?.is_logged_in ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8" disabled={queueLoading}>
                  {getStatusIcon(agentQueueStatus.status)}
                  <span className="ml-1.5 capitalize text-xs">{agentQueueStatus.status}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({agentQueueStatus.current_chat_count}/{agentQueueStatus.max_concurrent_chats})
                  </span>
                  <ChevronDown className="h-3 w-3 ml-1.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => handleUpdateStatus('available')}
                  disabled={queueLoading || agentQueueStatus.status === 'available'}
                >
                  <CheckCircle2 className={`h-4 w-4 mr-2 ${agentQueueStatus.status === 'available' ? 'text-green-500' : ''}`} />
                  <span>Available</span>
                  {agentQueueStatus.status === 'available' && <Check className="h-3.5 w-3.5 ml-auto text-green-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleUpdateStatus('lunch')}
                  disabled={queueLoading || agentQueueStatus.status === 'lunch'}
                >
                  <UtensilsCrossed className={`h-4 w-4 mr-2 ${agentQueueStatus.status === 'lunch' ? 'text-yellow-500' : ''}`} />
                  <span>Lunch</span>
                  {agentQueueStatus.status === 'lunch' && <Check className="h-3.5 w-3.5 ml-auto text-yellow-500" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleUpdateStatus('away')}
                  disabled={queueLoading || agentQueueStatus.status === 'away'}
                >
                  <Coffee className={`h-4 w-4 mr-2 ${agentQueueStatus.status === 'away' ? 'text-orange-500' : ''}`} />
                  <span>Away</span>
                  {agentQueueStatus.status === 'away' && <Check className="h-3.5 w-3.5 ml-auto text-orange-500" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleQueueLogout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Log Out of Queue</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => handleQueueLogin('available')} disabled={queueLoading} size="sm" className="h-8">
              <LogIn className="h-3 w-3 mr-1.5" />
              Log Into Queue
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={fetchSessions} disabled={loading} className="h-8 w-8">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {agentQueueStatus?.is_logged_in && agentQueueStatus.status === 'available' && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const { data: assignedCount, error } = await supabase.rpc('check_and_assign_waiting_chats');
                if (!error && assignedCount && assignedCount > 0) {
                  toast.success(`${assignedCount} chat(s) assigned to you`);
                } else if (!error && assignedCount === 0) {
                  toast.info('No waiting chats to assign');
                }
                fetchSessions();
                fetchAgentQueueStatus();
              }}
              className="h-8 text-xs"
            >
              Assign Waiting Chats
            </Button>
          )}
        </div>
      </div>

      {/* Main Content - Side by Side */}
      <div className="flex-1 flex gap-4 mt-4 min-h-0">
        {/* Left Sidebar - Chat List */}
        <div className="w-80 flex flex-col border rounded-lg bg-card">
          {/* Filter Tabs */}
          <div className="flex border-b p-1">
            <Button
              variant={chatFilter === 'my' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={() => setChatFilter('my')}
            >
              My Chats ({myChatsCount})
            </Button>
            <Button
              variant={chatFilter === 'waiting' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={() => setChatFilter('waiting')}
            >
              Waiting ({waitingCount})
            </Button>
            <Button
              variant={chatFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={() => setChatFilter('all')}
            >
              All ({sessions.length})
            </Button>
          </div>

          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Chat List */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-sm font-medium">No chats found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {chatFilter === 'my' ? 'You have no assigned chats' : 'No chats match your filter'}
                </p>
              </div>
            ) : (
              <div className="p-1">
                {filteredSessions.map((session) => {
                  const isSelected = selectedSession === session.id;
                  const isUnread = false; // Could add unread logic later
                  
                  return (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSession(session.id)}
                      className={`p-3 cursor-pointer rounded-md mb-1 transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary-foreground' : ''}`}>
                              {session.visitor_name || session.visitor_email || 'Anonymous'}
                            </p>
                            {session.status === 'waiting' && (
                              <Badge variant="secondary" className="h-4 px-1.5 text-xs">
                                Waiting
                              </Badge>
                            )}
                          </div>
                          {session.visitor_email && (
                            <p className={`text-xs truncate ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                              {session.visitor_email}
                            </p>
                          )}
                          {session.last_message_at && (
                            <p className={`text-xs mt-1 ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {formatDistanceToNow(new Date(session.last_message_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                        {isUnread && !isSelected && (
                          <div className="h-2 w-2 rounded-full bg-primary mt-1 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Side - Chat Interface */}
        <div className="flex-1 flex flex-col border rounded-lg bg-card min-w-0">
          {selectedSessionData ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">
                      {selectedSessionData.visitor_name || selectedSessionData.visitor_email || 'Anonymous'}
                    </h3>
                    <Badge 
                      variant={
                        selectedSessionData.status === 'chatting' || selectedSessionData.status === 'active' 
                          ? 'default' 
                          : selectedSessionData.status === 'closed' || selectedSessionData.status === 'ended'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {selectedSessionData.status === 'chatting' ? 'Active' : selectedSessionData.status}
                    </Badge>
                  </div>
                  {selectedSessionData.visitor_email && (
                    <p className="text-sm text-muted-foreground truncate">{selectedSessionData.visitor_email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedSessionData.status !== 'closed' && selectedSessionData.status !== 'ended' && (
                    <>
                      {selectedSessionData.assigned_to !== adminInfo?.user_id && selectedSessionData.assigned_to && availableAgents.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8">
                              <UserPlus className="h-4 w-4 mr-1.5" />
                              Reassign
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem disabled>
                              <Users className="h-4 w-4 mr-2" />
                              Select agent to reassign...
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {availableAgents
                              .filter((agent) => agent.id !== selectedSessionData.assigned_to)
                              .map((agent) => (
                                <DropdownMenuItem
                                  key={agent.id}
                                  onClick={() => handleReassignChat(selectedSessionData.id, agent.id)}
                                >
                                  <User className="h-4 w-4 mr-2" />
                                  {agent.name}
                                </DropdownMenuItem>
                              ))}
                            {availableAgents.filter((agent) => agent.id !== selectedSessionData.assigned_to).length === 0 && (
                              <DropdownMenuItem disabled>No available agents</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {!selectedSessionData.ticket_id && permissions.canManageTickets && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleCloseChatAndCreateTicket(selectedSessionData.id)}
                          className="h-8"
                        >
                          <X className="h-4 w-4 mr-1.5" />
                          Close Chat & Create Ticket
                        </Button>
                      )}
                    </>
                  )}
                  {selectedSessionData.ticket_id && (
                    <Badge variant="outline" className="h-8 px-3">
                      <Ticket className="h-3 w-3 mr-1.5" />
                      Ticket Created
                    </Badge>
                  )}
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm mt-1">Start the conversation</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isAgent = message.sender_type === 'agent';
                      const isSystem = message.sender_type === 'system';
                      
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              isAgent
                                ? 'bg-primary text-primary-foreground'
                                : isSystem
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {!isSystem && (
                              <div className={`text-xs font-medium mb-1 ${isAgent ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                {message.sender_name || (isAgent ? 'You' : 'Visitor')}
                              </div>
                            )}
                            <div className={`text-sm ${isAgent ? 'text-primary-foreground' : ''}`}>
                              {message.message_text}
                            </div>
                            <div className={`text-xs mt-1 ${isAgent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {format(new Date(message.created_at), 'HH:mm')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              {(selectedSessionData.status === 'active' || selectedSessionData.status === 'chatting') && (
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="min-h-[60px] resize-none"
                      rows={2}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      size="icon"
                      className="h-[60px] w-[60px]"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium">Select a chat to start</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a conversation from the list to view messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
