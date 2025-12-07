-- Business Intelligence Functions
-- Created: February 2, 2025
-- Phase 1: Critical Financial BI

-- =====================================================
-- 1. REVENUE ANALYTICS FUNCTIONS
-- =====================================================

-- Get revenue by period with breakdown
CREATE OR REPLACE FUNCTION get_revenue_by_period(
  p_period_type VARCHAR DEFAULT 'monthly',
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_dimensions JSONB DEFAULT NULL
)
RETURNS TABLE (
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  total_revenue NUMERIC,
  transaction_count BIGINT,
  average_transaction NUMERIC,
  revenue_by_type JSONB,
  dimensions JSONB
) AS $$
DECLARE
  v_start TIMESTAMP WITH TIME ZONE;
  v_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set default date range if not provided
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    v_end := NOW();
    CASE p_period_type
      WHEN 'daily' THEN v_start := v_end - INTERVAL '30 days';
      WHEN 'weekly' THEN v_start := v_end - INTERVAL '12 weeks';
      WHEN 'monthly' THEN v_start := v_end - INTERVAL '12 months';
      WHEN 'quarterly' THEN v_start := v_end - INTERVAL '4 quarters';
      WHEN 'yearly' THEN v_start := v_end - INTERVAL '5 years';
      ELSE v_start := v_end - INTERVAL '12 months';
    END CASE;
  ELSE
    v_start := p_start_date;
    v_end := p_end_date;
  END IF;

  RETURN QUERY
  WITH revenue_data AS (
    SELECT
      DATE_TRUNC(p_period_type, recorded_at) AS period,
      SUM(metric_value) AS revenue,
      COUNT(*) AS transactions
    FROM financial_metrics
    WHERE metric_type = 'revenue'
      AND recorded_at >= v_start
      AND recorded_at <= v_end
      AND (p_dimensions IS NULL OR dimensions @> p_dimensions)
    GROUP BY DATE_TRUNC(p_period_type, recorded_at)
  ),
  revenue_by_type_data AS (
    SELECT
      DATE_TRUNC(p_period_type, recorded_at) AS period,
      dimensions->>'product' AS product_type,
      SUM(metric_value) AS revenue
    FROM financial_metrics
    WHERE metric_type = 'revenue'
      AND recorded_at >= v_start
      AND recorded_at <= v_end
      AND (p_dimensions IS NULL OR dimensions @> p_dimensions)
    GROUP BY DATE_TRUNC(p_period_type, recorded_at), dimensions->>'product'
  )
  SELECT
    rd.period AS period_start,
    rd.period + 
      CASE p_period_type
        WHEN 'daily' THEN INTERVAL '1 day'
        WHEN 'weekly' THEN INTERVAL '1 week'
        WHEN 'monthly' THEN INTERVAL '1 month'
        WHEN 'quarterly' THEN INTERVAL '3 months'
        WHEN 'yearly' THEN INTERVAL '1 year'
        ELSE INTERVAL '1 month'
      END AS period_end,
    COALESCE(rd.revenue, 0) AS total_revenue,
    COALESCE(rd.transactions, 0) AS transaction_count,
    CASE 
      WHEN rd.transactions > 0 THEN rd.revenue / rd.transactions
      ELSE 0
    END AS average_transaction,
    COALESCE(
      jsonb_object_agg(
        rbt.product_type,
        rbt.revenue
      ) FILTER (WHERE rbt.product_type IS NOT NULL),
      '{}'::jsonb
    ) AS revenue_by_type,
    COALESCE(p_dimensions, '{}'::jsonb) AS dimensions
  FROM revenue_data rd
  LEFT JOIN revenue_by_type_data rbt ON rd.period = rbt.period
  GROUP BY rd.period, rd.revenue, rd.transactions
  ORDER BY rd.period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate revenue metrics (aggregate function)
