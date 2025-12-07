-- Live Chat System with Agent Queue Management
-- Created: February 2, 2025
-- Features: Chat sessions, messages, agent queue, automatic assignment

-- =====================================================
-- 1. CHAT SESSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID, -- Optional: link to profiles if visitor is logged in
  visitor_name VARCHAR(255),
  visitor_email VARCHAR(255),
  visitor_phone VARCHAR(50),
  visitor_ip VARCHAR(45), -- IPv6 support
  visitor_user_agent TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended', 'transferred', 'abandoned')),
  assigned_to UUID REFERENCES admins(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  ticket_id UUID, -- Link to ticket if chat is converted to ticket
  ticket_number VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional session data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON homaradesk_chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_assigned_to ON homaradesk_chat_sessions(assigned_to);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_started_at ON homaradesk_chat_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_visitor_id ON homaradesk_chat_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_waiting ON homaradesk_chat_sessions(status, started_at) WHERE status = 'waiting';

-- =====================================================
-- 2. CHAT MESSAGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES homaradesk_chat_sessions(id) ON DELETE CASCADE,
  sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('visitor', 'agent', 'system')),
  sender_id UUID, -- Agent ID if sender_type is 'agent', visitor_id if 'visitor'
  sender_name VARCHAR(255), -- Cached name for display
  message_text TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  attachments JSONB DEFAULT '[]'::jsonb, -- Array of attachment objects
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON homaradesk_chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON homaradesk_chat_messages(session_id, is_read) WHERE is_read = FALSE;

-- =====================================================
-- 3. AGENT QUEUE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_agent_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL UNIQUE REFERENCES admins(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'available', 'lunch', 'away')),
  is_logged_in BOOLEAN DEFAULT FALSE,
  max_concurrent_chats INTEGER DEFAULT 3, -- Maximum chats agent can handle
  current_chat_count INTEGER DEFAULT 0, -- Current number of active chats
  logged_in_at TIMESTAMPTZ,
  last_status_change_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(), -- Last time agent was active
  status_note TEXT, -- Optional note for status (e.g., "Back in 15 minutes")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure agent can only be logged in with a valid status
  CONSTRAINT agent_queue_status_check CHECK (
    (is_logged_in = FALSE AND status = 'offline') OR
    (is_logged_in = TRUE AND status IN ('available', 'lunch', 'away'))
  )
);

-- Indexes for agent queue
CREATE INDEX IF NOT EXISTS idx_agent_queue_status ON homaradesk_agent_queue(status, is_logged_in);
CREATE INDEX IF NOT EXISTS idx_agent_queue_available ON homaradesk_agent_queue(status, current_chat_count, last_activity_at) 
  WHERE status = 'available' AND is_logged_in = TRUE;
CREATE INDEX IF NOT EXISTS idx_agent_queue_admin_id ON homaradesk_agent_queue(admin_id);

