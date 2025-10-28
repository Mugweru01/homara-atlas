-- Performance Metrics & Monitoring System
-- Week 4, Day 21
-- Created: November 9, 2025

-- =====================================================
-- 1. PERFORMANCE METRICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_category VARCHAR(50) NOT NULL, -- 'api', 'database', 'frontend', 'user_experience'
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  unit VARCHAR(20), -- 'ms', 'seconds', 'count', 'percentage', 'bytes'
  endpoint VARCHAR(255), -- API endpoint or page route
  method VARCHAR(10), -- HTTP method
  status_code INTEGER, -- HTTP status code
  error_message TEXT,
  user_agent TEXT,
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  metadata JSONB, -- Additional context
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_performance_category ON performance_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_performance_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_endpoint ON performance_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_recorded ON performance_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_admin ON performance_metrics(admin_id);

-- =====================================================
-- 2. ERROR TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type VARCHAR(50) NOT NULL, -- 'javascript', 'api', 'database', 'network'
  error_message TEXT NOT NULL,
  error_stack TEXT,
  endpoint VARCHAR(255),
  status_code INTEGER,
  user_agent TEXT,
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  context JSONB, -- Error context and metadata
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_occurred ON error_logs(occurred_at DESC);

-- =====================================================
-- 3. PAGE LOAD METRICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS page_load_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_route VARCHAR(255) NOT NULL,
  load_time_ms INTEGER NOT NULL,
  dom_ready_ms INTEGER,
  first_paint_ms INTEGER,
  largest_contentful_paint_ms INTEGER,
  time_to_interactive_ms INTEGER,
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  browser VARCHAR(100),
  device_type VARCHAR(50),
  connection_type VARCHAR(50),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_page_load_route ON page_load_metrics(page_route);
CREATE INDEX IF NOT EXISTS idx_page_load_recorded ON page_load_metrics(recorded_at DESC);

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_load_metrics ENABLE ROW LEVEL SECURITY;

-- Super/Senior admins can view all metrics
CREATE POLICY "Super and Senior admins can view metrics" ON performance_metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
      AND status = 'active'
  )
);

-- System can insert metrics
CREATE POLICY "System can insert metrics" ON performance_metrics FOR INSERT
WITH CHECK (true);

-- Error log policies
CREATE POLICY "Admins can view error logs" ON error_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
      AND status = 'active'
  )
);

CREATE POLICY "System can insert errors" ON error_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update errors" ON error_logs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
      AND status = 'active'
  )
);

-- Page load policies
CREATE POLICY "Admins can view page loads" ON page_load_metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
      AND status = 'active'
  )
);

CREATE POLICY "System can insert page loads" ON page_load_metrics FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 5. PERFORMANCE TRACKING FUNCTIONS
-- =====================================================

-- Record a performance metric
CREATE OR REPLACE FUNCTION record_performance_metric(
  p_category VARCHAR,
  p_name VARCHAR,
  p_value NUMERIC,
  p_unit VARCHAR DEFAULT 'ms',
  p_endpoint VARCHAR DEFAULT NULL,
  p_method VARCHAR DEFAULT NULL,
  p_status_code INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
  v_admin_id UUID;
BEGIN
  -- Get current admin if authenticated
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  INSERT INTO performance_metrics (
    metric_category,
    metric_name,
    metric_value,
    unit,
    endpoint,
    method,
    status_code,
    admin_id,
    metadata
  )
  VALUES (
    p_category,
    p_name,
    p_value,
    p_unit,
    p_endpoint,
    p_method,
    p_status_code,
    v_admin_id,
    p_metadata
  )
  RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get performance summary
CREATE OR REPLACE FUNCTION get_performance_summary(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  category VARCHAR,
  metric_name VARCHAR,
  avg_value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  p50_value NUMERIC,
  p95_value NUMERIC,
  p99_value NUMERIC,
  sample_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.metric_category::VARCHAR as category,
    pm.metric_name::VARCHAR,
    ROUND(AVG(pm.metric_value), 2) as avg_value,
    MIN(pm.metric_value) as min_value,
    MAX(pm.metric_value) as max_value,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pm.metric_value) as p50_value,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pm.metric_value) as p95_value,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pm.metric_value) as p99_value,
    COUNT(*)::BIGINT as sample_count
  FROM performance_metrics pm
  WHERE pm.recorded_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY pm.metric_category, pm.metric_name
  ORDER BY pm.metric_category, pm.metric_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get API endpoint performance
