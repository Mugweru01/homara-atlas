-- Real-Time Monitoring & Alert System
-- Tracks system health, performance metrics, and security events

-- System metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL, -- 'cpu', 'memory', 'database', 'api', 'storage'
  metric_name VARCHAR(100) NOT NULL,
  value NUMERIC NOT NULL,
  unit VARCHAR(20), -- '%', 'ms', 'mb', 'count', 'score'
  status VARCHAR(20) DEFAULT 'healthy', -- 'healthy', 'warning', 'critical'
  threshold_warning NUMERIC,
  threshold_critical NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert configurations table
CREATE TABLE IF NOT EXISTS alert_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_name VARCHAR(100) NOT NULL UNIQUE,
  alert_type VARCHAR(50) NOT NULL, -- 'system', 'security', 'business', 'performance'
  condition JSONB NOT NULL, -- Alert trigger conditions
  notification_channels JSONB DEFAULT '["in_app"]'::jsonb, -- email, slack, sms, in-app
  is_active BOOLEAN DEFAULT TRUE,
  cooldown_minutes INTEGER DEFAULT 60, -- Prevent alert spam
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert history table
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_config_id UUID REFERENCES alert_configurations(id) ON DELETE SET NULL,
  severity VARCHAR(20) DEFAULT 'warning', -- 'info', 'warning', 'critical'
  alert_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'new', -- 'new', 'acknowledged', 'resolved', 'ignored'
  acknowledged_by UUID REFERENCES admins(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES admins(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded ON system_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type, metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_status ON system_metrics(status) WHERE status != 'healthy';
CREATE INDEX IF NOT EXISTS idx_alert_configs_active ON alert_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON alert_history(severity);

-- Enable RLS
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - All admins can view, super admins can manage
CREATE POLICY "Admins can view system metrics"
ON system_metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE id = auth.uid() 
      AND status = 'active'
  )
);

CREATE POLICY "Admins can view alert configurations"
ON alert_configurations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE id = auth.uid() 
      AND status = 'active'
  )
);

CREATE POLICY "Super admins can manage alert configurations"
ON alert_configurations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE id = auth.uid() 
      AND admin_role = 'super_admin'
      AND status = 'active'
  )
);

CREATE POLICY "Admins can view alert history"
ON alert_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE id = auth.uid() 
      AND status = 'active'
  )
);

CREATE POLICY "Admins can acknowledge alerts"
ON alert_history FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE id = auth.uid() 
      AND status = 'active'
  )
);