-- =====================================================
-- 4. CHAT ASSIGNMENT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_chat_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES homaradesk_chat_sessions(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES admins(id) ON DELETE SET NULL, -- NULL if auto-assigned
  assignment_type VARCHAR(50) NOT NULL DEFAULT 'auto' CHECK (assignment_type IN ('auto', 'manual', 'transfer')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ, -- If chat was reassigned
  notes TEXT
);

-- Indexes for assignments
CREATE INDEX IF NOT EXISTS idx_chat_assignments_session ON homaradesk_chat_assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_assignments_agent ON homaradesk_chat_assignments(assigned_to, assigned_at);

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_sessions_updated_at
  BEFORE UPDATE ON homaradesk_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_sessions_updated_at();

-- Update agent queue updated_at
CREATE OR REPLACE FUNCTION update_agent_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_queue_updated_at
  BEFORE UPDATE ON homaradesk_agent_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_queue_updated_at();

-- Update chat session last_message_at when message is created
CREATE OR REPLACE FUNCTION update_chat_session_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE homaradesk_chat_sessions
  SET last_message_at = NEW.created_at
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_session_last_message
  AFTER INSERT ON homaradesk_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_last_message();

-- Update agent current_chat_count when chat is assigned/unassigned
CREATE OR REPLACE FUNCTION update_agent_chat_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Chat assigned
    UPDATE homaradesk_agent_queue
    SET current_chat_count = current_chat_count + 1
    WHERE admin_id = NEW.assigned_to;
    
    -- Update session assigned_at
    UPDATE homaradesk_chat_sessions
    SET assigned_at = NOW()
    WHERE id = NEW.session_id;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- Chat reassigned
    IF OLD.assigned_to IS NOT NULL THEN
      UPDATE homaradesk_agent_queue
      SET current_chat_count = GREATEST(0, current_chat_count - 1)
      WHERE admin_id = OLD.assigned_to;
    END IF;
    
    IF NEW.assigned_to IS NOT NULL THEN
      UPDATE homaradesk_agent_queue
      SET current_chat_count = current_chat_count + 1
      WHERE admin_id = NEW.assigned_to;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'ended' AND OLD.status != 'ended' THEN
    -- Chat ended, decrement count
    IF NEW.assigned_to IS NOT NULL THEN
      UPDATE homaradesk_agent_queue
      SET current_chat_count = GREATEST(0, current_chat_count - 1)
      WHERE admin_id = NEW.assigned_to;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_chat_count_on_assignment
  AFTER INSERT OR UPDATE ON homaradesk_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_chat_count();

-- Auto-assign waiting chats when new session is created
CREATE OR REPLACE FUNCTION auto_assign_new_chat()
RETURNS TRIGGER AS $$
BEGIN
  -- If chat is created with waiting status, try to assign it
  IF NEW.status = 'waiting' AND NEW.assigned_to IS NULL THEN
    PERFORM assign_waiting_chats();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_assign_new_chat
  AFTER INSERT ON homaradesk_chat_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'waiting' AND NEW.assigned_to IS NULL)
  EXECUTE FUNCTION auto_assign_new_chat();

-- =====================================================
-- 6. FUNCTIONS FOR QUEUE MANAGEMENT
-- =====================================================