CREATE OR REPLACE FUNCTION get_endpoint_performance(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  endpoint VARCHAR,
  method VARCHAR,
  avg_response_time NUMERIC,
  max_response_time NUMERIC,
  total_requests BIGINT,
  error_count BIGINT,
  error_rate NUMERIC,
  avg_status_code NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.endpoint::VARCHAR,
    pm.method::VARCHAR,
    ROUND(AVG(pm.metric_value), 2) as avg_response_time,
    MAX(pm.metric_value) as max_response_time,
    COUNT(*)::BIGINT as total_requests,
    COUNT(*) FILTER (WHERE pm.status_code >= 400)::BIGINT as error_count,
    ROUND((COUNT(*) FILTER (WHERE pm.status_code >= 400)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100, 2) as error_rate,
    ROUND(AVG(pm.status_code), 0) as avg_status_code
  FROM performance_metrics pm
  WHERE pm.metric_category = 'api'
    AND pm.endpoint IS NOT NULL
    AND pm.recorded_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY pm.endpoint, pm.method
  ORDER BY total_requests DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get page load performance
CREATE OR REPLACE FUNCTION get_page_load_performance(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  page_route VARCHAR,
  avg_load_time NUMERIC,
  p95_load_time NUMERIC,
  avg_lcp NUMERIC,
  avg_tti NUMERIC,
  total_loads BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    plm.page_route::VARCHAR,
    ROUND(AVG(plm.load_time_ms), 2) as avg_load_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY plm.load_time_ms) as p95_load_time,
    ROUND(AVG(plm.largest_contentful_paint_ms), 2) as avg_lcp,
    ROUND(AVG(plm.time_to_interactive_ms), 2) as avg_tti,
    COUNT(*)::BIGINT as total_loads
  FROM page_load_metrics plm
  WHERE plm.recorded_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY plm.page_route
  ORDER BY total_loads DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get error statistics
CREATE OR REPLACE FUNCTION get_error_statistics(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  error_type VARCHAR,
  error_count BIGINT,
  unique_errors BIGINT,
  resolved_count BIGINT,
  resolution_rate NUMERIC,
  most_common_error TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    el.error_type::VARCHAR,
    COUNT(*)::BIGINT as error_count,
    COUNT(DISTINCT el.error_message)::BIGINT as unique_errors,
    COUNT(*) FILTER (WHERE el.resolved = true)::BIGINT as resolved_count,
    ROUND((COUNT(*) FILTER (WHERE el.resolved = true)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100, 2) as resolution_rate,
    (
      SELECT error_message 
      FROM error_logs 
      WHERE error_type = el.error_type 
        AND occurred_at > NOW() - (p_hours || ' hours')::INTERVAL
      GROUP BY error_message 
      ORDER BY COUNT(*) DESC 
      LIMIT 1
    ) as most_common_error
  FROM error_logs el
  WHERE el.occurred_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY el.error_type
  ORDER BY error_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get recent errors
CREATE OR REPLACE FUNCTION get_recent_errors(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  error_type VARCHAR,
  error_message TEXT,
  endpoint VARCHAR,
  status_code INTEGER,
  resolved BOOLEAN,
  occurred_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    el.id,
    el.error_type::VARCHAR,
    el.error_message,
    el.endpoint::VARCHAR,
    el.status_code,
    el.resolved,
    el.occurred_at
  FROM error_logs el
  ORDER BY el.occurred_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark error as resolved
CREATE OR REPLACE FUNCTION resolve_error(
  p_error_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  UPDATE error_logs
  SET resolved = true,
      resolved_at = NOW(),
      resolved_by = v_admin_id
  WHERE id = p_error_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get performance trends over time
CREATE OR REPLACE FUNCTION get_performance_trends(
  p_metric_name VARCHAR,
  p_hours INTEGER DEFAULT 24,
  p_interval_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(
  time_bucket TIMESTAMP WITH TIME ZONE,
  avg_value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  sample_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('hour', pm.recorded_at) + 
      INTERVAL '1 hour' * FLOOR(EXTRACT(EPOCH FROM pm.recorded_at - DATE_TRUNC('hour', pm.recorded_at)) / 3600) as time_bucket,
    ROUND(AVG(pm.metric_value), 2) as avg_value,
    MIN(pm.metric_value) as min_value,
    MAX(pm.metric_value) as max_value,
    COUNT(*)::BIGINT as sample_count
  FROM performance_metrics pm
  WHERE pm.metric_name = p_metric_name
    AND pm.recorded_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY time_bucket
  ORDER BY time_bucket ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

