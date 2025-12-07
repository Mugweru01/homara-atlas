-- HomaraDesk Core Tables
-- Comprehensive ticketing and support system
-- Created: February 2, 2025

-- =====================================================
-- 1. SUPPORTING TABLES (Must be created first)
-- =====================================================

-- Teams (for organizing support agents) - Must be created before tickets
CREATE TABLE IF NOT EXISTS homaradesk_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  email VARCHAR(255), -- Team email for routing
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SLA Definitions - Must be created before tickets
CREATE TABLE IF NOT EXISTS homaradesk_slas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Response Times (in minutes)
  first_response_time INTEGER, -- e.g., 60 minutes
  resolution_time INTEGER, -- e.g., 240 minutes (4 hours)
  
  -- Business Hours
  business_hours JSONB, -- {"monday": {"start": "09:00", "end": "17:00"}, ...}
  timezone VARCHAR(50) DEFAULT 'Africa/Nairobi',
  
  -- Applicable to
  ticket_types TEXT[], -- Which ticket types this SLA applies to
  priorities TEXT[], -- Which priorities this SLA applies to
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. CORE TABLES
-- =====================================================

-- Main tickets table
CREATE TABLE IF NOT EXISTS homaradesk_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL, -- HD-2025-0001 format
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Ticket Classification
  ticket_type VARCHAR(50) NOT NULL DEFAULT 'support', -- 'support', 'bug', 'feature_request', 'billing', 'technical', 'admin_issue', 'dispute', 'maintenance'
  category VARCHAR(100), -- 'booking', 'payment', 'property', 'account', 'technical', etc.
  subcategory VARCHAR(100),
  tags TEXT[], -- Array of tags
  
  -- Priority & Status
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent', 'critical'
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'assigned', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'cancelled'
  source VARCHAR(50) DEFAULT 'web', -- 'web', 'email', 'phone', 'api', 'admin', 'system'
  
  -- People Involved
  requester_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Customer/User who created
  requester_email VARCHAR(255), -- For non-registered users
  requester_name VARCHAR(255),
  assignee_id UUID REFERENCES admins(id) ON DELETE SET NULL, -- Assigned admin/agent
  team_id UUID REFERENCES homaradesk_teams(id) ON DELETE SET NULL, -- Assigned team
  
  -- Related Entities (for linking to existing systems)
  related_entity_type VARCHAR(50), -- 'booking', 'payment', 'property', 'user', 'dispute', 'work_order'
  related_entity_id UUID,
  
  -- SLA Management
  sla_id UUID REFERENCES homaradesk_slas(id) ON DELETE SET NULL,
  first_response_due_at TIMESTAMP WITH TIME ZONE,
  resolution_due_at TIMESTAMP WITH TIME ZONE,
  first_response_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Metrics
  first_response_time_minutes INTEGER, -- Time to first response
  resolution_time_minutes INTEGER, -- Time to resolution
  response_count INTEGER DEFAULT 0,
  customer_satisfaction_rating INTEGER, -- 1-5 stars
  customer_satisfaction_feedback TEXT,
  
  -- Metadata
  internal_notes TEXT, -- Private notes visible only to admins
  public_notes TEXT, -- Notes visible to customer
  is_internal BOOLEAN DEFAULT FALSE, -- Internal admin tickets
  is_public BOOLEAN DEFAULT TRUE, -- Visible to requester
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Audit
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL, -- If created by admin
  closed_by UUID REFERENCES admins(id) ON DELETE SET NULL
);

-- Ticket Comments/Updates
CREATE TABLE IF NOT EXISTS homaradesk_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  comment_type VARCHAR(20) DEFAULT 'comment', -- 'comment', 'note', 'system', 'email_reply'
  
  -- Author
  author_id UUID, -- Can be admin or user
  author_type VARCHAR(20), -- 'admin', 'user', 'system'
  author_name VARCHAR(255),
  author_email VARCHAR(255),
  
  -- Content
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE, -- Internal note (not visible to customer)
  is_public BOOLEAN DEFAULT TRUE,
  
  -- Attachments
  attachments JSONB, -- Array of file URLs/metadata
  
  -- Email Integration
  email_message_id VARCHAR(255), -- For email replies
  email_thread_id VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  edited_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  edited BOOLEAN DEFAULT FALSE,
  edit_reason TEXT
);