-- Function to get current system metrics
CREATE OR REPLACE FUNCTION get_system_metrics()
RETURNS TABLE(
  metric_name TEXT,
  metric_type TEXT,
  value NUMERIC,
  unit TEXT,
  status TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  
  -- Active database connections
  SELECT 
    'active_connections'::TEXT,
    'database'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT,
    CASE 
      WHEN COUNT(*) > 80 THEN 'critical'
      WHEN COUNT(*) > 50 THEN 'warning'
      ELSE 'healthy'
    END::TEXT,
    NOW()
  FROM pg_stat_activity
  WHERE state = 'active'
  
  UNION ALL
  
  -- Database size
  SELECT 
    'database_size'::TEXT,
    'storage'::TEXT,
    (pg_database_size(current_database()) / 1024.0 / 1024.0)::NUMERIC,
    'mb'::TEXT,
    'healthy'::TEXT,
    NOW()
  
  UNION ALL
  
  -- Table count
  SELECT 
    'total_tables'::TEXT,
    'database'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT,
    'healthy'::TEXT,
    NOW()
  FROM information_schema.tables
  WHERE table_schema = 'public'
  
  UNION ALL
  
  -- Active admin sessions
  SELECT 
    'active_admin_sessions'::TEXT,
    'system'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT,
    'healthy'::TEXT,
    NOW()
  FROM admin_sessions
  WHERE is_active = TRUE 
    AND expires_at > NOW()
    
  UNION ALL
  
  -- Total users
  SELECT 
    'total_users'::TEXT,
    'business'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT,
    'healthy'::TEXT,
    NOW()
  FROM profiles
  
  UNION ALL
  
  -- Pending verifications
  SELECT 
    'pending_verifications'::TEXT,
    'business'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT,
    CASE 
      WHEN COUNT(*) > 50 THEN 'warning'
      WHEN COUNT(*) > 100 THEN 'critical'
      ELSE 'healthy'
    END::TEXT,
    NOW()
  FROM landlord_verifications
  WHERE status = 'pending'::verification_status
  
  UNION ALL
  
  -- Pending flags
  SELECT 
    'pending_flags'::TEXT,
    'business'::TEXT,
    COUNT(*)::NUMERIC,
    'count'::TEXT,
    CASE 
      WHEN COUNT(*) > 20 THEN 'warning'
      WHEN COUNT(*) > 50 THEN 'critical'
      ELSE 'healthy'
    END::TEXT,
    NOW()
  FROM property_flags
  WHERE status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track database performance
CREATE OR REPLACE FUNCTION track_database_metrics()
RETURNS void AS $$
BEGIN
  -- Insert current metrics
  INSERT INTO system_metrics (metric_type, metric_name, value, unit, status)
  SELECT 
    metric_type,
    metric_name,
    value,
    unit,
    status
  FROM get_system_metrics();
END;
$$ LANGUAGE plpgsql;

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS void AS $$
DECLARE
  v_failed_login_ips INTEGER;
  v_high_risk_sessions INTEGER;
BEGIN
  -- Check for multiple failed logins from same IP
  SELECT COUNT(*) INTO v_failed_login_ips
  FROM (
    SELECT ip_address
    FROM security_events
    WHERE event_type = 'login_failed'::security_event_type
      AND created_at > NOW() - INTERVAL '15 minutes'
    GROUP BY ip_address
    HAVING COUNT(*) > 5
  ) suspicious_ips;
  
  IF v_failed_login_ips > 0 THEN
    INSERT INTO alert_history (severity, alert_name, message, details)
    VALUES (
      'critical',
      'Multiple Failed Login Attempts',
      'Detected ' || v_failed_login_ips || ' IP addresses with multiple failed login attempts',
      jsonb_build_object('count', v_failed_login_ips, 'time_window', '15 minutes')
    );
  END IF;
  
  -- Check for high-risk admin sessions
  SELECT COUNT(*) INTO v_high_risk_sessions
  FROM admin_sessions
  WHERE risk_score > 70
    AND is_active = TRUE;
  
  IF v_high_risk_sessions > 0 THEN
    INSERT INTO alert_history (severity, alert_name, message, details)
    VALUES (
      'warning',
      'High Risk Admin Sessions',
      'Found ' || v_high_risk_sessions || ' active admin sessions with high risk scores',
      jsonb_build_object('session_count', v_high_risk_sessions)
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent alerts
CREATE OR REPLACE FUNCTION get_recent_alerts(
  p_limit INTEGER DEFAULT 20,
  p_severity TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  alert_name VARCHAR,
  severity VARCHAR,
  message TEXT,
  status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ah.id,
    ah.alert_name,
    ah.severity,
    ah.message,
    ah.status,
    ah.created_at,
    ah.acknowledged_by,
    ah.acknowledged_at
  FROM alert_history ah
  WHERE (p_severity IS NULL OR ah.severity = p_severity)
  ORDER BY ah.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to acknowledge alert
CREATE OR REPLACE FUNCTION acknowledge_alert(p_alert_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE alert_history
  SET 
    status = 'acknowledged',
    acknowledged_by = auth.uid(),
    acknowledged_at = NOW()
  WHERE id = p_alert_id
    AND status = 'new';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resolve alert
CREATE OR REPLACE FUNCTION resolve_alert(
  p_alert_id UUID,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE alert_history
  SET 
    status = 'resolved',
    resolved_by = auth.uid(),
    resolved_at = NOW(),
    resolution_notes = p_resolution_notes
  WHERE id = p_alert_id
    AND status IN ('new', 'acknowledged');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default alert configurations
INSERT INTO alert_configurations (alert_name, alert_type, condition, notification_channels) VALUES
  ('High Failed Login Rate', 'security', '{"threshold": 5, "timeframe": "15m"}', '["in_app", "email"]'),
  ('Database Connection Pool High', 'system', '{"threshold": 80, "metric": "active_connections"}', '["in_app"]'),
  ('Pending Verifications Overload', 'business', '{"threshold": 50, "metric": "pending_verifications"}', '["in_app"]'),
  ('High Risk Admin Session', 'security', '{"threshold": 70, "metric": "risk_score"}', '["in_app", "email"]'),
  ('Backup Overdue', 'system', '{"condition": "backup_overdue"}', '["in_app", "email"]')
ON CONFLICT (alert_name) DO NOTHING;

COMMENT ON TABLE system_metrics IS 'Real-time system health and performance metrics';
COMMENT ON TABLE alert_configurations IS 'Configurable alert rules and thresholds';
COMMENT ON TABLE alert_history IS 'Historical record of all system alerts';
COMMENT ON FUNCTION get_system_metrics IS 'Returns current system health metrics';
COMMENT ON FUNCTION detect_suspicious_activity IS 'Checks for security threats and anomalies';
COMMENT ON FUNCTION acknowledge_alert IS 'Marks an alert as acknowledged by an admin';
COMMENT ON FUNCTION resolve_alert IS 'Marks an alert as resolved with optional notes';

