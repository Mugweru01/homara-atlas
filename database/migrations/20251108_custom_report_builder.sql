-- Custom Report Builder System
-- Week 4, Day 18
-- Created: November 8, 2025

-- =====================================================
-- 1. CUSTOM REPORT DEFINITIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS custom_report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  report_name VARCHAR(255) NOT NULL,
  report_description TEXT,
  data_source VARCHAR(100) NOT NULL, -- 'users', 'verifications', 'listings', 'flags', etc.
  columns_config JSONB NOT NULL, -- Selected columns with aliases
  filters_config JSONB, -- Filter conditions
  sorting_config JSONB, -- Sort order
  grouping_config JSONB, -- Group by fields
  aggregations_config JSONB, -- Count, Sum, Avg, etc.
  joins_config JSONB, -- Table joins
  limit_rows INTEGER DEFAULT 1000,
  is_public BOOLEAN DEFAULT false,
  is_template BOOLEAN DEFAULT false,
  category VARCHAR(50), -- 'users', 'listings', 'financial', 'performance', etc.
  tags TEXT[],
  usage_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_reports_admin ON custom_report_definitions(admin_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_source ON custom_report_definitions(data_source);
CREATE INDEX IF NOT EXISTS idx_custom_reports_category ON custom_report_definitions(category);
CREATE INDEX IF NOT EXISTS idx_custom_reports_public ON custom_report_definitions(is_public) WHERE is_public = true;

-- =====================================================
-- 2. REPORT EXECUTION HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS custom_report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES custom_report_definitions(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  execution_time_ms INTEGER,
  row_count INTEGER,
  file_format VARCHAR(20), -- 'csv', 'json', 'excel'
  file_size_bytes BIGINT,
  parameters JSONB, -- Runtime parameters
  status VARCHAR(20) DEFAULT 'success', -- 'success', 'failed', 'timeout'
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_executions_report ON custom_report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_admin ON custom_report_executions(admin_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_date ON custom_report_executions(executed_at DESC);

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

ALTER TABLE custom_report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_report_executions ENABLE ROW LEVEL SECURITY;

-- Admins can view own reports and public reports
CREATE POLICY "Admins can view own and public reports" ON custom_report_definitions FOR SELECT
USING (
  admin_id = (SELECT id FROM admins WHERE user_id = auth.uid())
  OR is_public = true
  OR EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
  )
);

-- Admins can create reports
CREATE POLICY "Admins can create reports" ON custom_report_definitions FOR INSERT
WITH CHECK (
  admin_id = (SELECT id FROM admins WHERE user_id = auth.uid())
);

-- Admins can update own reports
CREATE POLICY "Admins can update own reports" ON custom_report_definitions FOR UPDATE
USING (admin_id = (SELECT id FROM admins WHERE user_id = auth.uid()));

-- Admins can delete own reports
CREATE POLICY "Admins can delete own reports" ON custom_report_definitions FOR DELETE
USING (admin_id = (SELECT id FROM admins WHERE user_id = auth.uid()));

-- Execution history policies
CREATE POLICY "Admins can view own executions" ON custom_report_executions FOR SELECT
USING (
  admin_id = (SELECT id FROM admins WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
  )
);

CREATE POLICY "System can insert executions" ON custom_report_executions FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 4. REPORT BUILDER FUNCTIONS
-- =====================================================

-- Get available data sources
CREATE OR REPLACE FUNCTION get_report_data_sources()
RETURNS TABLE(
  source_name VARCHAR,
  display_name VARCHAR,
  description TEXT,
  available_columns JSONB,
  available_filters JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (VALUES
    ('profiles', 'Users', 'User profiles and account information', 
     '["id", "display_name", "full_name", "email", "role", "is_verified", "created_at"]'::JSONB,
     '["role", "is_verified", "created_at"]'::JSONB),
    ('properties', 'Listings', 'Property listings', 
     '["id", "title", "property_type", "price_kes", "bedrooms", "location_name", "county", "property_status", "is_active", "views_count", "saves_count", "created_at"]'::JSONB,
     '["property_type", "property_status", "is_active", "county", "bedrooms", "price_kes", "created_at"]'::JSONB),
    ('landlord_verifications', 'Verifications', 'Landlord verification requests', 
     '["id", "landlord_id", "status", "verification_level", "trust_score", "phone_verified", "email_verified", "identity_verified", "submitted_at", "reviewed_at"]'::JSONB,
     '["status", "verification_level", "trust_score", "submitted_at", "reviewed_at"]'::JSONB),
    ('property_flags', 'Flagged Content', 'Flagged properties and reports', 
     '["id", "property_id", "violation_type", "status", "flagged_by", "resolved_by", "created_at", "resolved_at"]'::JSONB,
     '["violation_type", "status", "created_at", "resolved_at"]'::JSONB),
    ('admin_notifications', 'Notifications', 'Admin notifications', 
     '["id", "type", "title", "message", "priority", "read", "created_at"]'::JSONB,
     '["type", "priority", "read", "created_at"]'::JSONB)
  ) AS t(source_name, display_name, description, available_columns, available_filters);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute custom report
CREATE OR REPLACE FUNCTION execute_custom_report(
  p_report_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_report RECORD;
  v_query TEXT;
  v_result JSONB;
  v_start_time TIMESTAMP;
  v_execution_time INTEGER;
  v_row_count INTEGER;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Get report definition
  SELECT * INTO v_report 
  FROM custom_report_definitions 
  WHERE id = p_report_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;
  
  -- Update usage count and last run
  UPDATE custom_report_definitions 
  SET usage_count = usage_count + 1, 
      last_run_at = NOW()
  WHERE id = p_report_id;
  
  -- Build query based on data source
  -- This is a simplified version - in production, you'd build dynamic SQL carefully
  CASE v_report.data_source
    WHEN 'profiles' THEN
      v_query := 'SELECT row_to_json(t) FROM profiles t LIMIT ' || v_report.limit_rows;
    WHEN 'properties' THEN
      v_query := 'SELECT row_to_json(t) FROM properties t LIMIT ' || v_report.limit_rows;
    WHEN 'landlord_verifications' THEN
      v_query := 'SELECT row_to_json(t) FROM landlord_verifications t LIMIT ' || v_report.limit_rows;
    WHEN 'property_flags' THEN
      v_query := 'SELECT row_to_json(t) FROM property_flags t LIMIT ' || v_report.limit_rows;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid data source');
  END CASE;
  
  -- Execute query and aggregate results
  EXECUTE 'SELECT jsonb_agg(row_to_json) FROM (' || v_query || ') AS subquery' 
  INTO v_result;
  
  -- Calculate execution time
  v_execution_time := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::INTEGER;
  v_row_count := jsonb_array_length(COALESCE(v_result, '[]'::JSONB));
  
  -- Record execution
  INSERT INTO custom_report_executions (
    report_id, 
    admin_id, 
    execution_time_ms, 
    row_count,
    status
  ) VALUES (
    p_report_id,
    (SELECT id FROM admins WHERE user_id = auth.uid()),
    v_execution_time,
    v_row_count,
    'success'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'data', COALESCE(v_result, '[]'::JSONB),
    'row_count', v_row_count,
    'execution_time_ms', v_execution_time
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Record failed execution
  INSERT INTO custom_report_executions (
    report_id, 
    admin_id, 
    status,
    error_message
  ) VALUES (
    p_report_id,
    (SELECT id FROM admins WHERE user_id = auth.uid()),
    'failed',
    SQLERRM
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's saved reports
CREATE OR REPLACE FUNCTION get_my_custom_reports()
RETURNS TABLE(
  id UUID,
  report_name VARCHAR,
  report_description TEXT,
  data_source VARCHAR,
  category VARCHAR,
  usage_count INTEGER,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.report_name,
    r.report_description,
    r.data_source,
    r.category,
    r.usage_count,
    r.last_run_at,
    r.created_at
  FROM custom_report_definitions r
  WHERE r.admin_id = (SELECT id FROM admins WHERE user_id = auth.uid())
  ORDER BY r.last_run_at DESC NULLS LAST, r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get public report templates
CREATE OR REPLACE FUNCTION get_report_templates()
RETURNS TABLE(
  id UUID,
  report_name VARCHAR,
  report_description TEXT,
  data_source VARCHAR,
  category VARCHAR,
  usage_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.report_name,
    r.report_description,
    r.data_source,
    r.category,
    r.usage_count
  FROM custom_report_definitions r
  WHERE r.is_template = true OR r.is_public = true
  ORDER BY r.usage_count DESC, r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create report from template
CREATE OR REPLACE FUNCTION clone_report_template(
  p_template_id UUID,
  p_new_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_new_report_id UUID;
  v_template RECORD;
BEGIN
  -- Get template
  SELECT * INTO v_template 
  FROM custom_report_definitions 
  WHERE id = p_template_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;
  
  -- Clone the report
  INSERT INTO custom_report_definitions (
    admin_id,
    report_name,
    report_description,
    data_source,
    columns_config,
    filters_config,
    sorting_config,
    grouping_config,
    aggregations_config,
    joins_config,
    limit_rows,
    category,
    tags
  )
  SELECT
    (SELECT id FROM admins WHERE user_id = auth.uid()),
    p_new_name,
    v_template.report_description,
    v_template.data_source,
    v_template.columns_config,
    v_template.filters_config,
    v_template.sorting_config,
    v_template.grouping_config,
    v_template.aggregations_config,
    v_template.joins_config,
    v_template.limit_rows,
    v_template.category,
    v_template.tags
  RETURNING id INTO v_new_report_id;
  
  RETURN v_new_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get report execution statistics
CREATE OR REPLACE FUNCTION get_report_statistics(
  p_report_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_executions', COUNT(*),
    'avg_execution_time_ms', ROUND(AVG(execution_time_ms)),
    'avg_row_count', ROUND(AVG(row_count)),
    'success_rate', ROUND((COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2),
    'last_execution', MAX(executed_at),
    'total_rows_returned', SUM(row_count)
  )
  INTO v_stats
  FROM custom_report_executions
  WHERE report_id = p_report_id;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

