-- HomaraDesk Integrations
-- CRM, Dispute, Maintenance, and Notification integrations
-- Created: February 2, 2025

-- =====================================================
-- 1. ADD CRM CONTACT LINK TO TICKETS
-- =====================================================

-- Add CRM contact reference to tickets table
ALTER TABLE homaradesk_tickets
ADD COLUMN IF NOT EXISTS crm_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL;

-- Create index for CRM contact lookups
CREATE INDEX IF NOT EXISTS idx_tickets_crm_contact ON homaradesk_tickets(crm_contact_id) WHERE crm_contact_id IS NOT NULL;

-- =====================================================
-- 2. AUTO-CREATE CRM CONTACT FROM TICKET FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION auto_create_crm_contact_from_ticket()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id UUID;
  v_admin_id UUID;
BEGIN
  -- Only process if ticket has requester info and no CRM contact linked
  IF NEW.crm_contact_id IS NULL AND (NEW.requester_email IS NOT NULL OR NEW.requester_id IS NOT NULL) THEN
    -- Get current admin user ID if available
    SELECT id INTO v_admin_id
    FROM admins
    WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1;

    -- Try to find existing contact by email or user_id
    IF NEW.requester_email IS NOT NULL THEN
      SELECT id INTO v_contact_id
      FROM crm_contacts
      WHERE email = NEW.requester_email
      LIMIT 1;
    END IF;

    -- If not found by email, try by user_id
    IF v_contact_id IS NULL AND NEW.requester_id IS NOT NULL THEN
      SELECT id INTO v_contact_id
      FROM crm_contacts
      WHERE user_id = NEW.requester_id
      LIMIT 1;
    END IF;

    -- If still not found, create new contact
    IF v_contact_id IS NULL THEN
      INSERT INTO crm_contacts (
        user_id,
        email,
        first_name,
        last_name,
        full_name,
        phone,
        contact_type,
        status,
        source,
        source_details,
        created_by
      ) VALUES (
        NEW.requester_id,
        NEW.requester_email,
        SPLIT_PART(COALESCE(NEW.requester_name, ''), ' ', 1),
        CASE 
          WHEN POSITION(' ' IN COALESCE(NEW.requester_name, '')) > 0 
          THEN SUBSTRING(COALESCE(NEW.requester_name, '') FROM POSITION(' ' IN COALESCE(NEW.requester_name, '')) + 1)
          ELSE NULL
        END,
        NEW.requester_name,
        NULL, -- Phone not available from ticket
        'customer',
        'active',
        'homaradesk_ticket',
        jsonb_build_object('ticket_id', NEW.id, 'ticket_number', NEW.ticket_number),
        v_admin_id
      )
      RETURNING id INTO v_contact_id;
    END IF;

    -- Link ticket to CRM contact
    NEW.crm_contact_id := v_contact_id;

    -- Create CRM activity for ticket creation
    INSERT INTO crm_activities (
      contact_id,
      user_id,
      activity_type,
      subject,
      description,
      related_record_type,
      related_record_id,
      activity_data,
      created_by
    ) VALUES (
      v_contact_id,
      NEW.requester_id,
      'note_added',
      'Support Ticket Created',
      'Ticket #' || NEW.ticket_number || ': ' || NEW.title,
      'homaradesk_ticket',
      NEW.id,
      jsonb_build_object(
        'ticket_number', NEW.ticket_number,
        'ticket_type', NEW.ticket_type,
        'priority', NEW.priority,
        'status', NEW.status
      ),
      v_admin_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create CRM contact
DROP TRIGGER IF EXISTS auto_create_crm_contact_from_ticket_trigger ON homaradesk_tickets;
CREATE TRIGGER auto_create_crm_contact_from_ticket_trigger
  BEFORE INSERT ON homaradesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_crm_contact_from_ticket();

-- =====================================================
-- 3. SYNC TICKET UPDATES TO CRM ACTIVITIES
-- =====================================================

CREATE OR REPLACE FUNCTION sync_ticket_updates_to_crm()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Only process if ticket has CRM contact linked
  IF NEW.crm_contact_id IS NOT NULL THEN
    -- Get current admin user ID if available
    SELECT id INTO v_admin_id
    FROM admins
    WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1;

    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO crm_activities (
        contact_id,
        user_id,
        activity_type,
        subject,
        description,
        related_record_type,
        related_record_id,
        activity_data,
        created_by
      ) VALUES (
        NEW.crm_contact_id,
        NEW.requester_id,
        'note_added',
        'Ticket Status Updated',
        'Ticket #' || NEW.ticket_number || ' status changed from ' || COALESCE(OLD.status, 'N/A') || ' to ' || NEW.status,
        'homaradesk_ticket',
        NEW.id,
        jsonb_build_object(
          'ticket_number', NEW.ticket_number,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'updated_by', v_admin_id
        ),
        v_admin_id
      );
    END IF;

    -- Log resolution
    IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
      INSERT INTO crm_activities (
        contact_id,
        user_id,
        activity_type,
        subject,
        description,
        related_record_type,
        related_record_id,
        activity_data,
        created_by
      ) VALUES (
        NEW.crm_contact_id,
        NEW.requester_id,
        'note_added',
        'Ticket Resolved',
        'Ticket #' || NEW.ticket_number || ' has been resolved',
        'homaradesk_ticket',
        NEW.id,
        jsonb_build_object(
          'ticket_number', NEW.ticket_number,
          'resolved_at', NEW.resolved_at,
          'resolution_time_minutes', NEW.resolution_time_minutes
        ),
        v_admin_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync ticket updates
DROP TRIGGER IF EXISTS sync_ticket_updates_to_crm_trigger ON homaradesk_tickets;
CREATE TRIGGER sync_ticket_updates_to_crm_trigger
  AFTER UPDATE ON homaradesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION sync_ticket_updates_to_crm();

-- =====================================================
-- 4. NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS homaradesk_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES homaradesk_tickets(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'ticket_assigned', 'ticket_updated', 'ticket_comment', 'ticket_resolved', 'sla_breach', 'sla_warning'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON homaradesk_notifications(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_admin ON homaradesk_notifications(admin_id) WHERE admin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_ticket ON homaradesk_notifications(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_read ON homaradesk_notifications(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON homaradesk_notifications(notification_type);

-- RLS for notifications
ALTER TABLE homaradesk_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
  ON homaradesk_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid() AND admins.status = 'active'
    )
  );

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON homaradesk_notifications FOR SELECT
  USING (user_id = auth.uid());

-- System can create notifications
CREATE POLICY "System can create notifications"
  ON homaradesk_notifications FOR INSERT
  WITH CHECK (true);

-- Users and admins can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON homaradesk_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update their own notifications"
  ON homaradesk_notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = homaradesk_notifications.admin_id AND admins.user_id = auth.uid() AND admins.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = homaradesk_notifications.admin_id AND admins.user_id = auth.uid() AND admins.status = 'active'
    )
  );

-- =====================================================
-- 5. NOTIFICATION TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION create_ticket_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_admin_user_id UUID;
BEGIN
  -- Ticket assigned notification
  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id AND NEW.assignee_id IS NOT NULL THEN
    -- Get admin user_id
    SELECT user_id INTO v_admin_user_id
    FROM admins
    WHERE id = NEW.assignee_id;

    IF v_admin_user_id IS NOT NULL THEN
      INSERT INTO homaradesk_notifications (
        admin_id,
        ticket_id,
        notification_type,
        title,
        message,
        metadata
      ) VALUES (
        NEW.assignee_id,
        NEW.id,
        'ticket_assigned',
        'New Ticket Assigned',
        'Ticket #' || NEW.ticket_number || ' has been assigned to you',
        jsonb_build_object(
          'ticket_number', NEW.ticket_number,
          'title', NEW.title,
          'priority', NEW.priority
        )
      );
    END IF;
  END IF;

  -- Ticket status change notification to requester
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.requester_id IS NOT NULL THEN
    INSERT INTO homaradesk_notifications (
      user_id,
      ticket_id,
      notification_type,
      title,
      message,
      metadata
    ) VALUES (
      NEW.requester_id,
      NEW.id,
      'ticket_updated',
      'Ticket Status Updated',
      'Your ticket #' || NEW.ticket_number || ' status has been updated to ' || NEW.status,
      jsonb_build_object(
        'ticket_number', NEW.ticket_number,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for ticket notifications
DROP TRIGGER IF EXISTS create_ticket_notifications_trigger ON homaradesk_tickets;
CREATE TRIGGER create_ticket_notifications_trigger
  AFTER UPDATE ON homaradesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION create_ticket_notifications();

-- Comment notification function
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket RECORD;
  v_commenter_is_admin BOOLEAN;
BEGIN
  -- Get ticket info
  SELECT * INTO v_ticket
  FROM homaradesk_tickets
  WHERE id = NEW.ticket_id;

  -- Check if commenter is admin
  SELECT EXISTS (
    SELECT 1 FROM admins
    WHERE user_id = auth.uid() AND status = 'active'
  ) INTO v_commenter_is_admin;

  -- Notify requester if admin commented
  IF v_commenter_is_admin AND v_ticket.requester_id IS NOT NULL THEN
    INSERT INTO homaradesk_notifications (
      user_id,
      ticket_id,
      notification_type,
      title,
      message,
      metadata
    ) VALUES (
      v_ticket.requester_id,
      NEW.ticket_id,
      'ticket_comment',
      'New Response on Your Ticket',
      'You have a new response on ticket #' || v_ticket.ticket_number,
      jsonb_build_object(
        'ticket_number', v_ticket.ticket_number,
        'comment_id', NEW.id
      )
    );
  END IF;

  -- Notify assignee if customer commented
  IF NOT v_commenter_is_admin AND v_ticket.assignee_id IS NOT NULL THEN
    INSERT INTO homaradesk_notifications (
      admin_id,
      ticket_id,
      notification_type,
      title,
      message,
      metadata
    ) VALUES (
      v_ticket.assignee_id,
      NEW.ticket_id,
      'ticket_comment',
      'New Comment on Ticket',
      'Ticket #' || v_ticket.ticket_number || ' has a new comment',
      jsonb_build_object(
        'ticket_number', v_ticket.ticket_number,
        'comment_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment notifications
DROP TRIGGER IF EXISTS create_comment_notification_trigger ON homaradesk_ticket_comments;
CREATE TRIGGER create_comment_notification_trigger
  AFTER INSERT ON homaradesk_ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notification();

-- Grant permissions
GRANT EXECUTE ON FUNCTION auto_create_crm_contact_from_ticket TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_ticket_updates_to_crm TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_ticket_notifications TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_comment_notification TO authenticated, service_role;

