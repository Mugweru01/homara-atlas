-- Dashboard Customization System
-- Week 5, Day 22
-- Created: November 10, 2025

-- =====================================================
-- 1. DASHBOARD LAYOUT PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE UNIQUE,
  layout_config JSONB NOT NULL DEFAULT '[]', -- Array of widget configurations
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_dashboard_prefs_admin ON admin_dashboard_preferences(admin_id);

-- =====================================================
-- 2. AVAILABLE WIDGETS CATALOG
-- =====================================================

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_key VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'user_stats', 'verification_chart'
  widget_name VARCHAR(100) NOT NULL,
  widget_description TEXT,
  widget_category VARCHAR(50), -- 'metrics', 'charts', 'lists', 'actions'
  default_size VARCHAR(20) DEFAULT 'medium', -- 'small', 'medium', 'large', 'full'
  default_position INTEGER DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  min_role VARCHAR(20) DEFAULT 'admin', -- Minimum role required
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_widgets_enabled ON dashboard_widgets(is_enabled);
CREATE INDEX IF NOT EXISTS idx_widgets_category ON dashboard_widgets(widget_category);

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

ALTER TABLE admin_dashboard_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Admins can view and update their own preferences
CREATE POLICY "Admins can view own preferences" ON admin_dashboard_preferences FOR SELECT
USING (admin_id = (SELECT id FROM admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert own preferences" ON admin_dashboard_preferences FOR INSERT
WITH CHECK (admin_id = (SELECT id FROM admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update own preferences" ON admin_dashboard_preferences FOR UPDATE
USING (admin_id = (SELECT id FROM admins WHERE user_id = auth.uid()));

-- All admins can view available widgets
CREATE POLICY "Admins can view widgets" ON dashboard_widgets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  )
);

-- Only super admins can manage widgets
CREATE POLICY "Super admins can manage widgets" ON dashboard_widgets FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role = 'super_admin'
      AND status = 'active'
  )
);

-- =====================================================
-- 4. DASHBOARD FUNCTIONS
-- =====================================================

-- Get admin's dashboard layout
CREATE OR REPLACE FUNCTION get_dashboard_layout()
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_layout JSONB;
BEGIN
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin not found.';
  END IF;
  
  SELECT layout_config INTO v_layout 
  FROM admin_dashboard_preferences 
  WHERE admin_id = v_admin_id;
  
  -- If no preferences exist, return default layout
  IF v_layout IS NULL THEN
    RETURN get_default_dashboard_layout();
  END IF;
  
  RETURN v_layout;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get default dashboard layout
CREATE OR REPLACE FUNCTION get_default_dashboard_layout()
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_array(
    jsonb_build_object('id', 'user_stats', 'position', 0, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'verification_stats', 'position', 1, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'listing_stats', 'position', 2, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'pending_verifications', 'position', 3, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'recent_activity', 'position', 4, 'visible', true, 'size', 'large'),
    jsonb_build_object('id', 'quick_actions', 'position', 5, 'visible', true, 'size', 'large')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Save dashboard layout
CREATE OR REPLACE FUNCTION save_dashboard_layout(p_layout JSONB)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin not found.';
  END IF;
  
  INSERT INTO admin_dashboard_preferences (admin_id, layout_config, updated_at)
  VALUES (v_admin_id, p_layout, NOW())
  ON CONFLICT (admin_id) 
  DO UPDATE SET 
    layout_config = p_layout,
    updated_at = NOW();
  
  RETURN jsonb_build_object('success', true, 'message', 'Layout saved successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset dashboard layout to default
CREATE OR REPLACE FUNCTION reset_dashboard_layout()
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin not found.';
  END IF;
  
  DELETE FROM admin_dashboard_preferences WHERE admin_id = v_admin_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Layout reset to default',
    'layout', get_default_dashboard_layout()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get available widgets
CREATE OR REPLACE FUNCTION get_available_widgets()
RETURNS TABLE(
  id UUID,
  widget_key VARCHAR,
  widget_name VARCHAR,
  widget_description TEXT,
  widget_category VARCHAR,
  default_size VARCHAR,
  min_role VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.widget_key,
    w.widget_name,
    w.widget_description,
    w.widget_category,
    w.default_size,
    w.min_role
  FROM dashboard_widgets w
  WHERE w.is_enabled = true
  ORDER BY w.widget_category, w.widget_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. INSERT DEFAULT WIDGETS
-- =====================================================

INSERT INTO dashboard_widgets (widget_key, widget_name, widget_description, widget_category, default_size, default_position, min_role) VALUES
  ('user_stats', 'User Statistics', 'Total users, landlords, and renters', 'metrics', 'medium', 0, 'admin'),
  ('verification_stats', 'Verification Metrics', 'Pending and approved verifications', 'metrics', 'medium', 1, 'admin'),
  ('listing_stats', 'Listing Overview', 'Active properties and flagged content', 'metrics', 'medium', 2, 'admin'),
  ('pending_verifications', 'Pending Verifications', 'Verifications awaiting review', 'metrics', 'medium', 3, 'admin'),
  ('recent_activity', 'Recent Activity', 'Latest admin actions and changes', 'lists', 'large', 4, 'admin'),
  ('quick_actions', 'Quick Actions', 'Common administrative tasks', 'actions', 'large', 5, 'admin'),
  ('system_health', 'System Health', 'Database and server metrics', 'metrics', 'medium', 6, 'senior_admin'),
  ('error_log', 'Error Log', 'Recent system errors', 'lists', 'large', 7, 'super_admin'),
  ('performance_metrics', 'Performance Metrics', 'API and page load times', 'charts', 'large', 8, 'senior_admin'),
  ('user_growth_chart', 'User Growth', 'User registration trends', 'charts', 'large', 9, 'admin'),
  ('verification_chart', 'Verification Trends', 'Verification approval rates', 'charts', 'large', 10, 'admin'),
  ('admin_activity', 'Admin Activity', 'Team productivity metrics', 'metrics', 'medium', 11, 'senior_admin')
ON CONFLICT (widget_key) DO NOTHING;