CREATE OR REPLACE FUNCTION calculate_revenue_metrics(
  p_period_type VARCHAR DEFAULT 'monthly',
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_start TIMESTAMP WITH TIME ZONE;
  v_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set default date range
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    v_end := NOW();
    CASE p_period_type
      WHEN 'daily' THEN v_start := v_end - INTERVAL '30 days';
      WHEN 'weekly' THEN v_start := v_end - INTERVAL '12 weeks';
      WHEN 'monthly' THEN v_start := v_end - INTERVAL '12 months';
      ELSE v_start := v_end - INTERVAL '12 months';
    END CASE;
  ELSE
    v_start := p_start_date;
    v_end := p_end_date;
  END IF;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(metric_value), 0),
    'transaction_count', COUNT(*),
    'average_transaction', CASE WHEN COUNT(*) > 0 THEN SUM(metric_value) / COUNT(*) ELSE 0 END,
    'period_type', p_period_type,
    'start_date', v_start,
    'end_date', v_end,
    'revenue_by_product', (
      SELECT jsonb_object_agg(
        COALESCE(dimensions->>'product', 'other'),
        SUM(metric_value)
      )
      FROM financial_metrics
      WHERE metric_type = 'revenue'
        AND recorded_at >= v_start
        AND recorded_at <= v_end
      GROUP BY dimensions->>'product'
    ),
    'revenue_by_location', (
      SELECT jsonb_object_agg(
        COALESCE(dimensions->>'location', 'unknown'),
        SUM(metric_value)
      )
      FROM financial_metrics
      WHERE metric_type = 'revenue'
        AND recorded_at >= v_start
        AND recorded_at <= v_end
      GROUP BY dimensions->>'location'
    )
  ) INTO v_result
  FROM financial_metrics
  WHERE metric_type = 'revenue'
    AND recorded_at >= v_start
    AND recorded_at <= v_end;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get revenue trends (for forecasting)