-- Function to log agent into queue
CREATE OR REPLACE FUNCTION agent_queue_login(
  p_admin_id UUID,
  p_status VARCHAR DEFAULT 'available'
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Validate status
  IF p_status NOT IN ('available', 'lunch', 'away') THEN
    RAISE EXCEPTION 'Invalid status. Must be available, lunch, or away';
  END IF;

  -- Insert or update agent queue
  INSERT INTO homaradesk_agent_queue (admin_id, status, is_logged_in, logged_in_at, last_status_change_at, last_activity_at)
  VALUES (p_admin_id, p_status, TRUE, NOW(), NOW(), NOW())
  ON CONFLICT (admin_id) 
  DO UPDATE SET
    status = p_status,
    is_logged_in = TRUE,
    logged_in_at = COALESCE(homaradesk_agent_queue.logged_in_at, NOW()),
    last_status_change_at = NOW(),
    last_activity_at = NOW(),
    updated_at = NOW();

  -- Return success
  SELECT jsonb_build_object(
    'success', true,
    'admin_id', p_admin_id,
    'status', p_status,
    'message', 'Agent logged into queue successfully'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log agent out of queue
CREATE OR REPLACE FUNCTION agent_queue_logout(
  p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Update agent queue
  UPDATE homaradesk_agent_queue
  SET 
    status = 'offline',
    is_logged_in = FALSE,
    last_status_change_at = NOW(),
    updated_at = NOW()
  WHERE admin_id = p_admin_id;

  -- Unassign all active chats from this agent
  UPDATE homaradesk_chat_sessions
  SET 
    assigned_to = NULL,
    assigned_at = NULL,
    status = 'waiting'
  WHERE assigned_to = p_admin_id AND status = 'active';

  -- Reset chat count
  UPDATE homaradesk_agent_queue
  SET current_chat_count = 0
  WHERE admin_id = p_admin_id;

  -- Return success
  SELECT jsonb_build_object(
    'success', true,
    'admin_id', p_admin_id,
    'message', 'Agent logged out of queue successfully'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update agent status
CREATE OR REPLACE FUNCTION agent_queue_update_status(
  p_admin_id UUID,
  p_status VARCHAR,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Validate status
  IF p_status NOT IN ('available', 'lunch', 'away') THEN
    RAISE EXCEPTION 'Invalid status. Must be available, lunch, or away';
  END IF;

  -- Check if agent is logged in
  IF NOT EXISTS (
    SELECT 1 FROM homaradesk_agent_queue 
    WHERE admin_id = p_admin_id AND is_logged_in = TRUE
  ) THEN
    RAISE EXCEPTION 'Agent is not logged into the queue';
  END IF;

  -- Update status
  UPDATE homaradesk_agent_queue
  SET 
    status = p_status,
    status_note = p_note,
    last_status_change_at = NOW(),
    last_activity_at = NOW(),
    updated_at = NOW()
  WHERE admin_id = p_admin_id;

  -- If status changed to available, try to assign waiting chats
  IF p_status = 'available' THEN
    PERFORM assign_waiting_chats();
  END IF;

  -- Return success
  SELECT jsonb_build_object(
    'success', true,
    'admin_id', p_admin_id,
    'status', p_status,
    'message', 'Agent status updated successfully'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update agent activity
CREATE OR REPLACE FUNCTION agent_queue_update_activity(
  p_admin_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE homaradesk_agent_queue
  SET last_activity_at = NOW()
  WHERE admin_id = p_admin_id AND is_logged_in = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next available agent for chat assignment
CREATE OR REPLACE FUNCTION get_next_available_agent()
RETURNS UUID AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  -- Find agent who is:
  -- 1. Logged in and available
  -- 2. Has less than max_concurrent_chats
  -- 3. Most recently active (to distribute evenly)
  SELECT admin_id INTO v_agent_id
  FROM homaradesk_agent_queue
  WHERE is_logged_in = TRUE
    AND status = 'available'
    AND current_chat_count < max_concurrent_chats
  ORDER BY current_chat_count ASC, last_activity_at ASC
  LIMIT 1;

  RETURN v_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign waiting chats to available agents
CREATE OR REPLACE FUNCTION assign_waiting_chats()
RETURNS INTEGER AS $$
DECLARE
  v_assigned_count INTEGER := 0;
  v_waiting_chat RECORD;
  v_agent_id UUID;
BEGIN
  -- Loop through waiting chats
  FOR v_waiting_chat IN
    SELECT id, started_at
    FROM homaradesk_chat_sessions
    WHERE status = 'waiting'
      AND assigned_to IS NULL
    ORDER BY started_at ASC
  LOOP
    -- Get next available agent
    v_agent_id := get_next_available_agent();
    
    -- If agent found, assign chat
    IF v_agent_id IS NOT NULL THEN
      UPDATE homaradesk_chat_sessions
      SET 
        assigned_to = v_agent_id,
        assigned_at = NOW(),
        status = 'active'
      WHERE id = v_waiting_chat.id;

      -- Log assignment
      INSERT INTO homaradesk_chat_assignments (session_id, assigned_to, assignment_type)
      VALUES (v_waiting_chat.id, v_agent_id, 'auto');

      v_assigned_count := v_assigned_count + 1;
    ELSE
      -- No available agents, stop trying
      EXIT;
    END IF;
  END LOOP;

  RETURN v_assigned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to manually assign chat to agent
CREATE OR REPLACE FUNCTION assign_chat_to_agent(
  p_session_id UUID,
  p_agent_id UUID,
  p_assigned_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_agent_status VARCHAR;
  v_current_chats INTEGER;
  v_max_chats INTEGER;
BEGIN
  -- Check if agent is available
  SELECT status, current_chat_count, max_concurrent_chats
  INTO v_agent_status, v_current_chats, v_max_chats
  FROM homaradesk_agent_queue
  WHERE admin_id = p_agent_id AND is_logged_in = TRUE;

  IF v_agent_status IS NULL THEN
    RAISE EXCEPTION 'Agent is not logged into the queue';
  END IF;

  IF v_agent_status != 'available' THEN
    RAISE EXCEPTION 'Agent is not available (status: %)', v_agent_status;
  END IF;

  IF v_current_chats >= v_max_chats THEN
    RAISE EXCEPTION 'Agent has reached maximum concurrent chats (%)', v_max_chats;
  END IF;

  -- Assign chat
  UPDATE homaradesk_chat_sessions
  SET 
    assigned_to = p_agent_id,
    assigned_at = NOW(),
    status = 'active'
  WHERE id = p_session_id;

  -- Log assignment
  INSERT INTO homaradesk_chat_assignments (session_id, assigned_to, assigned_by, assignment_type)
  VALUES (p_session_id, p_agent_id, p_assigned_by, 'manual');

  -- Return success
  SELECT jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'assigned_to', p_agent_id,
    'message', 'Chat assigned successfully'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE homaradesk_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE homaradesk_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE homaradesk_agent_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE homaradesk_chat_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat sessions
CREATE POLICY "Admins can view all chat sessions"
  ON homaradesk_chat_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
    )
  );

CREATE POLICY "Admins can update assigned chats"
  ON homaradesk_chat_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
    )
  );

-- RLS Policies for chat messages
CREATE POLICY "Admins can view messages for their chats"
  ON homaradesk_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM homaradesk_chat_sessions cs
      JOIN admins a ON a.id = cs.assigned_to
      WHERE cs.id = homaradesk_chat_messages.session_id
      AND a.user_id = auth.uid()
      AND a.status = 'active'
    )
  );

CREATE POLICY "Admins can insert messages"
  ON homaradesk_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
    )
  );

