-- Live Chat Performance Optimization
-- Created: February 2, 2025
-- Optimizations for fast, seamless chat loading

-- =====================================================
-- 1. ADDITIONAL INDEXES FOR COMMON QUERY PATTERNS
-- =====================================================

-- Composite index for fetching active sessions ordered by last message
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active_recent 
  ON homaradesk_chat_sessions(status, last_message_at DESC NULLS LAST, started_at DESC) 
  WHERE status IN ('active', 'waiting');

-- Composite index for agent's assigned chats
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_active 
  ON homaradesk_chat_sessions(assigned_to, status, last_message_at DESC NULLS LAST) 
  WHERE assigned_to IS NOT NULL AND status = 'active';

-- Index for sorting by last_message_at (most recent first)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message 
  ON homaradesk_chat_sessions(last_message_at DESC NULLS LAST) 
  WHERE last_message_at IS NOT NULL;

-- Composite index for waiting chats (for auto-assignment)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_waiting_optimized 
  ON homaradesk_chat_sessions(status, started_at ASC, assigned_to) 
  WHERE status = 'waiting' AND assigned_to IS NULL;

-- Index for messages by session with created_at (already exists but ensure it's optimal)
-- The existing index should be sufficient, but let's add a covering index for common selects
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_covering 
  ON homaradesk_chat_messages(session_id, created_at ASC, sender_type, sender_id);

-- Index for unread messages per session
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_covering 
  ON homaradesk_chat_messages(session_id, is_read, created_at DESC) 
  WHERE is_read = FALSE;

-- =====================================================
-- 2. MATERIALIZED VIEW FOR AGENT CHAT COUNTS (Optional - for very high volume)
-- =====================================================

-- This view can be refreshed periodically for very high-traffic scenarios
-- For now, we'll rely on the trigger-maintained current_chat_count

-- =====================================================
-- 3. OPTIMIZED FUNCTIONS FOR FAST DATA RETRIEVAL
-- =====================================================

-- Function to get chat sessions with assignee names in one query
CREATE OR REPLACE FUNCTION get_chat_sessions_with_assignees(
  p_limit INTEGER DEFAULT 100,
  p_status_filter VARCHAR DEFAULT NULL,
  p_assigned_to_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  visitor_id UUID,
  visitor_name VARCHAR,
  visitor_email VARCHAR,
  status VARCHAR,
  assigned_to UUID,
  assigned_to_name VARCHAR,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  ticket_id UUID,
  ticket_number VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.visitor_id,
    cs.visitor_name,
    cs.visitor_email,
    cs.status,
    cs.assigned_to,
    p.full_name as assigned_to_name,
    cs.assigned_at,
    cs.started_at,
    cs.ended_at,
    cs.last_message_at,
    cs.ticket_id,
    cs.ticket_number,
    cs.created_at,
    cs.updated_at
  FROM homaradesk_chat_sessions cs
  LEFT JOIN admins a ON a.id = cs.assigned_to
  LEFT JOIN profiles p ON p.id = a.user_id
  WHERE 
    (p_status_filter IS NULL OR cs.status = p_status_filter)
    AND (p_assigned_to_filter IS NULL OR cs.assigned_to = p_assigned_to_filter)
  ORDER BY 
    COALESCE(cs.last_message_at, cs.started_at) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get messages with sender names in one query
CREATE OR REPLACE FUNCTION get_chat_messages_with_senders(
  p_session_id UUID
)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  sender_type VARCHAR,
  sender_id UUID,
  sender_name VARCHAR,
  message_text TEXT,
  message_type VARCHAR,
  attachments JSONB,
  is_read BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.session_id,
    cm.sender_type,
    cm.sender_id,
    COALESCE(
      CASE 
        WHEN cm.sender_type = 'agent' AND cm.sender_id IS NOT NULL THEN
          (SELECT p.full_name 
           FROM admins a 
           JOIN profiles p ON p.id = a.user_id 
           WHERE a.id = cm.sender_id 
           LIMIT 1)
        WHEN cm.sender_type = 'visitor' THEN 'Visitor'
        ELSE 'System'
      END,
      cm.sender_name,
      'Unknown'
    ) as sender_name,
    cm.message_text,
    cm.message_type,
    cm.attachments,
    cm.is_read,
    cm.created_at
  FROM homaradesk_chat_messages cm
  WHERE cm.session_id = p_session_id
  ORDER BY cm.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get agent's active chats count (fast lookup)
CREATE OR REPLACE FUNCTION get_agent_active_chats_count(
  p_admin_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM homaradesk_chat_sessions
  WHERE assigned_to = p_admin_id 
    AND status = 'active';
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 4. UPDATE TRIGGERS TO BE MORE EFFICIENT
-- =====================================================

-- Optimize the agent chat count update trigger
CREATE OR REPLACE FUNCTION update_agent_chat_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if assignment actually changed
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- Chat reassigned
    IF OLD.assigned_to IS NOT NULL THEN
      UPDATE homaradesk_agent_queue
      SET current_chat_count = (
        SELECT COUNT(*) 
        FROM homaradesk_chat_sessions 
        WHERE assigned_to = OLD.assigned_to AND status = 'active'
      )
      WHERE admin_id = OLD.assigned_to;
    END IF;
    
    IF NEW.assigned_to IS NOT NULL THEN
      UPDATE homaradesk_agent_queue
      SET current_chat_count = (
        SELECT COUNT(*) 
        FROM homaradesk_chat_sessions 
        WHERE assigned_to = NEW.assigned_to AND status = 'active'
      )
      WHERE admin_id = NEW.assigned_to;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'ended' AND OLD.status != 'ended' THEN
    -- Chat ended, recalculate count
    IF NEW.assigned_to IS NOT NULL THEN
      UPDATE homaradesk_agent_queue
      SET current_chat_count = (
        SELECT COUNT(*) 
        FROM homaradesk_chat_sessions 
        WHERE assigned_to = NEW.assigned_to AND status = 'active'
      )
      WHERE admin_id = NEW.assigned_to;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND OLD.assigned_to IS NULL AND NEW.status = 'active' THEN
    -- Chat just assigned (was waiting, now active)
    UPDATE homaradesk_agent_queue
    SET current_chat_count = (
      SELECT COUNT(*) 
      FROM homaradesk_chat_sessions 
      WHERE assigned_to = NEW.assigned_to AND status = 'active'
    )
    WHERE admin_id = NEW.assigned_to;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. ANALYZE TABLES FOR QUERY PLANNER
-- =====================================================

-- Run ANALYZE to update statistics for query planner
ANALYZE homaradesk_chat_sessions;
ANALYZE homaradesk_chat_messages;
ANALYZE homaradesk_agent_queue;
ANALYZE homaradesk_chat_assignments;

-- =====================================================
-- 6. GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION get_chat_sessions_with_assignees TO authenticated;
GRANT EXECUTE ON FUNCTION get_chat_messages_with_senders TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_active_chats_count TO authenticated;

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON FUNCTION get_chat_sessions_with_assignees IS 'Optimized function to fetch chat sessions with assignee names in a single query';
COMMENT ON FUNCTION get_chat_messages_with_senders IS 'Optimized function to fetch chat messages with sender names in a single query';
COMMENT ON FUNCTION get_agent_active_chats_count IS 'Fast lookup for agent active chat count';