CREATE OR REPLACE FUNCTION get_revenue_trends(
  p_periods INTEGER DEFAULT 12,
  p_period_type VARCHAR DEFAULT 'monthly'
)
RETURNS TABLE (
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  revenue NUMERIC,
  growth_rate NUMERIC,
  moving_average NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH revenue_data AS (
    SELECT
      DATE_TRUNC(p_period_type, recorded_at) AS period,
      SUM(metric_value) AS revenue
    FROM financial_metrics
    WHERE metric_type = 'revenue'
      AND recorded_at >= NOW() - (p_periods || ' ' || p_period_type)::INTERVAL
    GROUP BY DATE_TRUNC(p_period_type, recorded_at)
    ORDER BY period
  ),
  revenue_with_growth AS (
    SELECT
      period,
      revenue,
      LAG(revenue) OVER (ORDER BY period) AS prev_revenue,
      AVG(revenue) OVER (ORDER BY period ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg
    FROM revenue_data
  )
  SELECT
    rwg.period AS period_start,
    rwg.period + 
      CASE p_period_type
        WHEN 'daily' THEN INTERVAL '1 day'
        WHEN 'weekly' THEN INTERVAL '1 week'
        WHEN 'monthly' THEN INTERVAL '1 month'
        WHEN 'quarterly' THEN INTERVAL '3 months'
        WHEN 'yearly' THEN INTERVAL '1 year'
        ELSE INTERVAL '1 month'
      END AS period_end,
    rwg.revenue,
    CASE 
      WHEN rwg.prev_revenue > 0 
      THEN ((rwg.revenue - rwg.prev_revenue) / rwg.prev_revenue) * 100
      ELSE 0
    END AS growth_rate,
    rwg.moving_avg AS moving_average
  FROM revenue_with_growth rwg
  ORDER BY rwg.period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. CUSTOMER ANALYTICS FUNCTIONS
-- =====================================================

-- Calculate Customer Lifetime Value
CREATE OR REPLACE FUNCTION calculate_customer_ltv(
  p_segment VARCHAR DEFAULT NULL,
  p_cohort VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'average_ltv', COALESCE(AVG(metric_value), 0),
    'median_ltv', COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY metric_value), 0),
    'total_customers', COUNT(DISTINCT dimensions->>'customer_id'),
    'segment', COALESCE(p_segment, 'all'),
    'cohort', COALESCE(p_cohort, 'all'),
    'ltv_distribution', (
      SELECT jsonb_build_object(
        'high_value', COUNT(*) FILTER (WHERE metric_value >= PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY metric_value)),
        'medium_value', COUNT(*) FILTER (WHERE metric_value >= PERCENTILE_CONT(0.4) WITHIN GROUP (ORDER BY metric_value) AND metric_value < PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY metric_value)),
        'low_value', COUNT(*) FILTER (WHERE metric_value < PERCENTILE_CONT(0.4) WITHIN GROUP (ORDER BY metric_value))
      )
      FROM customer_metrics
      WHERE metric_type = 'ltv'
        AND (p_segment IS NULL OR dimensions->>'segment' = p_segment)
        AND (p_cohort IS NULL OR dimensions->>'cohort' = p_cohort)
    )
  ) INTO v_result
  FROM customer_metrics
  WHERE metric_type = 'ltv'
    AND (p_segment IS NULL OR dimensions->>'segment' = p_segment)
    AND (p_cohort IS NULL OR dimensions->>'cohort' = p_cohort);

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate churn rate
CREATE OR REPLACE FUNCTION calculate_churn_rate(
  p_period_type VARCHAR DEFAULT 'monthly',
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_segment VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_start TIMESTAMP WITH TIME ZONE;
  v_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set default date range
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    v_end := NOW();
    CASE p_period_type
      WHEN 'daily' THEN v_start := v_end - INTERVAL '30 days';
      WHEN 'weekly' THEN v_start := v_end - INTERVAL '12 weeks';
      WHEN 'monthly' THEN v_start := v_end - INTERVAL '12 months';
      ELSE v_start := v_end - INTERVAL '12 months';
    END CASE;
  ELSE
    v_start := p_start_date;
    v_end := p_end_date;
  END IF;

  SELECT jsonb_build_object(
    'period_type', p_period_type,
    'start_date', v_start,
    'end_date', v_end,
    'average_churn_rate', COALESCE(AVG(metric_value), 0),
    'total_churned', COALESCE(SUM(metric_value), 0),
    'churn_by_period', (
      SELECT jsonb_object_agg(
        DATE_TRUNC(p_period_type, recorded_at)::TEXT,
        SUM(metric_value)
      )
      FROM customer_metrics
      WHERE metric_type = 'churn'
        AND recorded_at >= v_start
        AND recorded_at <= v_end
        AND (p_segment IS NULL OR dimensions->>'segment' = p_segment)
      GROUP BY DATE_TRUNC(p_period_type, recorded_at)
    ),
    'segment', COALESCE(p_segment, 'all')
  ) INTO v_result
  FROM customer_metrics
  WHERE metric_type = 'churn'
    AND recorded_at >= v_start
    AND recorded_at <= v_end
    AND (p_segment IS NULL OR dimensions->>'segment' = p_segment);

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. EXECUTIVE DASHBOARD FUNCTIONS
-- =====================================================

-- Get executive dashboard KPIs
CREATE OR REPLACE FUNCTION get_executive_dashboard(
  p_period_type VARCHAR DEFAULT 'monthly',
  p_periods INTEGER DEFAULT 12
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_start_date TIMESTAMP WITH TIME ZONE;
BEGIN
  v_start_date := NOW() - (p_periods || ' ' || p_period_type)::INTERVAL;

  SELECT jsonb_build_object(
    'financial', (
      SELECT jsonb_build_object(
        'total_revenue', COALESCE(SUM(metric_value) FILTER (WHERE metric_type = 'revenue'), 0),
        'revenue_growth', 0, -- TODO: Calculate growth rate
        'profit_margin', 0, -- TODO: Calculate from profit metrics
        'arpu', 0 -- TODO: Calculate average revenue per user
      )
      FROM financial_metrics
      WHERE recorded_at >= v_start_date
    ),
    'customers', (
      SELECT jsonb_build_object(
        'total_customers', 0, -- TODO: Get from profiles table
        'new_customers', 0, -- TODO: Get from profiles table
        'churn_rate', COALESCE(AVG(metric_value) FILTER (WHERE metric_type = 'churn'), 0),
        'ltv', COALESCE(AVG(metric_value) FILTER (WHERE metric_type = 'ltv'), 0)
      )
      FROM customer_metrics
      WHERE recorded_at >= v_start_date
    ),
    'operational', (
      SELECT jsonb_build_object(
        'active_listings', 0, -- TODO: Get from properties table
        'bookings', 0, -- TODO: Get from bookings table
        'occupancy_rate', 0 -- TODO: Calculate
      )
    ),
    'period_type', p_period_type,
    'periods', p_periods,
    'generated_at', NOW()
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get KPI status
CREATE OR REPLACE FUNCTION get_kpi_status(
  p_kpi_codes TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  kpi_code VARCHAR(50),
  kpi_name VARCHAR(255),
  current_value NUMERIC,
  target_value NUMERIC,
  status VARCHAR(20),
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kd.kpi_code,
    kd.kpi_name,
    kh.kpi_value AS current_value,
    kh.target_value,
    kh.status,
    kh.period_start,
    kh.period_end
  FROM kpi_definitions kd
  LEFT JOIN LATERAL (
    SELECT *
    FROM kpi_history
    WHERE kpi_id = kd.id
    ORDER BY recorded_at DESC
    LIMIT 1
  ) kh ON true
  WHERE kd.is_active = true
    AND (p_kpi_codes IS NULL OR kd.kpi_code = ANY(p_kpi_codes))
  ORDER BY kd.kpi_category, kd.kpi_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