-- Ticket Attachments
CREATE TABLE IF NOT EXISTS homaradesk_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES homaradesk_ticket_comments(id) ON DELETE CASCADE,
  
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  file_type VARCHAR(100),
  mime_type VARCHAR(100),
  
  uploaded_by UUID, -- Admin or user ID
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ticket History/Audit Log
CREATE TABLE IF NOT EXISTS homaradesk_ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  
  action VARCHAR(50) NOT NULL, -- 'created', 'assigned', 'status_changed', 'priority_changed', 'commented', etc.
  field_name VARCHAR(100), -- Which field changed
  old_value TEXT,
  new_value TEXT,
  
  performed_by UUID, -- Admin or system
  performed_by_type VARCHAR(20), -- 'admin', 'user', 'system'
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  metadata JSONB -- Additional context
);

-- Ticket Assignments (for tracking assignment history)
CREATE TABLE IF NOT EXISTS homaradesk_ticket_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  team_id UUID REFERENCES homaradesk_teams(id) ON DELETE SET NULL,
  
  assigned_by UUID REFERENCES admins(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unassigned_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

-- =====================================================
-- 3. ADDITIONAL SUPPORTING TABLES
-- =====================================================

-- Team Members
CREATE TABLE IF NOT EXISTS homaradesk_team_members (
  team_id UUID REFERENCES homaradesk_teams(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- 'lead', 'member'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (team_id, admin_id)
);

-- Auto-Assignment Rules
CREATE TABLE IF NOT EXISTS homaradesk_auto_assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Conditions (JSONB for flexibility)
  conditions JSONB NOT NULL, -- {"ticket_type": "billing", "priority": "high", ...}
  
  -- Actions
  assign_to_team_id UUID REFERENCES homaradesk_teams(id),
  assign_to_admin_id UUID REFERENCES admins(id),
  set_priority VARCHAR(20),
  add_tags TEXT[],
  
  -- Priority (for multiple matching rules)
  rule_priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escalation Rules
CREATE TABLE IF NOT EXISTS homaradesk_escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  
  -- Trigger Conditions
  trigger_after_minutes INTEGER, -- Escalate after X minutes
  trigger_on_status TEXT[], -- Which statuses trigger escalation
  trigger_on_priority TEXT[], -- Which priorities
  
  -- Escalation Actions
  escalate_to_team_id UUID REFERENCES homaradesk_teams(id),
  escalate_to_admin_id UUID REFERENCES admins(id),
  increase_priority_to VARCHAR(20),
  notify_admins TEXT[], -- Admin IDs to notify
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge Base Articles
CREATE TABLE IF NOT EXISTS homaradesk_kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  
  category VARCHAR(100),
  tags TEXT[],
  
  -- SEO
  slug VARCHAR(255) UNIQUE,
  meta_description TEXT,
  
  -- Visibility
  is_published BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  
  -- Metrics
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  
  -- Author
  author_id UUID REFERENCES admins(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Ticket-KB Article Links
CREATE TABLE IF NOT EXISTS homaradesk_ticket_kb_links (
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  kb_article_id UUID REFERENCES homaradesk_kb_articles(id) ON DELETE CASCADE,
  suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (ticket_id, kb_article_id)
);

-- Customer Satisfaction Surveys
CREATE TABLE IF NOT EXISTS homaradesk_satisfaction_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  
  rating INTEGER NOT NULL, -- 1-5
  feedback TEXT,
  would_recommend BOOLEAN,
  
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_by UUID -- User ID
);

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================

-- Ticket indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON homaradesk_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON homaradesk_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON homaradesk_tickets(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON homaradesk_tickets(requester_id) WHERE requester_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_created ON homaradesk_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON homaradesk_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_related_entity ON homaradesk_tickets(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_due ON homaradesk_tickets(first_response_due_at, resolution_due_at) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX IF NOT EXISTS idx_tickets_last_activity ON homaradesk_tickets(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_team ON homaradesk_tickets(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_number ON homaradesk_tickets(ticket_number);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_tickets_search ON homaradesk_tickets USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Comment indexes
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON homaradesk_ticket_comments(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_author ON homaradesk_ticket_comments(author_id, author_type);

-- History indexes
CREATE INDEX IF NOT EXISTS idx_history_ticket ON homaradesk_ticket_history(ticket_id, performed_at DESC);

-- Assignment indexes
CREATE INDEX IF NOT EXISTS idx_assignments_ticket ON homaradesk_ticket_assignments(ticket_id, is_active);
CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON homaradesk_ticket_assignments(assignee_id, is_active) WHERE assignee_id IS NOT NULL;

-- Attachment indexes
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON homaradesk_ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_comment ON homaradesk_ticket_attachments(comment_id) WHERE comment_id IS NOT NULL;

