-- Advanced Filtering & Search System
-- Week 2, Days 8-9
-- Created: November 2, 2025

-- =====================================================
-- 1. SAVED FILTERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  filter_name VARCHAR(100) NOT NULL,
  filter_description TEXT,
  page_type VARCHAR(50) NOT NULL, -- 'users', 'verifications', 'listings', 'audit_logs', etc.
  filter_criteria JSONB NOT NULL, -- Stores the actual filter configuration
  is_public BOOLEAN DEFAULT FALSE, -- If true, other admins can use this filter
  is_default BOOLEAN DEFAULT FALSE, -- If true, this filter is applied by default for this admin on this page
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_filters_admin ON admin_saved_filters(admin_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_page ON admin_saved_filters(page_type);
CREATE INDEX IF NOT EXISTS idx_saved_filters_public ON admin_saved_filters(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_saved_filters_criteria ON admin_saved_filters USING gin(filter_criteria);

-- =====================================================
-- 2. SEARCH HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  page_type VARCHAR(50) NOT NULL,
  search_query TEXT NOT NULL,
  search_type VARCHAR(50), -- 'basic', 'advanced', 'full_text'
  result_count INTEGER,
  searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_search_history_admin ON admin_search_history(admin_id);
CREATE INDEX IF NOT EXISTS idx_search_history_page ON admin_search_history(page_type);
CREATE INDEX IF NOT EXISTS idx_search_history_date ON admin_search_history(searched_at DESC);

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

ALTER TABLE admin_saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_search_history ENABLE ROW LEVEL SECURITY;

-- Saved Filters: Admins can view own filters + public filters
CREATE POLICY "Admins can view own and public filters" ON admin_saved_filters FOR SELECT
USING (
  admin_id = get_admin_id() 
  OR is_public = TRUE
  OR EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.id = get_admin_id() 
      AND admins.admin_role = 'super_admin'
  )
);

-- Saved Filters: Admins can manage own filters
CREATE POLICY "Admins can manage own filters" ON admin_saved_filters FOR ALL
USING (admin_id = get_admin_id());

-- Search History: Admins can only view/manage own history
CREATE POLICY "Admins can view own search history" ON admin_search_history FOR SELECT
USING (admin_id = get_admin_id());

CREATE POLICY "Admins can manage own search history" ON admin_search_history FOR ALL
USING (admin_id = get_admin_id());

-- =====================================================
-- 4. FILTER MANAGEMENT FUNCTIONS
-- =====================================================

-- Get saved filters for a page
CREATE OR REPLACE FUNCTION get_saved_filters(p_page_type TEXT)
RETURNS TABLE(
  id UUID,
  filter_name VARCHAR,
  filter_description TEXT,
  page_type VARCHAR,
  filter_criteria JSONB,
  is_public BOOLEAN,
  is_default BOOLEAN,
  is_own BOOLEAN,
  usage_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE
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
    asf.id,
    asf.filter_name,
    asf.filter_description,
    asf.page_type,
    asf.filter_criteria,
    asf.is_public,
    asf.is_default,
    (asf.admin_id = v_admin_id) as is_own,
    asf.usage_count,
    asf.created_at,
    asf.last_used_at
  FROM admin_saved_filters asf
  WHERE asf.page_type = p_page_type
    AND (asf.admin_id = v_admin_id OR asf.is_public = TRUE)
  ORDER BY asf.is_default DESC, asf.usage_count DESC, asf.last_used_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Save a new filter
CREATE OR REPLACE FUNCTION save_filter(
  p_filter_name VARCHAR,
  p_page_type VARCHAR,
  p_filter_criteria JSONB,
  p_filter_description TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT FALSE,
  p_is_default BOOLEAN DEFAULT FALSE
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
  v_filter_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  -- If setting as default, unset other defaults for this admin and page
  IF p_is_default THEN
    UPDATE admin_saved_filters
    SET is_default = FALSE
    WHERE admin_id = v_admin_id AND page_type = p_page_type;
  END IF;
  
  -- Insert the new filter
  INSERT INTO admin_saved_filters (
    admin_id, filter_name, page_type, filter_criteria,
    filter_description, is_public, is_default
  )
  VALUES (
    v_admin_id, p_filter_name, p_page_type, p_filter_criteria,
    p_filter_description, p_is_public, p_is_default
  )
  RETURNING id INTO v_filter_id;
  
  RETURN json_build_object(
    'success', true,
    'id', v_filter_id,
    'message', 'Filter saved successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update a saved filter
CREATE OR REPLACE FUNCTION update_saved_filter(
  p_filter_id UUID,
  p_filter_name VARCHAR DEFAULT NULL,
  p_filter_criteria JSONB DEFAULT NULL,
  p_filter_description TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT NULL,
  p_is_default BOOLEAN DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
  v_page_type VARCHAR;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  -- Get page_type for this filter
  SELECT page_type INTO v_page_type
  FROM admin_saved_filters
  WHERE id = p_filter_id AND admin_id = v_admin_id;
  
  IF v_page_type IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Filter not found or access denied');
  END IF;
  
  -- If setting as default, unset other defaults
  IF p_is_default = TRUE THEN
    UPDATE admin_saved_filters
    SET is_default = FALSE
    WHERE admin_id = v_admin_id AND page_type = v_page_type AND id != p_filter_id;
  END IF;
  
  -- Update the filter
  UPDATE admin_saved_filters
  SET
    filter_name = COALESCE(p_filter_name, filter_name),
    filter_criteria = COALESCE(p_filter_criteria, filter_criteria),
    filter_description = COALESCE(p_filter_description, filter_description),
    is_public = COALESCE(p_is_public, is_public),
    is_default = COALESCE(p_is_default, is_default),
    updated_at = NOW()
  WHERE id = p_filter_id AND admin_id = v_admin_id;
  
  RETURN json_build_object('success', true, 'message', 'Filter updated successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete a saved filter
CREATE OR REPLACE FUNCTION delete_saved_filter(p_filter_id UUID)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  DELETE FROM admin_saved_filters
  WHERE id = p_filter_id AND admin_id = v_admin_id;
  
  IF FOUND THEN
    RETURN json_build_object('success', true, 'message', 'Filter deleted successfully');
  ELSE
    RETURN json_build_object('success', false, 'error', 'Filter not found or access denied');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Track filter usage
CREATE OR REPLACE FUNCTION track_filter_usage(p_filter_id UUID)
RETURNS void AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN;
  END IF;
  
  UPDATE admin_saved_filters
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = p_filter_id
    AND (admin_id = v_admin_id OR is_public = TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. SEARCH HISTORY FUNCTIONS
-- =====================================================

-- Record a search
CREATE OR REPLACE FUNCTION record_search(
  p_page_type VARCHAR,
  p_search_query TEXT,
  p_search_type VARCHAR DEFAULT 'basic',
  p_result_count INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN;
  END IF;
  
  INSERT INTO admin_search_history (
    admin_id, page_type, search_query, search_type, result_count
  )
  VALUES (
    v_admin_id, p_page_type, p_search_query, p_search_type, p_result_count
  );
  
  -- Keep only last 50 searches per admin per page
  DELETE FROM admin_search_history
  WHERE id IN (
    SELECT id
    FROM admin_search_history
    WHERE admin_id = v_admin_id AND page_type = p_page_type
    ORDER BY searched_at DESC
    OFFSET 50
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get search history
CREATE OR REPLACE FUNCTION get_search_history(
  p_page_type VARCHAR,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  search_query TEXT,
  search_type VARCHAR,
  result_count INTEGER,
  searched_at TIMESTAMP WITH TIME ZONE
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
    ash.id,
    ash.search_query,
    ash.search_type,
    ash.result_count,
    ash.searched_at
  FROM admin_search_history ash
  WHERE ash.admin_id = v_admin_id
    AND ash.page_type = p_page_type
  ORDER BY ash.searched_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get popular searches (across all admins)
CREATE OR REPLACE FUNCTION get_popular_searches(
  p_page_type VARCHAR,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
  search_query TEXT,
  search_count BIGINT,
  avg_results NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ash.search_query,
    COUNT(*)::BIGINT as search_count,
    AVG(ash.result_count)::NUMERIC as avg_results
  FROM admin_search_history ash
  WHERE ash.page_type = p_page_type
    AND ash.searched_at > NOW() - INTERVAL '30 days'
  GROUP BY ash.search_query
  ORDER BY search_count DESC, avg_results DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

