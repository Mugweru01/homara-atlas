-- Business Intelligence System
-- Created: February 2, 2025
-- Phase 1: Critical Financial BI

-- =====================================================
-- 1. FINANCIAL METRICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS financial_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN (
    'revenue', 'profit', 'cost', 'commission', 'payment', 'transaction'
  )),
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  currency VARCHAR(10) DEFAULT 'KES',
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN (
    'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'total'
  )),
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  dimensions JSONB DEFAULT '{}'::jsonb, -- e.g., {"product": "rentals", "location": "Nairobi", "segment": "landlords"}
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_financial_metrics_type ON financial_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_name ON financial_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_period ON financial_metrics(period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_recorded ON financial_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_dimensions ON financial_metrics USING GIN(dimensions);

-- =====================================================
-- 2. KPI DEFINITIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_code VARCHAR(50) NOT NULL UNIQUE,
  kpi_name VARCHAR(255) NOT NULL,
  kpi_category VARCHAR(50) NOT NULL CHECK (kpi_category IN (
    'financial', 'customer', 'operational', 'growth', 'quality'
  )),
  description TEXT,
  calculation_method TEXT, -- SQL or formula description
  target_value NUMERIC,
  warning_threshold NUMERIC,
  critical_threshold NUMERIC,
  unit VARCHAR(20), -- e.g., 'KES', 'percentage', 'count'
  direction VARCHAR(10) CHECK (direction IN ('higher', 'lower', 'neutral')), -- higher is better, lower is better, or neutral
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES admins(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_category ON kpi_definitions(kpi_category);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_active ON kpi_definitions(is_active);

-- =====================================================
-- 3. KPI HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS kpi_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID REFERENCES kpi_definitions(id) ON DELETE CASCADE,
  kpi_code VARCHAR(50) NOT NULL, -- Denormalized for performance
  kpi_value NUMERIC NOT NULL,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN (
    'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  )),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  target_value NUMERIC,
  status VARCHAR(20) CHECK (status IN ('on_target', 'warning', 'critical', 'excellent')),
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kpi_history_kpi_id ON kpi_history(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_history_kpi_code ON kpi_history(kpi_code);
CREATE INDEX IF NOT EXISTS idx_kpi_history_period ON kpi_history(period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_kpi_history_recorded ON kpi_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_history_status ON kpi_history(status);

-- =====================================================
-- 4. CUSTOMER METRICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS customer_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN (
    'ltv', 'churn', 'acquisition', 'engagement', 'satisfaction', 'retention'
  )),
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN (
    'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'total'
  )),
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  dimensions JSONB DEFAULT '{}'::jsonb, -- e.g., {"segment": "landlords", "cohort": "2024-01", "location": "Nairobi"}
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_metrics_type ON customer_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_name ON customer_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_period ON customer_metrics(period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_recorded ON customer_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_dimensions ON customer_metrics USING GIN(dimensions);

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

ALTER TABLE financial_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_metrics ENABLE ROW LEVEL SECURITY;

-- Admins can view all financial metrics
CREATE POLICY "Admins can view financial metrics" ON financial_metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- System can insert financial metrics
CREATE POLICY "System can insert financial metrics" ON financial_metrics FOR INSERT
WITH CHECK (true);

-- Admins can view KPI definitions
CREATE POLICY "Admins can view KPI definitions" ON kpi_definitions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Super admins can manage KPI definitions
CREATE POLICY "Super admins can manage KPI definitions" ON kpi_definitions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
      AND admins.admin_role = 'super_admin'
  )
);

-- Admins can view KPI history
CREATE POLICY "Admins can view KPI history" ON kpi_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- System can insert KPI history
CREATE POLICY "System can insert KPI history" ON kpi_history FOR INSERT
WITH CHECK (true);

-- Admins can view customer metrics
CREATE POLICY "Admins can view customer metrics" ON customer_metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- System can insert customer metrics
CREATE POLICY "System can insert customer metrics" ON customer_metrics FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Update updated_at on kpi_definitions
CREATE OR REPLACE FUNCTION update_kpi_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_kpi_definitions_updated_at_trigger
  BEFORE UPDATE ON kpi_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_kpi_definitions_updated_at();

