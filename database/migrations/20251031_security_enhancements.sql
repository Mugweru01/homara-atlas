-- Security Enhancements: IP Whitelist & 2FA Settings
-- Week 1, Day 5

-- Admin IP whitelist table
CREATE TABLE IF NOT EXISTS admin_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  ip_range CIDR,
  label VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(admin_id, ip_address)
);

-- Admin security preferences table
CREATE TABLE IF NOT EXISTS admin_security_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE UNIQUE,
  require_2fa BOOLEAN DEFAULT FALSE,
  require_ip_whitelist BOOLEAN DEFAULT FALSE,
  session_timeout_minutes INTEGER DEFAULT 480,
  allow_concurrent_sessions BOOLEAN DEFAULT FALSE,
  require_password_change_days INTEGER DEFAULT 90,
  notify_on_new_login BOOLEAN DEFAULT TRUE,
  notify_on_password_change BOOLEAN DEFAULT TRUE,
  notify_on_profile_change BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trusted devices table for 2FA
CREATE TABLE IF NOT EXISTS admin_trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name VARCHAR(200),
  ip_address INET,
  user_agent TEXT,
  is_trusted BOOLEAN DEFAULT TRUE,
  trusted_until TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(admin_id, device_fingerprint)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_admin ON admin_ip_whitelist(admin_id);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_active ON admin_ip_whitelist(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_security_prefs_admin ON admin_security_preferences(admin_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_admin ON admin_trusted_devices(admin_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON admin_trusted_devices(device_fingerprint);

-- Enable RLS
ALTER TABLE admin_ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_security_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_trusted_devices ENABLE ROW LEVEL SECURITY;

-- Helper function to get admin_id from auth.uid()
-- This is needed because admins table has both 'id' and 'user_id' columns
-- auth.uid() returns user_id, but foreign keys reference admin.id
CREATE OR REPLACE FUNCTION get_admin_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM admins WHERE user_id = auth.uid() AND status = 'active' LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RLS Policies (using get_admin_id() helper)
CREATE POLICY "Admins can view own IP whitelist" ON admin_ip_whitelist FOR SELECT
USING (admin_id = get_admin_id() OR EXISTS (SELECT 1 FROM admins WHERE admins.id = get_admin_id() AND admins.admin_role = 'super_admin'));

CREATE POLICY "Admins can manage own IP whitelist" ON admin_ip_whitelist FOR ALL
USING (admin_id = get_admin_id());

CREATE POLICY "Admins can view own security prefs" ON admin_security_preferences FOR SELECT
USING (admin_id = get_admin_id() OR EXISTS (SELECT 1 FROM admins WHERE admins.id = get_admin_id() AND admins.admin_role = 'super_admin'));

CREATE POLICY "Admins can manage own security prefs" ON admin_security_preferences FOR ALL
USING (admin_id = get_admin_id());

CREATE POLICY "Admins can view own trusted devices" ON admin_trusted_devices FOR SELECT
USING (admin_id = get_admin_id());

CREATE POLICY "Admins can manage own trusted devices" ON admin_trusted_devices FOR ALL
USING (admin_id = get_admin_id());

-- Function to check if IP is whitelisted
CREATE OR REPLACE FUNCTION is_ip_whitelisted(p_admin_id UUID, p_ip_address INET)
RETURNS BOOLEAN AS $$
DECLARE
  v_require_whitelist BOOLEAN;
  v_ip_found BOOLEAN;
BEGIN
  SELECT require_ip_whitelist INTO v_require_whitelist
  FROM admin_security_preferences WHERE admin_id = p_admin_id;
  
  IF v_require_whitelist IS NULL OR v_require_whitelist = FALSE THEN
    RETURN TRUE;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM admin_ip_whitelist
    WHERE admin_id = p_admin_id AND is_active = TRUE
      AND (ip_address = p_ip_address OR p_ip_address << ip_range)
  ) INTO v_ip_found;
  
  RETURN v_ip_found;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add IP to whitelist
CREATE OR REPLACE FUNCTION add_ip_to_whitelist(p_ip_address TEXT, p_label TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE v_whitelist_id UUID;
BEGIN
  INSERT INTO admin_ip_whitelist (admin_id, ip_address, label, created_by)
  VALUES (auth.uid(), p_ip_address::INET, p_label, auth.uid())
  RETURNING id INTO v_whitelist_id;
  RETURN v_whitelist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove IP from whitelist
CREATE OR REPLACE FUNCTION remove_ip_from_whitelist(p_whitelist_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM admin_ip_whitelist WHERE id = p_whitelist_id AND admin_id = auth.uid();
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get admin security preferences (with defaults)
CREATE OR REPLACE FUNCTION get_admin_security_preferences(p_admin_id UUID DEFAULT NULL)
RETURNS TABLE(
  admin_id UUID, require_2fa BOOLEAN, require_ip_whitelist BOOLEAN,
  session_timeout_minutes INTEGER, allow_concurrent_sessions BOOLEAN,
  require_password_change_days INTEGER, notify_on_new_login BOOLEAN,
  notify_on_password_change BOOLEAN, notify_on_profile_change BOOLEAN
) AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := COALESCE(p_admin_id, get_admin_id());
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin not found for current user';
  END IF;
  
  -- Check if preferences exist, return them; otherwise return defaults
  IF EXISTS (SELECT 1 FROM admin_security_preferences WHERE admin_security_preferences.admin_id = v_admin_id) THEN
    RETURN QUERY
    SELECT asp.admin_id, asp.require_2fa, asp.require_ip_whitelist,
      asp.session_timeout_minutes, asp.allow_concurrent_sessions,
      asp.require_password_change_days, asp.notify_on_new_login,
      asp.notify_on_password_change, asp.notify_on_profile_change
    FROM admin_security_preferences asp WHERE asp.admin_id = v_admin_id;
  ELSE
    -- Return defaults
    RETURN QUERY
    SELECT v_admin_id, FALSE::BOOLEAN, FALSE::BOOLEAN, 480::INTEGER,
      FALSE::BOOLEAN, 90::INTEGER, TRUE::BOOLEAN, TRUE::BOOLEAN, TRUE::BOOLEAN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update security preferences (returns JSON)
CREATE OR REPLACE FUNCTION update_admin_security_preferences(
  p_require_2fa BOOLEAN DEFAULT NULL, p_require_ip_whitelist BOOLEAN DEFAULT NULL,
  p_session_timeout_minutes INTEGER DEFAULT NULL, p_allow_concurrent_sessions BOOLEAN DEFAULT NULL,
  p_require_password_change_days INTEGER DEFAULT NULL, p_notify_on_new_login BOOLEAN DEFAULT NULL,
  p_notify_on_password_change BOOLEAN DEFAULT NULL, p_notify_on_profile_change BOOLEAN DEFAULT NULL
) RETURNS json AS $$
BEGIN
  INSERT INTO admin_security_preferences (
    admin_id, require_2fa, require_ip_whitelist, session_timeout_minutes,
    allow_concurrent_sessions, require_password_change_days,
    notify_on_new_login, notify_on_password_change, notify_on_profile_change
  ) VALUES (
    auth.uid(),
    COALESCE(p_require_2fa, FALSE),
    COALESCE(p_require_ip_whitelist, FALSE),
    COALESCE(p_session_timeout_minutes, 480),
    COALESCE(p_allow_concurrent_sessions, FALSE),
    COALESCE(p_require_password_change_days, 90),
    COALESCE(p_notify_on_new_login, TRUE),
    COALESCE(p_notify_on_password_change, TRUE),
    COALESCE(p_notify_on_profile_change, TRUE)
  )
  ON CONFLICT (admin_id) DO UPDATE SET
    require_2fa = CASE WHEN p_require_2fa IS NOT NULL THEN p_require_2fa ELSE admin_security_preferences.require_2fa END,
    require_ip_whitelist = CASE WHEN p_require_ip_whitelist IS NOT NULL THEN p_require_ip_whitelist ELSE admin_security_preferences.require_ip_whitelist END,
    session_timeout_minutes = CASE WHEN p_session_timeout_minutes IS NOT NULL THEN p_session_timeout_minutes ELSE admin_security_preferences.session_timeout_minutes END,
    allow_concurrent_sessions = CASE WHEN p_allow_concurrent_sessions IS NOT NULL THEN p_allow_concurrent_sessions ELSE admin_security_preferences.allow_concurrent_sessions END,
    require_password_change_days = CASE WHEN p_require_password_change_days IS NOT NULL THEN p_require_password_change_days ELSE admin_security_preferences.require_password_change_days END,
    notify_on_new_login = CASE WHEN p_notify_on_new_login IS NOT NULL THEN p_notify_on_new_login ELSE admin_security_preferences.notify_on_new_login END,
    notify_on_password_change = CASE WHEN p_notify_on_password_change IS NOT NULL THEN p_notify_on_password_change ELSE admin_security_preferences.notify_on_password_change END,
    notify_on_profile_change = CASE WHEN p_notify_on_profile_change IS NOT NULL THEN p_notify_on_profile_change ELSE admin_security_preferences.notify_on_profile_change END,
    updated_at = NOW();
  RETURN json_build_object('success', true, 'message', 'Security preferences updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get IP whitelist
CREATE OR REPLACE FUNCTION get_ip_whitelist(p_admin_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID, ip_address TEXT, ip_range TEXT, label VARCHAR, is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE, last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY SELECT aiw.id, aiw.ip_address::TEXT, aiw.ip_range::TEXT, aiw.label,
    aiw.is_active, aiw.created_at, aiw.last_used_at
  FROM admin_ip_whitelist aiw WHERE aiw.admin_id = COALESCE(p_admin_id, auth.uid())
  ORDER BY aiw.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get trusted devices
CREATE OR REPLACE FUNCTION get_trusted_devices(p_admin_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID, device_name VARCHAR, ip_address TEXT, user_agent TEXT, is_trusted BOOLEAN,
  trusted_until TIMESTAMP WITH TIME ZONE, last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY SELECT atd.id, atd.device_name, atd.ip_address::TEXT, atd.user_agent,
    atd.is_trusted, atd.trusted_until, atd.last_used_at, atd.created_at
  FROM admin_trusted_devices atd WHERE atd.admin_id = COALESCE(p_admin_id, auth.uid())
  ORDER BY atd.last_used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke trusted device
CREATE OR REPLACE FUNCTION revoke_trusted_device(p_device_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE admin_trusted_devices SET is_trusted = FALSE
  WHERE id = p_device_id AND admin_id = auth.uid();
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE admin_ip_whitelist IS 'IP addresses allowed for admin access';
COMMENT ON TABLE admin_security_preferences IS 'Security settings and preferences per admin';
COMMENT ON TABLE admin_trusted_devices IS 'Devices authenticated via 2FA';
COMMENT ON FUNCTION is_ip_whitelisted IS 'Check if IP address is whitelisted for admin';
COMMENT ON FUNCTION add_ip_to_whitelist IS 'Add IP address to admin whitelist';
COMMENT ON FUNCTION remove_ip_from_whitelist IS 'Remove IP from admin whitelist';

