-- Scheduled Reports System
-- Week 3, Day 11-12
-- Created: November 4, 2025

-- =====================================================
-- 1. REPORT SCHEDULES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  report_name VARCHAR(255) NOT NULL,
  report_description TEXT,
  report_type VARCHAR(50) NOT NULL, -- 'users', 'verifications', 'listings', 'audit', 'custom'
  frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  day_of_week INTEGER, -- 0-6 for weekly (0 = Sunday)
  day_of_month INTEGER, -- 1-31 for monthly
  time_of_day TIME, -- HH:MM for daily/weekly/monthly
  filter_criteria JSONB, -- Filters to apply to the report data
  columns_to_include TEXT[], -- Which columns to include
  format VARCHAR(20) DEFAULT 'csv', -- 'csv', 'json', 'pdf'
  email_recipients TEXT[], -- Email addresses to send report to
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_schedules_admin ON admin_report_schedules(admin_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_type ON admin_report_schedules(report_type);
CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON admin_report_schedules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON admin_report_schedules(next_run_at) WHERE is_active = TRUE;

-- =====================================================
-- 2. GENERATED REPORTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES admin_report_schedules(id) ON DELETE SET NULL,
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_format VARCHAR(20) NOT NULL,
  file_size_bytes BIGINT,
  record_count INTEGER,
  filter_criteria JSONB,
  columns_included TEXT[],
  generation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'
  error_message TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  downloaded_at TIMESTAMP WITH TIME ZONE,
  download_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_generated_reports_schedule ON admin_generated_reports(schedule_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_admin ON admin_generated_reports(admin_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON admin_generated_reports(generation_status);
CREATE INDEX IF NOT EXISTS idx_generated_reports_date ON admin_generated_reports(generated_at DESC);

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

ALTER TABLE admin_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_generated_reports ENABLE ROW LEVEL SECURITY;

-- Report Schedules: Admins can view own schedules
CREATE POLICY "Admins can view own report schedules" ON admin_report_schedules FOR SELECT
USING (admin_id = get_admin_id());

-- Report Schedules: Admins can manage own schedules
CREATE POLICY "Admins can manage own report schedules" ON admin_report_schedules FOR ALL
USING (admin_id = get_admin_id());

-- Super admins can view all schedules
CREATE POLICY "Super admins can view all report schedules" ON admin_report_schedules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.id = get_admin_id() 
      AND admins.admin_role = 'super_admin'
  )
);

-- Generated Reports: Admins can view own reports
CREATE POLICY "Admins can view own generated reports" ON admin_generated_reports FOR SELECT
USING (admin_id = get_admin_id());

-- Generated Reports: Admins can create reports
CREATE POLICY "Admins can create generated reports" ON admin_generated_reports FOR INSERT
WITH CHECK (admin_id = get_admin_id());

-- Generated Reports: Admins can update own reports (for download tracking)
CREATE POLICY "Admins can update own generated reports" ON admin_generated_reports FOR UPDATE
USING (admin_id = get_admin_id());

-- Super admins can view all generated reports
CREATE POLICY "Super admins can view all generated reports" ON admin_generated_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.id = get_admin_id() 
      AND admins.admin_role = 'super_admin'
  )
);

-- =====================================================
-- 4. REPORT SCHEDULE MANAGEMENT FUNCTIONS
-- =====================================================

