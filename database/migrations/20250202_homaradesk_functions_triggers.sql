-- HomaraDesk Helper Functions and Triggers
-- Created: February 2, 2025

-- =====================================================
-- 1. HELPER FUNCTIONS
-- =====================================================

-- Generate unique ticket number (HD-YYYY-#### format)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS VARCHAR AS $$
DECLARE
  year_part VARCHAR(4);
  sequence_num INTEGER;
  ticket_num VARCHAR(20);
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 8) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM homaradesk_tickets
  WHERE ticket_number LIKE 'HD-' || year_part || '-%';
  
  ticket_num := 'HD-' || year_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
  RETURN ticket_num;
END;
$$ LANGUAGE plpgsql;

-- Update ticket last activity timestamp
CREATE OR REPLACE FUNCTION update_ticket_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE homaradesk_tickets
  SET last_activity_at = NOW()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Log ticket history
CREATE OR REPLACE FUNCTION log_ticket_history()
RETURNS TRIGGER AS $$
DECLARE
  v_action VARCHAR(50);
  v_field_name VARCHAR(100);
  v_old_value TEXT;
  v_new_value TEXT;
  v_performed_by UUID;
  v_performed_by_type VARCHAR(20);
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_performed_by := COALESCE(NEW.created_by, NEW.requester_id);
    v_performed_by_type := CASE 
      WHEN NEW.created_by IS NOT NULL THEN 'admin'
      WHEN NEW.requester_id IS NOT NULL THEN 'user'
      ELSE 'system'
    END;
    
    INSERT INTO homaradesk_ticket_history (
      ticket_id, action, performed_by, performed_by_type, metadata
    ) VALUES (
      NEW.id, v_action, v_performed_by, v_performed_by_type,
      jsonb_build_object(
        'ticket_type', NEW.ticket_type,
        'priority', NEW.priority,
        'status', NEW.status
      )
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check for status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'status_changed';
      v_field_name := 'status';
      v_old_value := OLD.status;
      v_new_value := NEW.status;
      v_performed_by := COALESCE(NEW.updated_by, auth.uid());
      v_performed_by_type := CASE 
        WHEN EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid()) THEN 'admin'
        ELSE 'system'
      END;
      
      INSERT INTO homaradesk_ticket_history (
        ticket_id, action, field_name, old_value, new_value, performed_by, performed_by_type
      ) VALUES (
        NEW.id, v_action, v_field_name, v_old_value, v_new_value, v_performed_by, v_performed_by_type
      );
    END IF;
    
    -- Check for priority change
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      v_action := 'priority_changed';
      v_field_name := 'priority';
      v_old_value := OLD.priority;
      v_new_value := NEW.priority;
      v_performed_by := COALESCE(NEW.updated_by, auth.uid());
      v_performed_by_type := CASE 
        WHEN EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid()) THEN 'admin'
        ELSE 'system'
      END;
      
      INSERT INTO homaradesk_ticket_history (
        ticket_id, action, field_name, old_value, new_value, performed_by, performed_by_type
      ) VALUES (
        NEW.id, v_action, v_field_name, v_old_value, v_new_value, v_performed_by, v_performed_by_type
      );
    END IF;
    
    -- Check for assignment change
    IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
      v_action := 'assigned';
      v_field_name := 'assignee_id';
      v_old_value := OLD.assignee_id::TEXT;
      v_new_value := NEW.assignee_id::TEXT;
      v_performed_by := COALESCE(NEW.updated_by, auth.uid());
      v_performed_by_type := CASE 
        WHEN EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid()) THEN 'admin'
        ELSE 'system'
      END;
      
      -- Update assignment history
      IF OLD.assignee_id IS NOT NULL THEN
        UPDATE homaradesk_ticket_assignments
        SET is_active = FALSE, unassigned_at = NOW()
        WHERE ticket_id = NEW.id AND assignee_id = OLD.assignee_id AND is_active = TRUE;
      END IF;
      
      IF NEW.assignee_id IS NOT NULL THEN
        INSERT INTO homaradesk_ticket_assignments (
          ticket_id, assignee_id, assigned_by, is_active
        ) VALUES (
          NEW.id, NEW.assignee_id, v_performed_by, TRUE
        );
      END IF;
      
      INSERT INTO homaradesk_ticket_history (
        ticket_id, action, field_name, old_value, new_value, performed_by, performed_by_type
      ) VALUES (
        NEW.id, v_action, v_field_name, v_old_value, v_new_value, v_performed_by, v_performed_by_type
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-assign ticket based on rules
CREATE OR REPLACE FUNCTION auto_assign_ticket()
RETURNS TRIGGER AS $$
DECLARE
  v_rule RECORD;
  v_assigned BOOLEAN := FALSE;
BEGIN
  -- Only auto-assign on insert and if not already assigned
  IF TG_OP = 'INSERT' AND NEW.assignee_id IS NULL THEN
    -- Find matching auto-assignment rules (ordered by priority)
    FOR v_rule IN
      SELECT * FROM homaradesk_auto_assignment_rules
      WHERE is_active = TRUE
      AND (
        conditions->>'ticket_type' IS NULL OR conditions->>'ticket_type' = NEW.ticket_type
      )
      AND (
        conditions->>'priority' IS NULL OR conditions->>'priority' = NEW.priority
      )
      AND (
        conditions->>'category' IS NULL OR conditions->>'category' = NEW.category
      )
      ORDER BY rule_priority DESC
      LIMIT 1
    LOOP
      -- Apply assignment
      IF v_rule.assign_to_team_id IS NOT NULL THEN
        NEW.team_id := v_rule.assign_to_team_id;
        v_assigned := TRUE;
      ELSIF v_rule.assign_to_admin_id IS NOT NULL THEN
        NEW.assignee_id := v_rule.assign_to_admin_id;
        v_assigned := TRUE;
      END IF;
      
      -- Apply priority if specified
      IF v_rule.set_priority IS NOT NULL THEN
        NEW.priority := v_rule.set_priority;
      END IF;
      
      -- Add tags if specified
      IF v_rule.add_tags IS NOT NULL AND array_length(v_rule.add_tags, 1) > 0 THEN
        NEW.tags := COALESCE(NEW.tags, ARRAY[]::TEXT[]) || v_rule.add_tags;
      END IF;
      
      EXIT; -- Only apply first matching rule
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calculate SLA due dates
CREATE OR REPLACE FUNCTION calculate_sla_due_dates(
  p_ticket_id UUID,
  p_sla_id UUID
)
RETURNS TABLE (
  first_response_due TIMESTAMP WITH TIME ZONE,
  resolution_due TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_sla RECORD;
  v_created_at TIMESTAMP WITH TIME ZONE;
  v_first_response_minutes INTEGER;
  v_resolution_minutes INTEGER;
BEGIN
  -- Get ticket creation time
  SELECT created_at INTO v_created_at
  FROM homaradesk_tickets
  WHERE id = p_ticket_id;
  
  -- Get SLA details
  SELECT first_response_time, resolution_time
  INTO v_sla
  FROM homaradesk_slas
  WHERE id = p_sla_id AND is_active = TRUE;
  
  IF v_sla IS NULL THEN
    RETURN;
  END IF;
  
  -- Calculate due dates (simple calculation - can be enhanced with business hours)
  first_response_due := v_created_at + (v_sla.first_response_time || ' minutes')::INTERVAL;
  resolution_due := v_created_at + (v_sla.resolution_time || ' minutes')::INTERVAL;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. TRIGGERS
-- =====================================================

-- Auto-generate ticket number on insert
CREATE OR REPLACE FUNCTION trigger_generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_ticket_number
  BEFORE INSERT ON homaradesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_ticket_number();

-- Auto-update last_activity_at on comment
CREATE TRIGGER trg_update_ticket_activity
  AFTER INSERT ON homaradesk_ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_last_activity();

-- Auto-log ticket history
CREATE TRIGGER trg_log_ticket_history
  AFTER INSERT OR UPDATE ON homaradesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_history();

-- Auto-assign ticket
CREATE TRIGGER trg_auto_assign_ticket
  BEFORE INSERT ON homaradesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_ticket();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_tickets_updated_at
  BEFORE UPDATE ON homaradesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_teams_updated_at
  BEFORE UPDATE ON homaradesk_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_slas_updated_at
  BEFORE UPDATE ON homaradesk_slas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_rules_updated_at
  BEFORE UPDATE ON homaradesk_auto_assignment_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_escalation_rules_updated_at
  BEFORE UPDATE ON homaradesk_escalation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_kb_articles_updated_at
  BEFORE UPDATE ON homaradesk_kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

