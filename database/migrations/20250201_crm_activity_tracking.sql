-- CRM Activity & Interaction Tracking System
-- Created: February 1, 2025
-- Phase 1: CRM Features - CRM-2: Activity & Interaction Tracking

-- =====================================================
-- 1. CRM ACTIVITIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Link to user if exists
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    -- Communication activities
    'email', 'sms', 'call', 'meeting',
    -- Property activities
    'property_view', 'property_save', 'property_share', 'property_inquiry',
    -- Search activities
    'search_performed', 'filter_applied', 'sort_changed',
    -- Application activities
    'application_submitted', 'application_viewed', 'application_status_changed',
    -- Booking activities
    'booking_created', 'booking_confirmed', 'booking_cancelled', 'booking_completed',
    'viewing_scheduled', 'viewing_completed', 'viewing_cancelled',
    -- Payment activities
    'payment_received', 'payment_failed', 'payment_refunded', 'subscription_activated',
    -- Message activities
    'message_sent', 'message_received',
    -- System activities
    'note_added', 'tag_assigned', 'status_changed', 'contact_created', 'contact_updated'
  )),
  subject VARCHAR(255), -- Quick subject/title for the activity
  description TEXT, -- Detailed description
  activity_data JSONB DEFAULT '{}'::jsonb, -- Flexible data storage
  related_record_type VARCHAR(50), -- e.g., 'property', 'application', 'booking', 'payment', 'message'
  related_record_id UUID, -- ID of the related record
  duration_minutes INTEGER, -- For calls, meetings
  status VARCHAR(50) DEFAULT 'completed', -- completed, pending, cancelled, failed
  created_by UUID, -- Admin user who created it (for manual entries)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT crm_activities_contact_or_user CHECK (
    contact_id IS NOT NULL OR user_id IS NOT NULL
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_user ON crm_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_related_record ON crm_activities(related_record_type, related_record_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_status ON crm_activities(status);
CREATE INDEX IF NOT EXISTS idx_crm_activities_activity_data ON crm_activities USING gin(activity_data);

-- =====================================================
-- 2. TRIGGERS
-- =====================================================

-- Function to sync user_id with contact_id
CREATE OR REPLACE FUNCTION sync_crm_activity_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If contact_id is provided but user_id is not, try to get user_id from contact
  IF NEW.contact_id IS NOT NULL AND NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM crm_contacts
    WHERE id = NEW.contact_id;
  END IF;
  
  -- If user_id is provided but contact_id is not, try to find or create contact
  IF NEW.user_id IS NOT NULL AND NEW.contact_id IS NULL THEN
    SELECT id INTO NEW.contact_id
    FROM crm_contacts
    WHERE user_id = NEW.user_id
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_crm_activity_user_id
  BEFORE INSERT ON crm_activities
  FOR EACH ROW
  EXECUTE FUNCTION sync_crm_activity_user_id();

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

-- Admins can view all activities
CREATE POLICY "Admins can view all activities" ON crm_activities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Admins can insert activities
CREATE POLICY "Admins can insert activities" ON crm_activities FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Admins can update activities
CREATE POLICY "Admins can update activities" ON crm_activities FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Admins can delete activities
CREATE POLICY "Admins can delete activities" ON crm_activities FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- =====================================================
-- 4. RPC FUNCTIONS
-- =====================================================

-- Get all activities for a contact
CREATE OR REPLACE FUNCTION get_contact_activities(
  p_contact_id UUID,
  p_activity_type VARCHAR DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  contact_id UUID,
  user_id UUID,
  activity_type VARCHAR,
  subject VARCHAR,
  description TEXT,
  activity_data JSONB,
  related_record_type VARCHAR,
  related_record_id UUID,
  duration_minutes INTEGER,
  status VARCHAR,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_activities AS (
    SELECT 
      a.*,
      COUNT(*) OVER() as total_count
    FROM crm_activities a
    WHERE a.contact_id = p_contact_id
      AND (p_activity_type IS NULL OR a.activity_type = p_activity_type)
      AND (p_start_date IS NULL OR a.created_at >= p_start_date)
      AND (p_end_date IS NULL OR a.created_at <= p_end_date)
    ORDER BY a.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    fa.id,
    fa.contact_id,
    fa.user_id,
    fa.activity_type::VARCHAR,
    fa.subject,
    fa.description,
    fa.activity_data,
    fa.related_record_type,
    fa.related_record_id,
    fa.duration_minutes,
    fa.status::VARCHAR,
    fa.created_by,
    fa.created_at,
    fa.total_count
  FROM filtered_activities fa;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get activity timeline with filters
CREATE OR REPLACE FUNCTION get_activity_timeline(
  p_contact_id UUID,
  p_activity_types VARCHAR[] DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS JSONB AS $$
DECLARE
  v_activities JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'activity_type', a.activity_type,
      'subject', a.subject,
      'description', a.description,
      'activity_data', a.activity_data,
      'related_record_type', a.related_record_type,
      'related_record_id', a.related_record_id,
      'duration_minutes', a.duration_minutes,
      'status', a.status,
      'created_at', a.created_at
    ) ORDER BY a.created_at DESC
  ), '[]'::jsonb) INTO v_activities
  FROM crm_activities a
  WHERE a.contact_id = p_contact_id
    AND (p_activity_types IS NULL OR a.activity_type = ANY(p_activity_types))
    AND (p_start_date IS NULL OR a.created_at >= p_start_date)
    AND (p_end_date IS NULL OR a.created_at <= p_end_date)
  ORDER BY a.created_at DESC
  LIMIT p_limit;
  
  RETURN jsonb_build_object(
    'activities', v_activities,
    'total_count', jsonb_array_length(v_activities)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create activity
CREATE OR REPLACE FUNCTION create_activity(
  p_contact_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_activity_type VARCHAR,
  p_subject VARCHAR DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_activity_data JSONB DEFAULT NULL,
  p_related_record_type VARCHAR DEFAULT NULL,
  p_related_record_id UUID DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL,
  p_status VARCHAR DEFAULT 'completed'
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
  v_admin_id UUID;
  v_resolved_contact_id UUID;
  v_resolved_user_id UUID;
BEGIN
  -- Get current admin user ID (if creating manually)
  SELECT user_id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
  
  -- Resolve contact_id and user_id
  IF p_contact_id IS NOT NULL THEN
    v_resolved_contact_id := p_contact_id;
    SELECT user_id INTO v_resolved_user_id
    FROM crm_contacts
    WHERE id = p_contact_id
    LIMIT 1;
  ELSIF p_user_id IS NOT NULL THEN
    v_resolved_user_id := p_user_id;
    SELECT id INTO v_resolved_contact_id
    FROM crm_contacts
    WHERE user_id = p_user_id
    LIMIT 1;
  END IF;
  
  -- Insert activity
  INSERT INTO crm_activities (
    contact_id,
    user_id,
    activity_type,
    subject,
    description,
    activity_data,
    related_record_type,
    related_record_id,
    duration_minutes,
    status,
    created_by
  ) VALUES (
    v_resolved_contact_id,
    v_resolved_user_id,
    p_activity_type,
    p_subject,
    p_description,
    COALESCE(p_activity_data, '{}'::jsonb),
    p_related_record_type,
    p_related_record_id,
    p_duration_minutes,
    p_status,
    v_admin_id
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update activity
CREATE OR REPLACE FUNCTION update_activity(
  p_activity_id UUID,
  p_subject VARCHAR DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_activity_data JSONB DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT user_id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can update activities';
  END IF;
  
  UPDATE crm_activities
  SET
    subject = COALESCE(p_subject, subject),
    description = COALESCE(p_description, description),
    activity_data = COALESCE(p_activity_data, activity_data),
    status = COALESCE(p_status, status),
    duration_minutes = COALESCE(p_duration_minutes, duration_minutes)
  WHERE id = p_activity_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_contact_activities TO authenticated;
GRANT EXECUTE ON FUNCTION get_activity_timeline TO authenticated;
GRANT EXECUTE ON FUNCTION create_activity TO authenticated;
GRANT EXECUTE ON FUNCTION update_activity TO authenticated;

COMMENT ON TABLE crm_activities IS 'CRM Activity & Interaction Tracking - Unified activity timeline for all user interactions';

