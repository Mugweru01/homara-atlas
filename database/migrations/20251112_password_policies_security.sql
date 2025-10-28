-- Password Policies & Security Scans System
-- Week 5, Day 24
-- Created: November 12, 2025

-- =====================================================
-- 1. PASSWORD POLICY CONFIGURATION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS password_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name VARCHAR(100) NOT NULL DEFAULT 'Default Policy',
  min_length INTEGER DEFAULT 8,
  require_uppercase BOOLEAN DEFAULT true,
  require_lowercase BOOLEAN DEFAULT true,
  require_numbers BOOLEAN DEFAULT true,
  require_special_chars BOOLEAN DEFAULT true,
  max_age_days INTEGER DEFAULT 90, -- Password expires after X days
  prevent_reuse_count INTEGER DEFAULT 5, -- Prevent reusing last X passwords
  max_login_attempts INTEGER DEFAULT 5,
  lockout_duration_minutes INTEGER DEFAULT 30,
  enforce_for_admins BOOLEAN DEFAULT true,
  enforce_for_users BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default policy
INSERT INTO password_policies (policy_name) VALUES ('Default Security Policy')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. PASSWORD HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References auth.users
  password_hash TEXT NOT NULL, -- Encrypted password hash
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_date ON password_history(created_at DESC);

-- =====================================================
-- 3. SECURITY SCAN RESULTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS security_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type VARCHAR(50) NOT NULL, -- 'weak_passwords', 'inactive_accounts', 'suspicious_activity', 'permission_audit'
  severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  affected_count INTEGER DEFAULT 0,
  affected_entities JSONB, -- Array of affected user IDs or other identifiers
  recommendations TEXT,
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'acknowledged', 'resolved', 'false_positive'
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_scan_type ON security_scan_results(scan_type);
CREATE INDEX IF NOT EXISTS idx_security_scan_severity ON security_scan_results(severity);
CREATE INDEX IF NOT EXISTS idx_security_scan_status ON security_scan_results(status);
CREATE INDEX IF NOT EXISTS idx_security_scan_date ON security_scan_results(created_at DESC);

-- =====================================================
-- 4. LOGIN ATTEMPT TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- NULL for failed attempts with unknown user
  email VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  attempt_result VARCHAR(20) NOT NULL, -- 'success', 'failed', 'locked_out'
  failure_reason VARCHAR(100), -- 'invalid_password', 'account_locked', 'account_not_found'
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_date ON login_attempts(attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_result ON login_attempts(attempt_result);

-- =====================================================
-- 5. ACCOUNT LOCKOUT TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS account_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  reason VARCHAR(100) DEFAULT 'too_many_failed_attempts',
  failed_attempts_count INTEGER DEFAULT 0,
  locked_by VARCHAR(50) DEFAULT 'system', -- 'system' or admin_id
  unlocked_at TIMESTAMP WITH TIME ZONE,
  unlocked_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_user ON account_lockouts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_until ON account_lockouts(locked_until);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_active ON account_lockouts(locked_until) WHERE unlocked_at IS NULL;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

ALTER TABLE password_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;

-- Password Policies: Super admins only
CREATE POLICY "Super admins can view policies" ON password_policies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role = 'super_admin'
  )
);

CREATE POLICY "Super admins can manage policies" ON password_policies FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role = 'super_admin'
      AND status = 'active'
  )
);

-- Password History: System only
CREATE POLICY "System can manage password history" ON password_history FOR ALL
USING (true);

-- Security Scans: Senior admins can view/manage
CREATE POLICY "Senior admins can view scans" ON security_scan_results FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
  )
);

CREATE POLICY "Senior admins can manage scans" ON security_scan_results FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
      AND status = 'active'
  )
);

-- Login Attempts: Senior admins can view
CREATE POLICY "Senior admins can view login attempts" ON login_attempts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
  )
);

CREATE POLICY "System can log attempts" ON login_attempts FOR INSERT
WITH CHECK (true);

-- Account Lockouts: Senior admins can view/manage
CREATE POLICY "Senior admins can view lockouts" ON account_lockouts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
  )
);

CREATE POLICY "Senior admins can manage lockouts" ON account_lockouts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
      AND status = 'active'
  )
);

-- =====================================================
-- 7. PASSWORD VALIDATION FUNCTIONS
-- =====================================================