-- Create a new report schedule
CREATE OR REPLACE FUNCTION create_report_schedule(
  p_report_name VARCHAR,
  p_report_type VARCHAR,
  p_frequency VARCHAR,
  p_filter_criteria JSONB DEFAULT NULL,
  p_columns_to_include TEXT[] DEFAULT NULL,
  p_report_description TEXT DEFAULT NULL,
  p_day_of_week INTEGER DEFAULT NULL,
  p_day_of_month INTEGER DEFAULT NULL,
  p_time_of_day TIME DEFAULT '09:00:00',
  p_format VARCHAR DEFAULT 'csv',
  p_email_recipients TEXT[] DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
  v_schedule_id UUID;
  v_next_run_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  -- Validate frequency
  IF p_frequency NOT IN ('daily', 'weekly', 'monthly') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid frequency');
  END IF;
  
  -- Calculate next run time
  v_next_run_at := CASE
    WHEN p_frequency = 'daily' THEN
      (CURRENT_DATE + INTERVAL '1 day' + p_time_of_day)::TIMESTAMP WITH TIME ZONE
    WHEN p_frequency = 'weekly' THEN
      (CURRENT_DATE + INTERVAL '1 day' + p_time_of_day)::TIMESTAMP WITH TIME ZONE -- Will be refined by trigger
    WHEN p_frequency = 'monthly' THEN
      (CURRENT_DATE + INTERVAL '1 day' + p_time_of_day)::TIMESTAMP WITH TIME ZONE -- Will be refined by trigger
    ELSE NOW() + INTERVAL '1 day'
  END;
  
  INSERT INTO admin_report_schedules (
    admin_id, report_name, report_type, frequency, 
    filter_criteria, columns_to_include, report_description,
    day_of_week, day_of_month, time_of_day, format,
    email_recipients, next_run_at
  )
  VALUES (
    v_admin_id, p_report_name, p_report_type, p_frequency,
    p_filter_criteria, p_columns_to_include, p_report_description,
    p_day_of_week, p_day_of_month, p_time_of_day, p_format,
    p_email_recipients, v_next_run_at
  )
  RETURNING id INTO v_schedule_id;
  
  RETURN json_build_object(
    'success', true,
    'id', v_schedule_id,
    'next_run_at', v_next_run_at,
    'message', 'Report schedule created successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get report schedules
CREATE OR REPLACE FUNCTION get_report_schedules(
  p_report_type VARCHAR DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  report_name VARCHAR,
  report_description TEXT,
  report_type VARCHAR,
  frequency VARCHAR,
  day_of_week INTEGER,
  day_of_month INTEGER,
  time_of_day TIME,
  filter_criteria JSONB,
  columns_to_include TEXT[],
  format VARCHAR,
  email_recipients TEXT[],
  is_active BOOLEAN,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin not found';
  END IF;
  
  RETURN QUERY
  SELECT 
    ars.id,
    ars.report_name,
    ars.report_description,
    ars.report_type,
    ars.frequency,
    ars.day_of_week,
    ars.day_of_month,
    ars.time_of_day,
    ars.filter_criteria,
    ars.columns_to_include,
    ars.format,
    ars.email_recipients,
    ars.is_active,
    ars.last_run_at,
    ars.next_run_at,
    ars.created_at
  FROM admin_report_schedules ars
  WHERE ars.admin_id = v_admin_id
    AND (p_report_type IS NULL OR ars.report_type = p_report_type)
    AND (p_is_active IS NULL OR ars.is_active = p_is_active)
  ORDER BY ars.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update report schedule
CREATE OR REPLACE FUNCTION update_report_schedule(
  p_schedule_id UUID,
  p_is_active BOOLEAN DEFAULT NULL,
  p_report_name VARCHAR DEFAULT NULL,
  p_frequency VARCHAR DEFAULT NULL,
  p_filter_criteria JSONB DEFAULT NULL,
  p_email_recipients TEXT[] DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  UPDATE admin_report_schedules
  SET
    is_active = COALESCE(p_is_active, is_active),
    report_name = COALESCE(p_report_name, report_name),
    frequency = COALESCE(p_frequency, frequency),
    filter_criteria = COALESCE(p_filter_criteria, filter_criteria),
    email_recipients = COALESCE(p_email_recipients, email_recipients),
    updated_at = NOW()
  WHERE id = p_schedule_id
    AND admin_id = v_admin_id;
  
  IF FOUND THEN
    RETURN json_build_object('success', true, 'message', 'Schedule updated successfully');
  ELSE
    RETURN json_build_object('success', false, 'error', 'Schedule not found or access denied');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete report schedule
CREATE OR REPLACE FUNCTION delete_report_schedule(p_schedule_id UUID)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  DELETE FROM admin_report_schedules
  WHERE id = p_schedule_id
    AND admin_id = v_admin_id;
  
  IF FOUND THEN
    RETURN json_build_object('success', true, 'message', 'Schedule deleted successfully');
  ELSE
    RETURN json_build_object('success', false, 'error', 'Schedule not found or access denied');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. GENERATED REPORTS FUNCTIONS
-- =====================================================

-- Record a generated report
CREATE OR REPLACE FUNCTION record_generated_report(
  p_schedule_id UUID,
  p_report_name VARCHAR,
  p_report_type VARCHAR,
  p_file_name VARCHAR,
  p_file_format VARCHAR,
  p_record_count INTEGER,
  p_file_size_bytes BIGINT DEFAULT NULL,
  p_filter_criteria JSONB DEFAULT NULL,
  p_columns_included TEXT[] DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
  v_report_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  INSERT INTO admin_generated_reports (
    schedule_id, admin_id, report_name, report_type, file_name,
    file_format, record_count, file_size_bytes, filter_criteria,
    columns_included, generation_status
  )
  VALUES (
    p_schedule_id, v_admin_id, p_report_name, p_report_type, p_file_name,
    p_file_format, p_record_count, p_file_size_bytes, p_filter_criteria,
    p_columns_included, 'completed'
  )
  RETURNING id INTO v_report_id;
  
  -- Update schedule last run time
  UPDATE admin_report_schedules
  SET last_run_at = NOW()
  WHERE id = p_schedule_id;
  
  RETURN json_build_object(
    'success', true,
    'id', v_report_id,
    'message', 'Report recorded successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get generated reports
CREATE OR REPLACE FUNCTION get_generated_reports(
  p_schedule_id UUID DEFAULT NULL,
  p_report_type VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  schedule_id UUID,
  report_name VARCHAR,
  report_type VARCHAR,
  file_name VARCHAR,
  file_format VARCHAR,
  file_size_bytes BIGINT,
  record_count INTEGER,
  generation_status VARCHAR,
  generated_at TIMESTAMP WITH TIME ZONE,
  downloaded_at TIMESTAMP WITH TIME ZONE,
  download_count INTEGER
) AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin not found';
  END IF;
  
  RETURN QUERY
  SELECT 
    agr.id,
    agr.schedule_id,
    agr.report_name,
    agr.report_type,
    agr.file_name,
    agr.file_format,
    agr.file_size_bytes,
    agr.record_count,
    agr.generation_status,
    agr.generated_at,
    agr.downloaded_at,
    agr.download_count
  FROM admin_generated_reports agr
  WHERE agr.admin_id = v_admin_id
    AND (p_schedule_id IS NULL OR agr.schedule_id = p_schedule_id)
    AND (p_report_type IS NULL OR agr.report_type = p_report_type)
  ORDER BY agr.generated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Track report download
CREATE OR REPLACE FUNCTION track_report_download(p_report_id UUID)
RETURNS void AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN;
  END IF;
  
  UPDATE admin_generated_reports
  SET
    download_count = download_count + 1,
    downloaded_at = NOW()
  WHERE id = p_report_id
    AND admin_id = v_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get report statistics
CREATE OR REPLACE FUNCTION get_report_statistics()
RETURNS TABLE(
  total_schedules BIGINT,
  active_schedules BIGINT,
  total_generated_reports BIGINT,
  reports_this_month BIGINT,
  most_generated_type VARCHAR
) AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin not found';
  END IF;
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::BIGINT FROM admin_report_schedules WHERE admin_id = v_admin_id) as total_schedules,
    (SELECT COUNT(*)::BIGINT FROM admin_report_schedules WHERE admin_id = v_admin_id AND is_active = TRUE) as active_schedules,
    (SELECT COUNT(*)::BIGINT FROM admin_generated_reports WHERE admin_id = v_admin_id) as total_generated_reports,
    (SELECT COUNT(*)::BIGINT FROM admin_generated_reports WHERE admin_id = v_admin_id AND generated_at > DATE_TRUNC('month', CURRENT_DATE)) as reports_this_month,
    (
      SELECT agr.report_type
      FROM admin_generated_reports agr
      WHERE agr.admin_id = v_admin_id
      GROUP BY agr.report_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as most_generated_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

