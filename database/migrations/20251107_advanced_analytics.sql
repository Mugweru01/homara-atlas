-- Advanced Analytics System
-- Week 4, Day 16-17
-- Created: November 7, 2025

-- =====================================================
-- 1. ANALYTICS METRICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL, -- 'users', 'verifications', 'listings', 'revenue', etc.
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimension VARCHAR(50), -- 'daily', 'weekly', 'monthly', 'total'
  metadata JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_type ON analytics_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_name ON analytics_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_recorded ON analytics_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_period ON analytics_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_dimension ON analytics_metrics(dimension);

-- =====================================================
-- 2. RLS POLICIES
-- =====================================================

ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;

-- Admins can view all analytics
CREATE POLICY "Admins can view analytics metrics" ON analytics_metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- System can insert metrics
CREATE POLICY "System can insert analytics metrics" ON analytics_metrics FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 3. DASHBOARD ANALYTICS FUNCTIONS
-- =====================================================

-- Get overview statistics
CREATE OR REPLACE FUNCTION get_dashboard_overview()
RETURNS TABLE(
  total_users BIGINT,
  total_landlords BIGINT,
  total_renters BIGINT,
  total_verifications BIGINT,
  pending_verifications BIGINT,
  approved_verifications BIGINT,
  total_listings BIGINT,
  active_listings BIGINT,
  total_flags BIGINT,
  pending_flags BIGINT,
  users_today BIGINT,
  users_this_week BIGINT,
  users_this_month BIGINT,
  verifications_today BIGINT,
  verifications_this_week BIGINT,
  verifications_this_month BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- User counts
    (SELECT COUNT(*)::BIGINT FROM profiles) as total_users,
    (SELECT COUNT(*)::BIGINT FROM profiles WHERE role = 'landlord') as total_landlords,
    (SELECT COUNT(*)::BIGINT FROM profiles WHERE role IN ('renter', 'customer')) as total_renters,
    
    -- Verification counts
    (SELECT COUNT(*)::BIGINT FROM landlord_verifications) as total_verifications,
    (SELECT COUNT(*)::BIGINT FROM landlord_verifications WHERE status = 'pending'::verification_status) as pending_verifications,
    (SELECT COUNT(*)::BIGINT FROM landlord_verifications WHERE status = 'approved'::verification_status) as approved_verifications,
    
    -- Listing counts
    (SELECT COUNT(*)::BIGINT FROM properties) as total_listings,
    (SELECT COUNT(*)::BIGINT FROM properties WHERE status = 'active') as active_listings,
    
    -- Flag counts
    (SELECT COUNT(*)::BIGINT FROM property_flags) as total_flags,
    (SELECT COUNT(*)::BIGINT FROM property_flags WHERE status = 'pending') as pending_flags,
    
    -- Users by period
    (SELECT COUNT(*)::BIGINT FROM profiles WHERE created_at > CURRENT_DATE) as users_today,
    (SELECT COUNT(*)::BIGINT FROM profiles WHERE created_at > DATE_TRUNC('week', CURRENT_DATE)) as users_this_week,
    (SELECT COUNT(*)::BIGINT FROM profiles WHERE created_at > DATE_TRUNC('month', CURRENT_DATE)) as users_this_month,
    
    -- Verifications by period
    (SELECT COUNT(*)::BIGINT FROM landlord_verifications WHERE created_at > CURRENT_DATE) as verifications_today,
    (SELECT COUNT(*)::BIGINT FROM landlord_verifications WHERE created_at > DATE_TRUNC('week', CURRENT_DATE)) as verifications_this_week,
    (SELECT COUNT(*)::BIGINT FROM landlord_verifications WHERE created_at > DATE_TRUNC('month', CURRENT_DATE)) as verifications_this_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user growth over time
CREATE OR REPLACE FUNCTION get_user_growth(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  date DATE,
  new_users BIGINT,
  cumulative_users BIGINT,
  landlords BIGINT,
  renters BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (p_days || ' days')::INTERVAL,
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as date
  ),
  daily_counts AS (
    SELECT 
      DATE(p.created_at) as date,
      COUNT(*)::BIGINT as new_users,
      COUNT(*) FILTER (WHERE p.role = 'landlord')::BIGINT as landlords,
      COUNT(*) FILTER (WHERE p.role IN ('renter', 'customer'))::BIGINT as renters
    FROM profiles p
    WHERE p.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    GROUP BY DATE(p.created_at)
  )
  SELECT 
    ds.date,
    COALESCE(dc.new_users, 0) as new_users,
    SUM(COALESCE(dc.new_users, 0)) OVER (ORDER BY ds.date) as cumulative_users,
    COALESCE(dc.landlords, 0) as landlords,
    COALESCE(dc.renters, 0) as renters
  FROM date_series ds
  LEFT JOIN daily_counts dc ON ds.date = dc.date
  ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get verification trends
CREATE OR REPLACE FUNCTION get_verification_trends(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  date DATE,
  submitted BIGINT,
  approved BIGINT,
  rejected BIGINT,
  pending BIGINT,
  approval_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (p_days || ' days')::INTERVAL,
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as date
  ),
  daily_verifications AS (
    SELECT 
      DATE(lv.created_at) as date,
      COUNT(*)::BIGINT as submitted,
      COUNT(*) FILTER (WHERE lv.status = 'approved'::verification_status)::BIGINT as approved,
      COUNT(*) FILTER (WHERE lv.status = 'rejected'::verification_status)::BIGINT as rejected,
      COUNT(*) FILTER (WHERE lv.status = 'pending'::verification_status)::BIGINT as pending
    FROM landlord_verifications lv
    WHERE lv.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    GROUP BY DATE(lv.created_at)
  )
  SELECT 
    ds.date,
    COALESCE(dv.submitted, 0) as submitted,
    COALESCE(dv.approved, 0) as approved,
    COALESCE(dv.rejected, 0) as rejected,
    COALESCE(dv.pending, 0) as pending,
    CASE 
      WHEN COALESCE(dv.submitted, 0) > 0 
      THEN ROUND((COALESCE(dv.approved, 0)::NUMERIC / COALESCE(dv.submitted, 0)::NUMERIC) * 100, 2)
      ELSE 0 
    END as approval_rate
  FROM date_series ds
  LEFT JOIN daily_verifications dv ON ds.date = dv.date
  ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get listing statistics
CREATE OR REPLACE FUNCTION get_listing_statistics()
RETURNS TABLE(
  total_listings BIGINT,
  active_listings BIGINT,
  inactive_listings BIGINT,
  pending_listings BIGINT,
  avg_price NUMERIC,
  total_views BIGINT,
  total_saves BIGINT,
  avg_views_per_listing NUMERIC,
  listings_by_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_listings,
    COUNT(*) FILTER (WHERE p.status = 'active')::BIGINT as active_listings,
    COUNT(*) FILTER (WHERE p.status = 'inactive')::BIGINT as inactive_listings,
    COUNT(*) FILTER (WHERE p.status = 'pending')::BIGINT as pending_listings,
    ROUND(AVG(p.price), 2) as avg_price,
    COALESCE(SUM(p.view_count), 0)::BIGINT as total_views,
    COALESCE(SUM(p.save_count), 0)::BIGINT as total_saves,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(p.view_count), 0)::NUMERIC / COUNT(*)::NUMERIC, 2)
      ELSE 0 
    END as avg_views_per_listing,
    (
      SELECT jsonb_object_agg(property_type, count)
      FROM (
        SELECT property_type, COUNT(*)::BIGINT as count
        FROM properties
        GROUP BY property_type
      ) counts
    ) as listings_by_type
  FROM properties p;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get top performing listings
