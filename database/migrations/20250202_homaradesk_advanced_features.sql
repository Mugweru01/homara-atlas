-- HomaraDesk Advanced Features
-- Quick Wins + Priority 1 Features
-- Created: February 2, 2025

-- =====================================================
-- 1. TICKET MERGING
-- =====================================================

-- Add merge tracking to tickets
ALTER TABLE homaradesk_tickets
ADD COLUMN IF NOT EXISTS merged_from_ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS merged_into_ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS merge_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_merged_from ON homaradesk_tickets(merged_from_ticket_id) WHERE merged_from_ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_merged_into ON homaradesk_tickets(merged_into_ticket_id) WHERE merged_into_ticket_id IS NOT NULL;

-- Ticket merge history
CREATE TABLE IF NOT EXISTS homaradesk_ticket_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  target_ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  merged_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  merge_reason TEXT,
  merged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_merges_source ON homaradesk_ticket_merges(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_merges_target ON homaradesk_ticket_merges(target_ticket_id);

-- =====================================================
-- 2. CANNED RESPONSES
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags TEXT[],
  is_shared BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE, -- Visible to customers in portal
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  team_id UUID REFERENCES homaradesk_teams(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canned_responses_category ON homaradesk_canned_responses(category);
CREATE INDEX IF NOT EXISTS idx_canned_responses_shared ON homaradesk_canned_responses(is_shared);
CREATE INDEX IF NOT EXISTS idx_canned_responses_created_by ON homaradesk_canned_responses(created_by);

-- =====================================================
-- 3. TICKET WATCHERS
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_ticket_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ticket_id, admin_id),
  UNIQUE(ticket_id, user_id),
  CHECK ((admin_id IS NOT NULL AND user_id IS NULL) OR (admin_id IS NULL AND user_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_ticket_watchers_ticket ON homaradesk_ticket_watchers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_admin ON homaradesk_ticket_watchers(admin_id) WHERE admin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_user ON homaradesk_ticket_watchers(user_id) WHERE user_id IS NOT NULL;

-- =====================================================
-- 4. TIME TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  time_spent_minutes INTEGER NOT NULL,
  billable BOOLEAN DEFAULT TRUE,
  category VARCHAR(100), -- 'research', 'communication', 'development', 'testing', etc.
  description TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK ((agent_id IS NOT NULL AND user_id IS NULL) OR (agent_id IS NULL AND user_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_time_entries_ticket ON homaradesk_time_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_agent ON homaradesk_time_entries(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON homaradesk_time_entries(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_billable ON homaradesk_time_entries(billable);

-- Add total time tracking to tickets
ALTER TABLE homaradesk_tickets
ADD COLUMN IF NOT EXISTS total_time_spent_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS billable_time_minutes INTEGER DEFAULT 0;

-- =====================================================
-- 5. TICKET RELATIONSHIPS
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_ticket_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  target_ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN (
    'parent', 'child', 'related', 'duplicate', 'blocked_by', 'blocks', 'follows_up', 'followed_by'
  )),
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_ticket_id, target_ticket_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_ticket_relationships_source ON homaradesk_ticket_relationships(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relationships_target ON homaradesk_ticket_relationships(target_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relationships_type ON homaradesk_ticket_relationships(relationship_type);

-- =====================================================
-- 6. SAVED SEARCHES
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  search_query JSONB NOT NULL, -- Store all filter criteria
  is_shared BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  team_id UUID REFERENCES homaradesk_teams(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_created_by ON homaradesk_saved_searches(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_searches_shared ON homaradesk_saved_searches(is_shared);

-- =====================================================
-- 7. MACROS (CANNED ACTIONS)
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  actions JSONB NOT NULL, -- Array of actions to perform
  -- Example: [{"type": "update_status", "value": "resolved"}, {"type": "add_comment", "value": "..."}]
  is_shared BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  team_id UUID REFERENCES homaradesk_teams(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_macros_created_by ON homaradesk_macros(created_by);
CREATE INDEX IF NOT EXISTS idx_macros_shared ON homaradesk_macros(is_shared);
CREATE INDEX IF NOT EXISTS idx_macros_active ON homaradesk_macros(is_active);

-- =====================================================
-- 8. WORKFLOWS
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL, -- 'ticket_created', 'ticket_updated', 'status_changed', 'time_based', etc.
  trigger_conditions JSONB, -- Conditions that must be met
  actions JSONB NOT NULL, -- Array of actions to perform
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0, -- Execution order
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_active ON homaradesk_workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON homaradesk_workflows(trigger_type);

-- Workflow execution history
CREATE TABLE IF NOT EXISTS homaradesk_workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES homaradesk_workflows(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON homaradesk_workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_ticket ON homaradesk_workflow_executions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON homaradesk_workflow_executions(status);

-- =====================================================
-- 9. CUSTOM FIELDS
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN (
    'text', 'textarea', 'number', 'date', 'datetime', 'dropdown', 'multi_select', 
    'checkbox', 'radio', 'file', 'url', 'email', 'phone'
  )),
  field_options JSONB, -- For dropdown, multi_select, radio
  is_required BOOLEAN DEFAULT FALSE,
  is_visible_to_customer BOOLEAN DEFAULT FALSE,
  is_editable_by_customer BOOLEAN DEFAULT FALSE,
  default_value TEXT,
  validation_rules JSONB, -- Min/max length, regex, etc.
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_active ON homaradesk_custom_fields(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_fields_display_order ON homaradesk_custom_fields(display_order);

-- Custom field values per ticket
CREATE TABLE IF NOT EXISTS homaradesk_ticket_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  custom_field_id UUID REFERENCES homaradesk_custom_fields(id) ON DELETE CASCADE,
  field_value TEXT,
  field_value_json JSONB, -- For complex values (multi-select, etc.)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ticket_id, custom_field_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_custom_fields_ticket ON homaradesk_ticket_custom_fields(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_custom_fields_field ON homaradesk_ticket_custom_fields(custom_field_id);

-- =====================================================
-- 10. ADVANCED SLA - HOLIDAY CALENDARS
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_holiday_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS homaradesk_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID REFERENCES homaradesk_holiday_calendars(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  holiday_name VARCHAR(255) NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE, -- Annual recurring holidays
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(calendar_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_calendar ON homaradesk_holidays(calendar_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON homaradesk_holidays(holiday_date);

-- Link SLA to holiday calendar
ALTER TABLE homaradesk_slas
ADD COLUMN IF NOT EXISTS holiday_calendar_id UUID REFERENCES homaradesk_holiday_calendars(id) ON DELETE SET NULL;

-- =====================================================
-- 11. SATISFACTION SURVEYS
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  survey_type VARCHAR(50) NOT NULL CHECK (survey_type IN ('csat', 'nps', 'custom')),
  trigger_event VARCHAR(50) NOT NULL, -- 'ticket_closed', 'ticket_resolved', 'manual'
  trigger_delay_minutes INTEGER DEFAULT 0, -- Delay before sending
  questions JSONB NOT NULL, -- Array of questions
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_active ON homaradesk_surveys(is_active);
CREATE INDEX IF NOT EXISTS idx_surveys_trigger_event ON homaradesk_surveys(trigger_event);

-- Survey responses
CREATE TABLE IF NOT EXISTS homaradesk_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES homaradesk_surveys(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responses JSONB NOT NULL, -- Store all question responses
  overall_rating INTEGER, -- 1-5 for CSAT, 0-10 for NPS
  feedback_text TEXT,
  responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON homaradesk_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_ticket ON homaradesk_survey_responses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_rating ON homaradesk_survey_responses(overall_rating);

-- =====================================================
-- 12. EMAIL INTEGRATION
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email_address VARCHAR(255) NOT NULL,
  email_provider VARCHAR(50), -- 'gmail', 'outlook', 'imap', 'pop3', 'smtp'
  imap_host VARCHAR(255),
  imap_port INTEGER,
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  username VARCHAR(255),
  password_encrypted TEXT, -- Encrypted password
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS homaradesk_email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id UUID REFERENCES homaradesk_email_accounts(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE SET NULL,
  message_id VARCHAR(500), -- Email message ID
  thread_id VARCHAR(500), -- Email thread ID
  from_email VARCHAR(255),
  to_email VARCHAR(255),
  cc_emails TEXT[],
  bcc_emails TEXT[],
  subject VARCHAR(500),
  body_text TEXT,
  body_html TEXT,
  direction VARCHAR(20) CHECK (direction IN ('inbound', 'outbound')),
  status VARCHAR(50) DEFAULT 'received', -- 'received', 'sent', 'failed', 'pending'
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attachments JSONB -- Array of attachment info
);

CREATE INDEX IF NOT EXISTS idx_email_messages_ticket ON homaradesk_email_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON homaradesk_email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON homaradesk_email_messages(direction);

-- =====================================================
-- 13. LIVE CHAT
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE SET NULL,
  visitor_id VARCHAR(255), -- Anonymous visitor ID
  visitor_name VARCHAR(255),
  visitor_email VARCHAR(255),
  visitor_ip VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'waiting', 'chatting', 'ended'
  assigned_to UUID REFERENCES admins(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB -- Browser, location, etc.
);

CREATE TABLE IF NOT EXISTS homaradesk_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES homaradesk_chat_sessions(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) CHECK (sender_type IN ('visitor', 'agent', 'system')),
  sender_id UUID, -- admin_id or visitor_id
  message_text TEXT NOT NULL,
  attachments JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON homaradesk_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON homaradesk_chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_assigned ON homaradesk_chat_sessions(assigned_to) WHERE assigned_to IS NOT NULL;

-- =====================================================
-- 14. MENTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES homaradesk_ticket_comments(id) ON DELETE CASCADE,
  mentioned_admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  mentioned_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  CHECK ((mentioned_admin_id IS NOT NULL AND mentioned_user_id IS NULL) OR 
        (mentioned_admin_id IS NULL AND mentioned_user_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_mentions_ticket ON homaradesk_mentions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON homaradesk_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_mentions_admin ON homaradesk_mentions(mentioned_admin_id) WHERE mentioned_admin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_user ON homaradesk_mentions(mentioned_user_id) WHERE mentioned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentions_read ON homaradesk_mentions(is_read);

-- =====================================================
-- 15. RLS POLICIES
-- =====================================================

-- Canned Responses RLS
ALTER TABLE homaradesk_canned_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all canned responses"
  ON homaradesk_canned_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid() AND admins.status = 'active'
    )
  );

CREATE POLICY "Admins can create canned responses"
  ON homaradesk_canned_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid() AND admins.status = 'active'
    )
  );

CREATE POLICY "Admins can update their own or shared canned responses"
  ON homaradesk_canned_responses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid() AND admins.status = 'active'
    ) AND (
      created_by = (SELECT id FROM admins WHERE user_id = auth.uid() LIMIT 1) OR
      is_shared = TRUE
    )
  );

-- Ticket Watchers RLS
ALTER TABLE homaradesk_ticket_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watchers"
  ON homaradesk_ticket_watchers FOR SELECT
  USING (
    admin_id = (SELECT id FROM admins WHERE user_id = auth.uid() LIMIT 1) OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can add themselves as watchers"
  ON homaradesk_ticket_watchers FOR INSERT
  WITH CHECK (
    admin_id = (SELECT id FROM admins WHERE user_id = auth.uid() LIMIT 1) OR
    user_id = auth.uid()
  );

-- Time Entries RLS
ALTER TABLE homaradesk_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all time entries"
  ON homaradesk_time_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid() AND admins.status = 'active'
    )
  );

CREATE POLICY "Users can create their own time entries"
  ON homaradesk_time_entries FOR INSERT
  WITH CHECK (
    agent_id = (SELECT id FROM admins WHERE user_id = auth.uid() LIMIT 1) OR
    user_id = auth.uid()
  );

-- Ticket Relationships RLS
ALTER TABLE homaradesk_ticket_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all ticket relationships"
  ON homaradesk_ticket_relationships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid() AND admins.status = 'active'
    )
  );

-- Saved Searches RLS
ALTER TABLE homaradesk_saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own or shared searches"
  ON homaradesk_saved_searches FOR SELECT
  USING (
    created_by = (SELECT id FROM admins WHERE user_id = auth.uid() LIMIT 1) OR
    is_shared = TRUE
  );

-- Macros RLS
ALTER TABLE homaradesk_macros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all macros"
  ON homaradesk_macros FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid() AND admins.status = 'active'
    )
  );

-- Workflows RLS
ALTER TABLE homaradesk_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all workflows"
  ON homaradesk_workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid() AND admins.status = 'active'
    )
  );

-- Custom Fields RLS
ALTER TABLE homaradesk_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all custom fields"
  ON homaradesk_custom_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid() AND admins.status = 'active'
    )
  );

-- Mentions RLS
ALTER TABLE homaradesk_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mentions"
  ON homaradesk_mentions FOR SELECT
  USING (
    mentioned_admin_id = (SELECT id FROM admins WHERE user_id = auth.uid() LIMIT 1) OR
    mentioned_user_id = auth.uid()
  );

-- Grant permissions
GRANT ALL ON homaradesk_ticket_merges TO authenticated;
GRANT ALL ON homaradesk_canned_responses TO authenticated;
GRANT ALL ON homaradesk_ticket_watchers TO authenticated;
GRANT ALL ON homaradesk_time_entries TO authenticated;
GRANT ALL ON homaradesk_ticket_relationships TO authenticated;
GRANT ALL ON homaradesk_saved_searches TO authenticated;
GRANT ALL ON homaradesk_macros TO authenticated;
GRANT ALL ON homaradesk_workflows TO authenticated;
GRANT ALL ON homaradesk_workflow_executions TO authenticated;
GRANT ALL ON homaradesk_custom_fields TO authenticated;
GRANT ALL ON homaradesk_ticket_custom_fields TO authenticated;
GRANT ALL ON homaradesk_holiday_calendars TO authenticated;
GRANT ALL ON homaradesk_holidays TO authenticated;
GRANT ALL ON homaradesk_surveys TO authenticated;
GRANT ALL ON homaradesk_survey_responses TO authenticated;
GRANT ALL ON homaradesk_email_accounts TO authenticated;
GRANT ALL ON homaradesk_email_messages TO authenticated;
GRANT ALL ON homaradesk_chat_sessions TO authenticated;
GRANT ALL ON homaradesk_chat_messages TO authenticated;
GRANT ALL ON homaradesk_mentions TO authenticated;

