-- Email Notification System
-- Week 3, Day 13-14
-- Created: November 6, 2025

-- =====================================================
-- 1. EMAIL TEMPLATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(100) NOT NULL UNIQUE,
  template_key VARCHAR(50) NOT NULL UNIQUE, -- 'new_user', 'verification_approved', etc.
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB, -- List of available variables: ["{{user_name}}", "{{verification_link}}"]
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. EMAIL QUEUE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB, -- Actual values: {"user_name": "John Doe"}
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sending', 'sent', 'failed'
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient ON email_queue(recipient_email);

-- =====================================================
-- 3. EMAIL NOTIFICATION PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE UNIQUE,
  new_user_notifications BOOLEAN DEFAULT TRUE,
  new_verification_notifications BOOLEAN DEFAULT TRUE,
  listing_approval_notifications BOOLEAN DEFAULT TRUE,
  flagged_content_notifications BOOLEAN DEFAULT TRUE,
  daily_summary BOOLEAN DEFAULT TRUE,
  weekly_summary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_email_preferences ENABLE ROW LEVEL SECURITY;

-- Super admins can manage email templates
CREATE POLICY "Super admins can manage email templates" ON email_templates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.id = get_admin_id() 
      AND admins.admin_role = 'super_admin'
  )
);

-- Admins can view email queue
CREATE POLICY "Admins can view email queue" ON email_queue FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- System can insert into email queue
CREATE POLICY "System can manage email queue" ON email_queue FOR ALL
USING (true);

-- Admins can view and manage own email preferences
CREATE POLICY "Admins can view own email preferences" ON admin_email_preferences FOR SELECT
USING (admin_id = get_admin_id());

CREATE POLICY "Admins can manage own email preferences" ON admin_email_preferences FOR ALL
USING (admin_id = get_admin_id());

-- =====================================================
-- 5. EMAIL FUNCTIONS
-- =====================================================

