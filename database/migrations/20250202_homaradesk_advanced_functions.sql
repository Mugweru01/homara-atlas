-- HomaraDesk Advanced Features - Helper Functions
-- Created: February 2, 2025

-- =====================================================
-- 1. TICKET MERGE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION merge_tickets(
  p_source_ticket_id UUID,
  p_target_ticket_id UUID,
  p_merge_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_source_ticket RECORD;
  v_target_ticket RECORD;
BEGIN
  -- Get current admin
  SELECT id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can merge tickets';
  END IF;

  -- Get source ticket
  SELECT * INTO v_source_ticket
  FROM homaradesk_tickets
  WHERE id = p_source_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source ticket not found';
  END IF;

  -- Get target ticket
  SELECT * INTO v_target_ticket
  FROM homaradesk_tickets
  WHERE id = p_target_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target ticket not found';
  END IF;

  -- Prevent merging into itself
  IF p_source_ticket_id = p_target_ticket_id THEN
    RAISE EXCEPTION 'Cannot merge ticket into itself';
  END IF;

  -- Prevent merging already merged tickets
  IF v_source_ticket.merged_into_ticket_id IS NOT NULL THEN
    RAISE EXCEPTION 'Source ticket is already merged';
  END IF;

  -- Update source ticket
  UPDATE homaradesk_tickets
  SET
    merged_into_ticket_id = p_target_ticket_id,
    merge_reason = p_merge_reason,
    status = 'closed',
    closed_at = NOW(),
    closed_by = v_admin_id,
    updated_at = NOW()
  WHERE id = p_source_ticket_id;

  -- Move comments from source to target
  UPDATE homaradesk_ticket_comments
  SET ticket_id = p_target_ticket_id
  WHERE ticket_id = p_source_ticket_id;

  -- Move attachments from source to target
  UPDATE homaradesk_ticket_attachments
  SET ticket_id = p_target_ticket_id
  WHERE ticket_id = p_source_ticket_id;

  -- Move time entries from source to target
  UPDATE homaradesk_time_entries
  SET ticket_id = p_target_ticket_id
  WHERE ticket_id = p_source_ticket_id;

  -- Move watchers from source to target
  INSERT INTO homaradesk_ticket_watchers (ticket_id, admin_id, user_id)
  SELECT p_target_ticket_id, admin_id, user_id
  FROM homaradesk_ticket_watchers
  WHERE ticket_id = p_source_ticket_id
  ON CONFLICT DO NOTHING;

  -- Record merge history
  INSERT INTO homaradesk_ticket_merges (
    source_ticket_id,
    target_ticket_id,
    merged_by,
    merge_reason
  ) VALUES (
    p_source_ticket_id,
    p_target_ticket_id,
    v_admin_id,
    p_merge_reason
  );

  -- Add comment to target ticket about merge
  INSERT INTO homaradesk_ticket_comments (
    ticket_id,
    content,
    author_type,
    author_id,
    is_internal
  ) VALUES (
    p_target_ticket_id,
    'Ticket #' || v_source_ticket.ticket_number || ' has been merged into this ticket.' || 
    CASE WHEN p_merge_reason IS NOT NULL THEN ' Reason: ' || p_merge_reason ELSE '' END,
    'admin',
    v_admin_id,
    TRUE
  );

  -- Update target ticket's last activity
  UPDATE homaradesk_tickets
  SET last_activity_at = NOW()
  WHERE id = p_target_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Tickets merged successfully',
    'source_ticket', v_source_ticket.ticket_number,
    'target_ticket', v_target_ticket.ticket_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. UPDATE TIME TRACKING ON TICKETS
-- =====================================================

CREATE OR REPLACE FUNCTION update_ticket_time_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total time spent on ticket
  UPDATE homaradesk_tickets
  SET
    total_time_spent_minutes = (
      SELECT COALESCE(SUM(time_spent_minutes), 0)
      FROM homaradesk_time_entries
      WHERE ticket_id = NEW.ticket_id
    ),
    billable_time_minutes = (
      SELECT COALESCE(SUM(time_spent_minutes), 0)
      FROM homaradesk_time_entries
      WHERE ticket_id = NEW.ticket_id AND billable = TRUE
    ),
    updated_at = NOW()
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update time tracking
DROP TRIGGER IF EXISTS update_ticket_time_tracking_trigger ON homaradesk_time_entries;
CREATE TRIGGER update_ticket_time_tracking_trigger
  AFTER INSERT OR UPDATE OR DELETE ON homaradesk_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_time_tracking();

-- =====================================================
-- 3. INCREMENT CANNED RESPONSE USAGE
-- =====================================================

CREATE OR REPLACE FUNCTION increment_canned_response_usage(p_response_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE homaradesk_canned_responses
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = p_response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. INCREMENT MACRO USAGE
-- =====================================================

CREATE OR REPLACE FUNCTION increment_macro_usage(p_macro_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE homaradesk_macros
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = p_macro_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. INCREMENT SAVED SEARCH USAGE
-- =====================================================

CREATE OR REPLACE FUNCTION increment_saved_search_usage(p_search_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE homaradesk_saved_searches
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = p_search_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. EXECUTE MACRO
-- =====================================================

CREATE OR REPLACE FUNCTION execute_macro(
  p_macro_id UUID,
  p_ticket_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_macro RECORD;
  v_admin_id UUID;
  v_action RECORD;
  v_result JSONB := '[]'::jsonb;
BEGIN
  -- Get current admin
  SELECT id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can execute macros';
  END IF;

  -- Get macro
  SELECT * INTO v_macro
  FROM homaradesk_macros
  WHERE id = p_macro_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Macro not found or inactive';
  END IF;

  -- Execute each action
  FOR v_action IN SELECT * FROM jsonb_array_elements(v_macro.actions)
  LOOP
    CASE v_action->>'type'
      WHEN 'update_status' THEN
        UPDATE homaradesk_tickets
        SET status = v_action->>'value', updated_at = NOW()
        WHERE id = p_ticket_id;
        v_result := v_result || jsonb_build_object('action', 'update_status', 'success', true);

      WHEN 'update_priority' THEN
        UPDATE homaradesk_tickets
        SET priority = v_action->>'value', updated_at = NOW()
        WHERE id = p_ticket_id;
        v_result := v_result || jsonb_build_object('action', 'update_priority', 'success', true);

      WHEN 'assign_to' THEN
        UPDATE homaradesk_tickets
        SET assignee_id = (v_action->>'value')::UUID, updated_at = NOW()
        WHERE id = p_ticket_id;
        v_result := v_result || jsonb_build_object('action', 'assign_to', 'success', true);

      WHEN 'add_tag' THEN
        UPDATE homaradesk_tickets
        SET tags = array_append(COALESCE(tags, ARRAY[]::TEXT[]), v_action->>'value'), updated_at = NOW()
        WHERE id = p_ticket_id;
        v_result := v_result || jsonb_build_object('action', 'add_tag', 'success', true);

      WHEN 'add_comment' THEN
        INSERT INTO homaradesk_ticket_comments (
          ticket_id,
          content,
          author_type,
          author_id,
          is_internal
        ) VALUES (
          p_ticket_id,
          v_action->>'value',
          'admin',
          v_admin_id,
          COALESCE((v_action->>'is_internal')::BOOLEAN, FALSE)
        );
        v_result := v_result || jsonb_build_object('action', 'add_comment', 'success', true);

      ELSE
        v_result := v_result || jsonb_build_object('action', v_action->>'type', 'success', false, 'error', 'Unknown action type');
    END CASE;
  END LOOP;

  -- Increment usage
  PERFORM increment_macro_usage(p_macro_id);

  RETURN jsonb_build_object(
    'success', true,
    'actions_executed', v_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. CHECK HOLIDAY
-- =====================================================

CREATE OR REPLACE FUNCTION is_holiday(
  p_date DATE,
  p_calendar_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_calendar_id UUID;
BEGIN
  -- Get default calendar if not specified
  IF p_calendar_id IS NULL THEN
    SELECT id INTO v_calendar_id
    FROM homaradesk_holiday_calendars
    WHERE is_default = TRUE
    LIMIT 1;
  ELSE
    v_calendar_id := p_calendar_id;
  END IF;

  -- Check if date is a holiday
  RETURN EXISTS (
    SELECT 1
    FROM homaradesk_holidays
    WHERE calendar_id = v_calendar_id
      AND (
        holiday_date = p_date
        OR (is_recurring = TRUE AND EXTRACT(DAY FROM holiday_date) = EXTRACT(DAY FROM p_date)
            AND EXTRACT(MONTH FROM holiday_date) = EXTRACT(MONTH FROM p_date))
      )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 8. PARSE MENTIONS FROM TEXT
-- =====================================================

CREATE OR REPLACE FUNCTION parse_mentions(
  p_text TEXT,
  p_ticket_id UUID,
  p_comment_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_match TEXT;
  v_admin_id UUID;
  v_user_id UUID;
BEGIN
  -- Find @mentions in text (format: @username or @name)
  FOR v_match IN SELECT regexp_split_to_table(p_text, '\s+')
  LOOP
    IF v_match LIKE '@%' THEN
      -- Extract username (remove @)
      v_match := SUBSTRING(v_match FROM 2);

      -- Try to find admin by name/email
      SELECT a.id INTO v_admin_id
      FROM admins a
      JOIN profiles p ON p.id = a.user_id
      WHERE (LOWER(p.full_name) LIKE LOWER('%' || v_match || '%')
             OR LOWER(p.email) LIKE LOWER('%' || v_match || '%'))
        AND a.status = 'active'
      LIMIT 1;

      -- Try to find user by name/email
      IF v_admin_id IS NULL THEN
        SELECT id INTO v_user_id
        FROM profiles
        WHERE (LOWER(full_name) LIKE LOWER('%' || v_match || '%')
               OR LOWER(email) LIKE LOWER('%' || v_match || '%'))
        LIMIT 1;
      END IF;

      -- Create mention
      IF v_admin_id IS NOT NULL THEN
        INSERT INTO homaradesk_mentions (
          ticket_id,
          comment_id,
          mentioned_admin_id
        ) VALUES (
          p_ticket_id,
          p_comment_id,
          v_admin_id
        )
        ON CONFLICT DO NOTHING;
      ELSIF v_user_id IS NOT NULL THEN
        INSERT INTO homaradesk_mentions (
          ticket_id,
          comment_id,
          mentioned_user_id
        ) VALUES (
          p_ticket_id,
          p_comment_id,
          v_user_id
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to parse mentions when comments are added
CREATE OR REPLACE FUNCTION parse_mentions_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS NOT NULL THEN
    PERFORM parse_mentions(NEW.content, NEW.ticket_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parse_mentions_trigger ON homaradesk_ticket_comments;
CREATE TRIGGER parse_mentions_trigger
  AFTER INSERT ON homaradesk_ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION parse_mentions_trigger();

-- Grant permissions
GRANT EXECUTE ON FUNCTION merge_tickets TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_canned_response_usage TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_macro_usage TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_saved_search_usage TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION execute_macro TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_holiday TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION parse_mentions TO authenticated, service_role;

