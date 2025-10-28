-- Activity Timeline System
-- Week 3, Day 15
-- Created: November 5, 2025

-- =====================================================
-- 1. ACTIVITY LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL, -- 'user', 'verification', 'listing', 'property', 'admin'
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'approved', 'rejected', 'suspended', etc.
  actor_id UUID, -- Who performed the action (admin_id or user_id)
  actor_type VARCHAR(20) NOT NULL, -- 'admin', 'user', 'system'
  actor_name VARCHAR(255), -- Cached name for display
  changes JSONB, -- Before/after values: {"field": {"old": "value1", "new": "value2"}}
  metadata JSONB, -- Additional context
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_changes ON activity_log USING gin(changes);

-- =====================================================
-- 2. RLS POLICIES
-- =====================================================

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs" ON activity_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- System can insert activity logs
CREATE POLICY "System can insert activity logs" ON activity_log FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 3. ACTIVITY LOG FUNCTIONS
-- =====================================================

-- Log an activity
CREATE OR REPLACE FUNCTION log_activity(
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_action VARCHAR,
  p_actor_type VARCHAR DEFAULT 'system',
  p_actor_id UUID DEFAULT NULL,
  p_actor_name VARCHAR DEFAULT NULL,
  p_changes JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
  v_final_actor_name VARCHAR;
BEGIN
  -- Get actor name if not provided
  IF p_actor_name IS NULL AND p_actor_id IS NOT NULL THEN
    IF p_actor_type = 'admin' THEN
      SELECT a.email INTO v_final_actor_name
      FROM admins a
      WHERE a.id = p_actor_id;
    ELSIF p_actor_type = 'user' THEN
      SELECT p.full_name INTO v_final_actor_name
      FROM profiles p
      WHERE p.id = p_actor_id;
    END IF;
  ELSE
    v_final_actor_name := p_actor_name;
  END IF;
  
  INSERT INTO activity_log (
    entity_type, entity_id, action, actor_id, actor_type,
    actor_name, changes, metadata, ip_address, user_agent
  )
  VALUES (
    p_entity_type, p_entity_id, p_action, p_actor_id, p_actor_type,
    v_final_actor_name, p_changes, p_metadata, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get activity timeline for an entity
CREATE OR REPLACE FUNCTION get_activity_timeline(
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  entity_type VARCHAR,
  entity_id UUID,
  action VARCHAR,
  actor_id UUID,
  actor_type VARCHAR,
  actor_name VARCHAR,
  changes JSONB,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.entity_type,
    al.entity_id,
    al.action,
    al.actor_id,
    al.actor_type,
    al.actor_name,
    al.changes,
    al.metadata,
    al.ip_address,
    al.created_at
  FROM activity_log al
  WHERE al.entity_type = p_entity_type
    AND al.entity_id = p_entity_id
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get recent activity across all entities
CREATE OR REPLACE FUNCTION get_recent_activity(
  p_entity_type VARCHAR DEFAULT NULL,
  p_action VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  entity_type VARCHAR,
  entity_id UUID,
  action VARCHAR,
  actor_id UUID,
  actor_type VARCHAR,
  actor_name VARCHAR,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.entity_type,
    al.entity_id,
    al.action,
    al.actor_id,
    al.actor_type,
    al.actor_name,
    al.changes,
    al.metadata,
    al.created_at
  FROM activity_log al
  WHERE (p_entity_type IS NULL OR al.entity_type = p_entity_type)
    AND (p_action IS NULL OR al.action = p_action)
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get activity statistics
CREATE OR REPLACE FUNCTION get_activity_statistics(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  total_activities BIGINT,
  activities_today BIGINT,
  activities_this_week BIGINT,
  activities_this_month BIGINT,
  most_active_entity_type VARCHAR,
  most_common_action VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_activities,
    (
      SELECT COUNT(*)::BIGINT
      FROM activity_log
      WHERE created_at > CURRENT_DATE
    ) as activities_today,
    (
      SELECT COUNT(*)::BIGINT
      FROM activity_log
      WHERE created_at > DATE_TRUNC('week', CURRENT_DATE)
    ) as activities_this_week,
    (
      SELECT COUNT(*)::BIGINT
      FROM activity_log
      WHERE created_at > DATE_TRUNC('month', CURRENT_DATE)
    ) as activities_this_month,
    (
      SELECT entity_type
      FROM activity_log
      WHERE created_at > CURRENT_DATE - (p_days || ' days')::INTERVAL
      GROUP BY entity_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as most_active_entity_type,
    (
      SELECT action
      FROM activity_log
      WHERE created_at > CURRENT_DATE - (p_days || ' days')::INTERVAL
      GROUP BY action
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as most_common_action
  FROM activity_log
  WHERE created_at > CURRENT_DATE - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. AUTOMATIC ACTIVITY LOGGING TRIGGERS
-- =====================================================

-- Function to log verification changes
CREATE OR REPLACE FUNCTION log_verification_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_action VARCHAR;
  v_changes JSONB;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      v_action := CASE NEW.status
        WHEN 'approved' THEN 'approved'
        WHEN 'rejected' THEN 'rejected'
        ELSE 'updated'
      END;
    ELSE
      v_action := 'updated';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
  END IF;
  
  -- Build changes JSON
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object();
    
    IF OLD.status != NEW.status THEN
      v_changes := v_changes || jsonb_build_object(
        'status', jsonb_build_object('old', OLD.status, 'new', NEW.status)
      );
    END IF;
    
    IF OLD.trust_score != NEW.trust_score THEN
      v_changes := v_changes || jsonb_build_object(
        'trust_score', jsonb_build_object('old', OLD.trust_score, 'new', NEW.trust_score)
      );
    END IF;
  END IF;
  
  -- Get admin ID if reviewed
  v_admin_id := CASE 
    WHEN TG_OP = 'UPDATE' THEN NEW.reviewed_by
    ELSE NULL
  END;
  
  -- Log the activity
  PERFORM log_activity(
    p_entity_type := 'verification',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_action := v_action,
    p_actor_type := CASE WHEN v_admin_id IS NOT NULL THEN 'admin' ELSE 'system' END,
    p_actor_id := v_admin_id,
    p_changes := v_changes
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for verification activity
DROP TRIGGER IF EXISTS trigger_log_verification_activity ON landlord_verifications;
CREATE TRIGGER trigger_log_verification_activity
  AFTER INSERT OR UPDATE OR DELETE ON landlord_verifications
  FOR EACH ROW
  EXECUTE FUNCTION log_verification_activity();

-- Function to log user changes
CREATE OR REPLACE FUNCTION log_user_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_action VARCHAR;
  v_changes JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_suspended != NEW.is_suspended THEN
      v_action := CASE WHEN NEW.is_suspended THEN 'suspended' ELSE 'unsuspended' END;
    ELSE
      v_action := 'updated';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object();
    
    IF OLD.is_suspended != NEW.is_suspended THEN
      v_changes := v_changes || jsonb_build_object(
        'is_suspended', jsonb_build_object('old', OLD.is_suspended, 'new', NEW.is_suspended)
      );
    END IF;
    
    IF OLD.full_name != NEW.full_name THEN
      v_changes := v_changes || jsonb_build_object(
        'full_name', jsonb_build_object('old', OLD.full_name, 'new', NEW.full_name)
      );
    END IF;
  END IF;
  
  PERFORM log_activity(
    p_entity_type := 'user',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_action := v_action,
    p_actor_type := 'system',
    p_changes := v_changes
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for user activity
DROP TRIGGER IF EXISTS trigger_log_user_activity ON profiles;
CREATE TRIGGER trigger_log_user_activity
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_user_activity();