-- RLS Policies for agent queue
CREATE POLICY "Admins can view agent queue"
  ON homaradesk_agent_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
    )
  );

CREATE POLICY "Admins can manage their own queue status"
  ON homaradesk_agent_queue FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.user_id = auth.uid() 
      AND admins.id = homaradesk_agent_queue.admin_id
      AND admins.status = 'active'
    )
  );

-- RLS Policies for assignments
CREATE POLICY "Admins can view assignments"
  ON homaradesk_chat_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
    )
  );

-- =====================================================
-- 8. GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION agent_queue_login TO authenticated;
GRANT EXECUTE ON FUNCTION agent_queue_logout TO authenticated;
GRANT EXECUTE ON FUNCTION agent_queue_update_status TO authenticated;
GRANT EXECUTE ON FUNCTION agent_queue_update_activity TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_available_agent TO authenticated;
GRANT EXECUTE ON FUNCTION assign_waiting_chats TO authenticated;
GRANT EXECUTE ON FUNCTION assign_chat_to_agent TO authenticated;

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON TABLE homaradesk_chat_sessions IS 'Live chat sessions between visitors and agents';
COMMENT ON TABLE homaradesk_chat_messages IS 'Messages within chat sessions';
COMMENT ON TABLE homaradesk_agent_queue IS 'Agent queue management - tracks agent availability and chat capacity';
COMMENT ON TABLE homaradesk_chat_assignments IS 'Log of chat assignments to agents';

COMMENT ON FUNCTION agent_queue_login IS 'Log an agent into the chat queue';
COMMENT ON FUNCTION agent_queue_logout IS 'Log an agent out of the chat queue and unassign their chats';
COMMENT ON FUNCTION agent_queue_update_status IS 'Update agent status (available/lunch/away)';
COMMENT ON FUNCTION get_next_available_agent IS 'Get the next available agent for chat assignment';
COMMENT ON FUNCTION assign_waiting_chats IS 'Automatically assign waiting chats to available agents';
COMMENT ON FUNCTION assign_chat_to_agent IS 'Manually assign a chat to a specific agent';