-- Get active password policy
CREATE OR REPLACE FUNCTION get_active_password_policy()
RETURNS JSONB AS $$
DECLARE
  v_policy JSONB;
BEGIN
  SELECT row_to_json(p.*)::JSONB INTO v_policy
  FROM password_policies p
  WHERE p.is_active = true
  ORDER BY p.created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_policy, jsonb_build_object(
    'min_length', 8,
    'require_uppercase', true,
    'require_lowercase', true,
    'require_numbers', true,
    'require_special_chars', true
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update password policy
CREATE OR REPLACE FUNCTION update_password_policy(p_policy JSONB)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_policy_id UUID;
BEGIN
  -- Check admin permission
  SELECT id INTO v_admin_id 
  FROM admins 
  WHERE user_id = auth.uid() 
    AND admin_role = 'super_admin'
    AND status = 'active';
  
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Super admin access required');
  END IF;
  
  -- Deactivate all existing policies
  UPDATE password_policies SET is_active = false;
  
  -- Create new policy
  INSERT INTO password_policies (
    policy_name,
    min_length,
    require_uppercase,
    require_lowercase,
    require_numbers,
    require_special_chars,
    max_age_days,
    prevent_reuse_count,
    max_login_attempts,
    lockout_duration_minutes,
    enforce_for_admins,
    enforce_for_users,
    is_active
  ) VALUES (
    COALESCE((p_policy->>'policy_name')::VARCHAR, 'Custom Policy'),
    COALESCE((p_policy->>'min_length')::INTEGER, 8),
    COALESCE((p_policy->>'require_uppercase')::BOOLEAN, true),
    COALESCE((p_policy->>'require_lowercase')::BOOLEAN, true),
    COALESCE((p_policy->>'require_numbers')::BOOLEAN, true),
    COALESCE((p_policy->>'require_special_chars')::BOOLEAN, true),
    COALESCE((p_policy->>'max_age_days')::INTEGER, 90),
    COALESCE((p_policy->>'prevent_reuse_count')::INTEGER, 5),
    COALESCE((p_policy->>'max_login_attempts')::INTEGER, 5),
    COALESCE((p_policy->>'lockout_duration_minutes')::INTEGER, 30),
    COALESCE((p_policy->>'enforce_for_admins')::BOOLEAN, true),
    COALESCE((p_policy->>'enforce_for_users')::BOOLEAN, true),
    true
  ) RETURNING id INTO v_policy_id;
  
  RETURN jsonb_build_object('success', true, 'policy_id', v_policy_id, 'message', 'Password policy updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. SECURITY SCAN FUNCTIONS
-- =====================================================

-- Run comprehensive security scan
CREATE OR REPLACE FUNCTION run_security_scan()
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_scan_results JSONB := '[]'::JSONB;
  v_weak_passwords INTEGER;
  v_inactive_admins INTEGER;
  v_suspicious_logins INTEGER;
  v_unlocked_accounts INTEGER;
BEGIN
  -- Check admin permission
  SELECT id INTO v_admin_id 
  FROM admins 
  WHERE user_id = auth.uid() 
    AND admin_role IN ('super_admin', 'senior_admin')
    AND status = 'active';
  
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- 1. Check for inactive admin accounts
  SELECT COUNT(*) INTO v_inactive_admins
  FROM admins
  WHERE status = 'active'
    AND last_login < NOW() - INTERVAL '90 days';
  
  IF v_inactive_admins > 0 THEN
    INSERT INTO security_scan_results (
      scan_type, severity, title, description, affected_count, recommendations, status
    ) VALUES (
      'inactive_accounts',
      'medium',
      'Inactive Admin Accounts Detected',
      'Admin accounts that have not logged in for 90+ days',
      v_inactive_admins,
      'Review and deactivate unused admin accounts to reduce security risk',
      'open'
    );
  END IF;
  
  -- 2. Check for suspicious login patterns
  SELECT COUNT(DISTINCT ip_address) INTO v_suspicious_logins
  FROM login_attempts
  WHERE attempted_at > NOW() - INTERVAL '24 hours'
    AND attempt_result = 'failed'
  GROUP BY ip_address
  HAVING COUNT(*) > 10;
  
  IF v_suspicious_logins > 0 THEN
    INSERT INTO security_scan_results (
      scan_type, severity, title, description, affected_count, recommendations, status
    ) VALUES (
      'suspicious_activity',
      'high',
      'Suspicious Login Activity Detected',
      'Multiple failed login attempts from the same IP addresses',
      v_suspicious_logins,
      'Investigate IP addresses with repeated failed login attempts. Consider IP blocking.',
      'open'
    );
  END IF;
  
  -- 3. Check for accounts without 2FA (admins)
  SELECT COUNT(*) INTO v_unlocked_accounts
  FROM admins a
  LEFT JOIN admin_security_preferences asp ON a.id = asp.admin_id
  WHERE a.status = 'active'
    AND (asp.two_factor_enabled IS NULL OR asp.two_factor_enabled = false);
  
  IF v_unlocked_accounts > 0 THEN
    INSERT INTO security_scan_results (
      scan_type, severity, title, description, affected_count, recommendations, status
    ) VALUES (
      'permission_audit',
      'high',
      'Admins Without 2FA Enabled',
      'Active admin accounts without two-factor authentication',
      v_unlocked_accounts,
      'Enforce 2FA for all admin accounts to improve security',
      'open'
    );
  END IF;
  
  -- Get all open scan results
  SELECT jsonb_agg(row_to_json(s.*)::JSONB) INTO v_scan_results
  FROM security_scan_results s
  WHERE s.created_at > NOW() - INTERVAL '1 hour'
  ORDER BY 
    CASE s.severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    s.created_at DESC;
  
  RETURN jsonb_build_object(
    'success', true,
    'scans_performed', 3,
    'issues_found', COALESCE(jsonb_array_length(v_scan_results), 0),
    'results', COALESCE(v_scan_results, '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get security scan history
CREATE OR REPLACE FUNCTION get_security_scan_history(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  id UUID,
  scan_type VARCHAR,
  severity VARCHAR,
  title VARCHAR,
  description TEXT,
  affected_count INTEGER,
  status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.scan_type,
    s.severity,
    s.title,
    s.description,
    s.affected_count,
    s.status,
    s.created_at,
    s.resolved_at
  FROM security_scan_results s
  ORDER BY s.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resolve security scan issue
CREATE OR REPLACE FUNCTION resolve_security_issue(
  p_scan_id UUID,
  p_status VARCHAR DEFAULT 'resolved'
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  UPDATE security_scan_results
  SET status = p_status,
      resolved_at = NOW(),
      resolved_by = v_admin_id
  WHERE id = p_scan_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Scan result not found');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Security issue marked as ' || p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. LOGIN ATTEMPT TRACKING
-- =====================================================

-- Get recent failed login attempts
CREATE OR REPLACE FUNCTION get_failed_login_attempts(p_hours INTEGER DEFAULT 24)
RETURNS TABLE(
  ip_address INET,
  email VARCHAR,
  attempt_count BIGINT,
  last_attempt TIMESTAMP WITH TIME ZONE,
  is_locked_out BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    la.ip_address,
    la.email,
    COUNT(*) as attempt_count,
    MAX(la.attempted_at) as last_attempt,
    EXISTS(
      SELECT 1 FROM account_lockouts al 
      WHERE al.user_id = (SELECT id FROM auth.users WHERE email = la.email)
        AND al.locked_until > NOW()
        AND al.unlocked_at IS NULL
    ) as is_locked_out
  FROM login_attempts la
  WHERE la.attempt_result = 'failed'
    AND la.attempted_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY la.ip_address, la.email
  HAVING COUNT(*) >= 3
  ORDER BY COUNT(*) DESC, MAX(la.attempted_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get account lockout statistics
CREATE OR REPLACE FUNCTION get_lockout_statistics()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'currently_locked', COUNT(*) FILTER (WHERE locked_until > NOW() AND unlocked_at IS NULL),
    'locked_today', COUNT(*) FILTER (WHERE created_at > CURRENT_DATE),
    'total_this_week', COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),
    'avg_duration_minutes', AVG(EXTRACT(EPOCH FROM (COALESCE(unlocked_at, NOW()) - created_at)) / 60)
  )
  INTO v_stats
  FROM account_lockouts;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unlock user account
CREATE OR REPLACE FUNCTION unlock_user_account(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  UPDATE account_lockouts
  SET unlocked_at = NOW(),
      unlocked_by = v_admin_id
  WHERE user_id = p_user_id
    AND locked_until > NOW()
    AND unlocked_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active lockout found for this user');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Account unlocked successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