CREATE OR REPLACE FUNCTION get_top_listings(
  p_metric VARCHAR DEFAULT 'views', -- 'views', 'saves', 'inquiries'
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  title VARCHAR,
  property_type VARCHAR,
  price NUMERIC,
  view_count INTEGER,
  save_count INTEGER,
  status VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.property_type,
    p.price,
    p.view_count,
    p.save_count,
    p.status,
    p.created_at
  FROM properties p
  ORDER BY 
    CASE 
      WHEN p_metric = 'views' THEN p.view_count
      WHEN p_metric = 'saves' THEN p.save_count
      ELSE p.view_count
    END DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get admin activity summary
CREATE OR REPLACE FUNCTION get_admin_activity_summary(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  admin_id UUID,
  admin_email VARCHAR,
  admin_role VARCHAR,
  total_actions BIGINT,
  verifications_reviewed BIGINT,
  users_managed BIGINT,
  last_active TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as admin_id,
    a.email as admin_email,
    a.admin_role::VARCHAR as admin_role,
    (
      SELECT COUNT(*)::BIGINT
      FROM activity_log al
      WHERE al.actor_id = a.id
        AND al.actor_type = 'admin'
        AND al.created_at > CURRENT_DATE - (p_days || ' days')::INTERVAL
    ) as total_actions,
    (
      SELECT COUNT(*)::BIGINT
      FROM landlord_verifications lv
      WHERE lv.reviewed_by = a.id
        AND lv.reviewed_at > CURRENT_DATE - (p_days || ' days')::INTERVAL
    ) as verifications_reviewed,
    (
      SELECT COUNT(*)::BIGINT
      FROM activity_log al
      WHERE al.actor_id = a.id
        AND al.actor_type = 'admin'
        AND al.entity_type = 'user'
        AND al.created_at > CURRENT_DATE - (p_days || ' days')::INTERVAL
    ) as users_managed,
    (
      SELECT MAX(al.created_at)
      FROM activity_log al
      WHERE al.actor_id = a.id
        AND al.actor_type = 'admin'
    ) as last_active
  FROM admins a
  WHERE a.status = 'active'
  ORDER BY total_actions DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get trust score distribution
CREATE OR REPLACE FUNCTION get_trust_score_distribution()
RETURNS TABLE(
  score_range VARCHAR,
  count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM landlord_verifications WHERE trust_score IS NOT NULL;
  
  RETURN QUERY
  SELECT 
    ranges.range_name as score_range,
    ranges.count::BIGINT,
    CASE 
      WHEN v_total > 0 THEN ROUND((ranges.count::NUMERIC / v_total::NUMERIC) * 100, 2)
      ELSE 0
    END as percentage
  FROM (
    SELECT '0-20' as range_name, COUNT(*) as count
    FROM landlord_verifications
    WHERE trust_score >= 0 AND trust_score < 20
    UNION ALL
    SELECT '20-40', COUNT(*)
    FROM landlord_verifications
    WHERE trust_score >= 20 AND trust_score < 40
    UNION ALL
    SELECT '40-60', COUNT(*)
    FROM landlord_verifications
    WHERE trust_score >= 40 AND trust_score < 60
    UNION ALL
    SELECT '60-80', COUNT(*)
    FROM landlord_verifications
    WHERE trust_score >= 60 AND trust_score < 80
    UNION ALL
    SELECT '80-100', COUNT(*)
    FROM landlord_verifications
    WHERE trust_score >= 80 AND trust_score <= 100
  ) ranges
  ORDER BY range_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record analytics metric
CREATE OR REPLACE FUNCTION record_analytics_metric(
  p_metric_type VARCHAR,
  p_metric_name VARCHAR,
  p_metric_value NUMERIC,
  p_dimension VARCHAR DEFAULT 'total',
  p_metadata JSONB DEFAULT NULL,
  p_period_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_period_end TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO analytics_metrics (
    metric_type, metric_name, metric_value, dimension,
    metadata, period_start, period_end
  )
  VALUES (
    p_metric_type, p_metric_name, p_metric_value, p_dimension,
    p_metadata, p_period_start, p_period_end
  )
  RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

