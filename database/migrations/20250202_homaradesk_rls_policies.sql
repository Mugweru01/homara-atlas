-- HomaraDesk RLS Policies
-- Row-Level Security for ticket system
-- Created: February 2, 2025

-- =====================================================
-- 1. TICKETS TABLE
-- =====================================================

ALTER TABLE homaradesk_tickets ENABLE ROW LEVEL SECURITY;

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
ON homaradesk_tickets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
  OR requester_id = auth.uid()
  OR (
    requester_email IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND email = requester_email
    )
  )
);

-- Users can create tickets
CREATE POLICY "Users can create tickets"
ON homaradesk_tickets FOR INSERT
WITH CHECK (
  requester_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Admins can update all tickets
CREATE POLICY "Admins can update all tickets"
ON homaradesk_tickets FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Users can update own tickets (limited fields)
CREATE POLICY "Users can update own tickets"
ON homaradesk_tickets FOR UPDATE
USING (requester_id = auth.uid())
WITH CHECK (
  requester_id = auth.uid()
  -- Users can only update certain fields (handled in application logic)
);

-- =====================================================
-- 2. COMMENTS TABLE
-- =====================================================

ALTER TABLE homaradesk_ticket_comments ENABLE ROW LEVEL SECURITY;

-- Admins can view all comments
CREATE POLICY "Admins can view all comments"
ON homaradesk_ticket_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
  OR (
    author_id = auth.uid() 
    AND author_type = 'user'
    AND is_public = TRUE
  )
  OR EXISTS (
    SELECT 1 FROM homaradesk_tickets
    WHERE id = ticket_id
    AND requester_id = auth.uid()
    AND is_public = TRUE
  )
);

-- Users can create comments on own tickets
CREATE POLICY "Users can create comments on own tickets"
ON homaradesk_ticket_comments FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND author_type = 'user'
  AND EXISTS (
    SELECT 1 FROM homaradesk_tickets
    WHERE id = ticket_id
    AND requester_id = auth.uid()
  )
);

-- Admins can create comments on any ticket
CREATE POLICY "Admins can create comments"
ON homaradesk_ticket_comments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Admins can update all comments
CREATE POLICY "Admins can update all comments"
ON homaradesk_ticket_comments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Users can update own comments
CREATE POLICY "Users can update own comments"
ON homaradesk_ticket_comments FOR UPDATE
USING (author_id = auth.uid() AND author_type = 'user');

-- =====================================================
-- 3. ATTACHMENTS TABLE
-- =====================================================

ALTER TABLE homaradesk_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Admins can view all attachments
CREATE POLICY "Admins can view all attachments"
ON homaradesk_ticket_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
  OR uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM homaradesk_tickets
    WHERE id = ticket_id
    AND requester_id = auth.uid()
  )
);

-- Users can upload attachments to own tickets
CREATE POLICY "Users can upload attachments"
ON homaradesk_ticket_attachments FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM homaradesk_tickets
    WHERE id = ticket_id
    AND requester_id = auth.uid()
  )
);

-- Admins can upload attachments to any ticket
CREATE POLICY "Admins can upload attachments"
ON homaradesk_ticket_attachments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- =====================================================
-- 4. HISTORY TABLE (Admin only)
-- =====================================================

ALTER TABLE homaradesk_ticket_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ticket history"
ON homaradesk_ticket_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- =====================================================
-- 5. ASSIGNMENTS TABLE (Admin only)
-- =====================================================

ALTER TABLE homaradesk_ticket_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view assignments"
ON homaradesk_ticket_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
  OR assignee_id IN (
    SELECT id FROM admins WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- 6. TEAMS & MEMBERS (Admin only)
-- =====================================================

ALTER TABLE homaradesk_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage teams"
ON homaradesk_teams FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

ALTER TABLE homaradesk_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage team members"
ON homaradesk_team_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- =====================================================
-- 7. SLAs & RULES (Admin only)
-- =====================================================

ALTER TABLE homaradesk_slas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage SLAs"
ON homaradesk_slas FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

ALTER TABLE homaradesk_auto_assignment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage assignment rules"
ON homaradesk_auto_assignment_rules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

ALTER TABLE homaradesk_escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage escalation rules"
ON homaradesk_escalation_rules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- =====================================================
-- 8. KNOWLEDGE BASE (Public read, Admin write)
-- =====================================================

ALTER TABLE homaradesk_kb_articles ENABLE ROW LEVEL SECURITY;

-- Anyone can view published articles
CREATE POLICY "Anyone can view published articles"
ON homaradesk_kb_articles FOR SELECT
USING (is_published = TRUE);

-- Admins can view all articles
CREATE POLICY "Admins can view all articles"
ON homaradesk_kb_articles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Only admins can manage articles
CREATE POLICY "Admins can manage articles"
ON homaradesk_kb_articles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- =====================================================
-- 9. SATISFACTION SURVEYS (Users can submit, Admins can view)
-- =====================================================

ALTER TABLE homaradesk_satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Users can submit surveys for their tickets
CREATE POLICY "Users can submit surveys"
ON homaradesk_satisfaction_surveys FOR INSERT
WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM homaradesk_tickets
    WHERE id = ticket_id
    AND requester_id = auth.uid()
  )
);

-- Admins can view all surveys
CREATE POLICY "Admins can view surveys"
ON homaradesk_satisfaction_surveys FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

