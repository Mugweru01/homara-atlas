-- Export & Reporting System
-- Week 2, Day 10
-- Created: November 3, 2025

-- =====================================================
-- 1. EXPORT HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  export_type VARCHAR(50) NOT NULL, -- 'csv', 'json', 'excel'
  page_type VARCHAR(50) NOT NULL, -- 'users', 'verifications', 'listings', etc.
  file_name VARCHAR(255) NOT NULL,
  record_count INTEGER NOT NULL,
  filter_criteria JSONB, -- The filters that were active during export
  columns_exported TEXT[], -- Array of column names included
  file_size_bytes BIGINT,
  exported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_export_history_admin ON admin_export_history(admin_id);
CREATE INDEX IF NOT EXISTS idx_export_history_page ON admin_export_history(page_type);
CREATE INDEX IF NOT EXISTS idx_export_history_date ON admin_export_history(exported_at DESC);

-- =====================================================
-- 2. RLS POLICIES
-- =====================================================

ALTER TABLE admin_export_history ENABLE ROW LEVEL SECURITY;

-- Admins can view own exports
CREATE POLICY "Admins can view own exports" ON admin_export_history FOR SELECT
USING (admin_id = get_admin_id());

-- Admins can create own export records
CREATE POLICY "Admins can create export records" ON admin_export_history FOR INSERT
WITH CHECK (admin_id = get_admin_id());

-- Super admins can view all exports
CREATE POLICY "Super admins can view all exports" ON admin_export_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.id = get_admin_id() 
      AND admins.admin_role = 'super_admin'
  )
);

-- =====================================================
-- 3. EXPORT FUNCTIONS
-- =====================================================

-- Record an export
CREATE OR REPLACE FUNCTION record_export(
  p_export_type VARCHAR,
  p_page_type VARCHAR,
  p_file_name VARCHAR,
  p_record_count INTEGER,
  p_filter_criteria JSONB DEFAULT NULL,
  p_columns_exported TEXT[] DEFAULT NULL,
  p_file_size_bytes BIGINT DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
  v_export_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  INSERT INTO admin_export_history (
    admin_id, export_type, page_type, file_name, record_count,
    filter_criteria, columns_exported, file_size_bytes
  )
  VALUES (
    v_admin_id, p_export_type, p_page_type, p_file_name, p_record_count,
    p_filter_criteria, p_columns_exported, p_file_size_bytes
  )
  RETURNING id INTO v_export_id;
  
  RETURN json_build_object(
    'success', true,
    'id', v_export_id,
    'message', 'Export recorded successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get export history
CREATE OR REPLACE FUNCTION get_export_history(
  p_page_type VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  export_type VARCHAR,
  page_type VARCHAR,
  file_name VARCHAR,
  record_count INTEGER,
  filter_criteria JSONB,
  columns_exported TEXT[],
  file_size_bytes BIGINT,
  exported_at TIMESTAMP WITH TIME ZONE
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
    aeh.id,
    aeh.export_type,
    aeh.page_type,
    aeh.file_name,
    aeh.record_count,
    aeh.filter_criteria,
    aeh.columns_exported,
    aeh.file_size_bytes,
    aeh.exported_at
  FROM admin_export_history aeh
  WHERE aeh.admin_id = v_admin_id
    AND (p_page_type IS NULL OR aeh.page_type = p_page_type)
  ORDER BY aeh.exported_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get export statistics
CREATE OR REPLACE FUNCTION get_export_statistics()
RETURNS TABLE(
  total_exports BIGINT,
  total_records_exported BIGINT,
  most_exported_page VARCHAR,
  exports_this_month BIGINT,
  records_this_month BIGINT
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
    COUNT(*)::BIGINT as total_exports,
    SUM(aeh.record_count)::BIGINT as total_records_exported,
    (
      SELECT aeh2.page_type
      FROM admin_export_history aeh2
      WHERE aeh2.admin_id = v_admin_id
      GROUP BY aeh2.page_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as most_exported_page,
    (
      SELECT COUNT(*)::BIGINT
      FROM admin_export_history aeh3
      WHERE aeh3.admin_id = v_admin_id
        AND aeh3.exported_at > DATE_TRUNC('month', CURRENT_DATE)
    ) as exports_this_month,
    (
      SELECT SUM(aeh4.record_count)::BIGINT
      FROM admin_export_history aeh4
      WHERE aeh4.admin_id = v_admin_id
        AND aeh4.exported_at > DATE_TRUNC('month', CURRENT_DATE)
    ) as records_this_month
  FROM admin_export_history aeh
  WHERE aeh.admin_id = v_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