-- Queue an email
CREATE OR REPLACE FUNCTION queue_email(
  p_template_key VARCHAR,
  p_recipient_email VARCHAR,
  p_recipient_name VARCHAR DEFAULT NULL,
  p_variables JSONB DEFAULT NULL,
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS json AS $$
DECLARE
  v_template RECORD;
  v_subject VARCHAR;
  v_body_html TEXT;
  v_body_text TEXT;
  v_email_id UUID;
  v_key TEXT;
  v_value TEXT;
BEGIN
  -- Get template
  SELECT * INTO v_template
  FROM email_templates
  WHERE template_key = p_template_key
    AND is_active = TRUE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Template not found');
  END IF;
  
  -- Replace variables in subject and body
  v_subject := v_template.subject;
  v_body_html := v_template.body_html;
  v_body_text := v_template.body_text;
  
  IF p_variables IS NOT NULL THEN
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_variables)
    LOOP
      v_subject := REPLACE(v_subject, '{{' || v_key || '}}', v_value);
      v_body_html := REPLACE(v_body_html, '{{' || v_key || '}}', v_value);
      IF v_body_text IS NOT NULL THEN
        v_body_text := REPLACE(v_body_text, '{{' || v_key || '}}', v_value);
      END IF;
    END LOOP;
  END IF;
  
  -- Insert into queue
  INSERT INTO email_queue (
    template_id, recipient_email, recipient_name,
    subject, body_html, body_text, variables, scheduled_for
  )
  VALUES (
    v_template.id, p_recipient_email, p_recipient_name,
    v_subject, v_body_html, v_body_text, p_variables, p_scheduled_for
  )
  RETURNING id INTO v_email_id;
  
  RETURN json_build_object(
    'success', true,
    'id', v_email_id,
    'message', 'Email queued successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending emails to send
CREATE OR REPLACE FUNCTION get_pending_emails(p_limit INTEGER DEFAULT 100)
RETURNS TABLE(
  id UUID,
  recipient_email VARCHAR,
  recipient_name VARCHAR,
  subject VARCHAR,
  body_html TEXT,
  body_text TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id,
    eq.recipient_email,
    eq.recipient_name,
    eq.subject,
    eq.body_html,
    eq.body_text,
    eq.scheduled_for
  FROM email_queue eq
  WHERE eq.status = 'pending'
    AND eq.scheduled_for <= NOW()
    AND eq.retry_count < eq.max_retries
  ORDER BY eq.scheduled_for ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark email as sent
CREATE OR REPLACE FUNCTION mark_email_sent(p_email_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE email_queue
  SET 
    status = 'sent',
    sent_at = NOW()
  WHERE id = p_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark email as failed
CREATE OR REPLACE FUNCTION mark_email_failed(
  p_email_id UUID,
  p_error_message TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE email_queue
  SET 
    status = 'failed',
    error_message = p_error_message,
    retry_count = retry_count + 1
  WHERE id = p_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get email statistics
CREATE OR REPLACE FUNCTION get_email_statistics()
RETURNS TABLE(
  total_queued BIGINT,
  pending_count BIGINT,
  sent_count BIGINT,
  failed_count BIGINT,
  sent_today BIGINT,
  failed_today BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_queued,
    (SELECT COUNT(*)::BIGINT FROM email_queue WHERE status = 'pending') as pending_count,
    (SELECT COUNT(*)::BIGINT FROM email_queue WHERE status = 'sent') as sent_count,
    (SELECT COUNT(*)::BIGINT FROM email_queue WHERE status = 'failed') as failed_count,
    (SELECT COUNT(*)::BIGINT FROM email_queue WHERE status = 'sent' AND sent_at > CURRENT_DATE) as sent_today,
    (SELECT COUNT(*)::BIGINT FROM email_queue WHERE status = 'failed' AND created_at > CURRENT_DATE) as failed_today
  FROM email_queue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create admin email preferences
CREATE OR REPLACE FUNCTION get_admin_email_preferences()
RETURNS TABLE(
  new_user_notifications BOOLEAN,
  new_verification_notifications BOOLEAN,
  listing_approval_notifications BOOLEAN,
  flagged_content_notifications BOOLEAN,
  daily_summary BOOLEAN,
  weekly_summary BOOLEAN
) AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin not found';
  END IF;
  
  -- Create default preferences if not exists
  INSERT INTO admin_email_preferences (admin_id)
  VALUES (v_admin_id)
  ON CONFLICT (admin_id) DO NOTHING;
  
  RETURN QUERY
  SELECT 
    aep.new_user_notifications,
    aep.new_verification_notifications,
    aep.listing_approval_notifications,
    aep.flagged_content_notifications,
    aep.daily_summary,
    aep.weekly_summary
  FROM admin_email_preferences aep
  WHERE aep.admin_id = v_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin email preferences
CREATE OR REPLACE FUNCTION update_admin_email_preferences(
  p_new_user_notifications BOOLEAN DEFAULT NULL,
  p_new_verification_notifications BOOLEAN DEFAULT NULL,
  p_listing_approval_notifications BOOLEAN DEFAULT NULL,
  p_flagged_content_notifications BOOLEAN DEFAULT NULL,
  p_daily_summary BOOLEAN DEFAULT NULL,
  p_weekly_summary BOOLEAN DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  INSERT INTO admin_email_preferences (admin_id)
  VALUES (v_admin_id)
  ON CONFLICT (admin_id) DO UPDATE SET
    new_user_notifications = COALESCE(p_new_user_notifications, admin_email_preferences.new_user_notifications),
    new_verification_notifications = COALESCE(p_new_verification_notifications, admin_email_preferences.new_verification_notifications),
    listing_approval_notifications = COALESCE(p_listing_approval_notifications, admin_email_preferences.listing_approval_notifications),
    flagged_content_notifications = COALESCE(p_flagged_content_notifications, admin_email_preferences.flagged_content_notifications),
    daily_summary = COALESCE(p_daily_summary, admin_email_preferences.daily_summary),
    weekly_summary = COALESCE(p_weekly_summary, admin_email_preferences.weekly_summary),
    updated_at = NOW();
  
  RETURN json_build_object('success', true, 'message', 'Preferences updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. DEFAULT EMAIL TEMPLATES
-- =====================================================

INSERT INTO email_templates (template_name, template_key, subject, body_html, variables) VALUES
('New User Registration', 'new_user', 
'New User Registered: {{user_name}}',
'<h2>New User Registration</h2><p>A new user has registered:</p><ul><li><strong>Name:</strong> {{user_name}}</li><li><strong>Email:</strong> {{user_email}}</li><li><strong>Role:</strong> {{user_role}}</li></ul><p><a href="{{admin_link}}">View in Admin Panel</a></p>',
'["{{user_name}}", "{{user_email}}", "{{user_role}}", "{{admin_link}}"]'::jsonb),

('Verification Request', 'verification_request',
'New Verification Request: {{landlord_name}}',
'<h2>New Verification Request</h2><p>A landlord has submitted a verification request:</p><ul><li><strong>Name:</strong> {{landlord_name}}</li><li><strong>Email:</strong> {{landlord_email}}</li><li><strong>Phone:</strong> {{landlord_phone}}</li></ul><p><a href="{{verification_link}}">Review Request</a></p>',
'["{{landlord_name}}", "{{landlord_email}}", "{{landlord_phone}}", "{{verification_link}}"]'::jsonb),

('Verification Approved', 'verification_approved',
'Your verification has been approved',
'<h2>Verification Approved</h2><p>Congratulations {{landlord_name}}!</p><p>Your landlord verification has been approved. You can now list properties on our platform.</p><p><a href="{{dashboard_link}}">Go to Dashboard</a></p>',
'["{{landlord_name}}", "{{dashboard_link}}"]'::jsonb),

('Verification Rejected', 'verification_rejected',
'Your verification request needs attention',
'<h2>Verification Status</h2><p>Hello {{landlord_name}},</p><p>We were unable to approve your verification request at this time.</p><p><strong>Reason:</strong> {{rejection_reason}}</p><p>Please update your information and resubmit.</p>',
'["{{landlord_name}}", "{{rejection_reason}}"]'::jsonb)

ON CONFLICT (template_key) DO NOTHING;

