-- CRM Lead Management System
-- Created: February 1, 2025
-- Phase 1: CRM Features - CRM-3: Lead Management System

-- =====================================================
-- 1. CRM LEAD SOURCES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(50), -- e.g., 'website', 'referral', 'social_media', 'advertising', 'event'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default lead sources
INSERT INTO crm_lead_sources (name, description, category) VALUES
  ('Website', 'Direct website visitor', 'website'),
  ('Referral', 'Referred by existing customer', 'referral'),
  ('Social Media', 'From social media platforms', 'social_media'),
  ('Search Engine', 'From search engine results', 'website'),
  ('Advertisement', 'From paid advertisements', 'advertising'),
  ('Email Campaign', 'From email marketing campaign', 'marketing'),
  ('Event', 'From trade show or event', 'event'),
  ('Phone Inquiry', 'Direct phone inquiry', 'phone'),
  ('Walk-in', 'Direct walk-in or visit', 'direct'),
  ('Partner', 'From business partner', 'partner')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. CRM LEADS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_id UUID REFERENCES crm_lead_sources(id) ON DELETE SET NULL,
  source_name VARCHAR(100), -- Denormalized for quick access
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost', 'nurturing')),
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  assigned_to UUID REFERENCES admins(user_id) ON DELETE SET NULL,
  expected_value DECIMAL(12, 2), -- Expected deal value/revenue
  conversion_probability INTEGER DEFAULT 0 CHECK (conversion_probability >= 0 AND conversion_probability <= 100),
  qualification_date TIMESTAMP WITH TIME ZONE,
  conversion_date TIMESTAMP WITH TIME ZONE,
  lost_reason TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  CONSTRAINT crm_leads_contact_or_user CHECK (
    contact_id IS NOT NULL OR user_id IS NOT NULL
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_leads_contact ON crm_leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_user ON crm_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned_to ON crm_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_leads_lead_score ON crm_leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_source ON crm_leads(source_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at ON crm_leads(created_at DESC);

-- =====================================================
-- 3. CRM LEAD SCORING RULES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_lead_scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('property_view', 'property_save', 'application_submit', 'inquiry_sent', 'profile_complete', 'engagement', 'demographic', 'custom')),
  condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('equals', 'greater_than', 'less_than', 'contains', 'exists')),
  condition_value TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher priority = evaluated first
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default scoring rules
INSERT INTO crm_lead_scoring_rules (rule_name, rule_type, condition_type, condition_value, points, priority, description) VALUES
  ('Property View', 'property_view', 'exists', NULL, 5, 10, 'Points for viewing a property'),
  ('Property Save', 'property_save', 'exists', NULL, 10, 20, 'Points for saving/favoriting a property'),
  ('Property Inquiry', 'inquiry_sent', 'exists', NULL, 15, 30, 'Points for sending a property inquiry'),
  ('Application Submitted', 'application_submit', 'exists', NULL, 25, 50, 'Points for submitting an application'),
  ('Profile Complete', 'profile_complete', 'greater_than', '80', 10, 5, 'Points for completing profile above 80%'),
  ('Multiple Property Views', 'engagement', 'greater_than', '5', 10, 15, 'Bonus points for viewing 5+ properties'),
  ('High Engagement', 'engagement', 'greater_than', '10', 15, 25, 'Bonus points for high engagement activity')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. CRM LEAD SCORE HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_lead_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  previous_score INTEGER,
  new_score INTEGER NOT NULL,
  score_change INTEGER NOT NULL,
  reason TEXT,
  triggered_by_rule_id UUID REFERENCES crm_lead_scoring_rules(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES crm_activities(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_score_history_lead ON crm_lead_score_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_score_history_created_at ON crm_lead_score_history(created_at DESC);

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_crm_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_crm_leads_updated_at
  BEFORE UPDATE ON crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_leads_updated_at();

-- Sync source_name from source_id
CREATE OR REPLACE FUNCTION sync_crm_lead_source_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source_id IS NOT NULL THEN
    SELECT name INTO NEW.source_name
    FROM crm_lead_sources
    WHERE id = NEW.source_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_crm_lead_source_name
  BEFORE INSERT OR UPDATE ON crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_crm_lead_source_name();

-- Sync user_id with contact_id
CREATE OR REPLACE FUNCTION sync_crm_lead_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL AND NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM crm_contacts
    WHERE id = NEW.contact_id;
  END IF;
  
  IF NEW.user_id IS NOT NULL AND NEW.contact_id IS NULL THEN
    SELECT id INTO NEW.contact_id
    FROM crm_contacts
    WHERE user_id = NEW.user_id
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_crm_lead_user_id
  BEFORE INSERT OR UPDATE ON crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_crm_lead_user_id();

-- Record score history on score change
CREATE OR REPLACE FUNCTION record_lead_score_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.lead_score IS DISTINCT FROM NEW.lead_score THEN
    INSERT INTO crm_lead_score_history (
      lead_id,
      previous_score,
      new_score,
      score_change,
      reason
    ) VALUES (
      NEW.id,
      COALESCE(OLD.lead_score, 0),
      NEW.lead_score,
      NEW.lead_score - COALESCE(OLD.lead_score, 0),
      'Score updated'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_record_lead_score_history
  AFTER UPDATE ON crm_leads
  FOR EACH ROW
  WHEN (OLD.lead_score IS DISTINCT FROM NEW.lead_score)
  EXECUTE FUNCTION record_lead_score_history();

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

ALTER TABLE crm_lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_score_history ENABLE ROW LEVEL SECURITY;

-- Lead Sources: Admins can view all
CREATE POLICY "Admins can view all lead sources" ON crm_lead_sources FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Leads: Admins can view all
CREATE POLICY "Admins can view all leads" ON crm_leads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Leads: Admins can insert
CREATE POLICY "Admins can insert leads" ON crm_leads FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Leads: Admins can update
CREATE POLICY "Admins can update leads" ON crm_leads FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Scoring Rules: Admins can view all
CREATE POLICY "Admins can view all scoring rules" ON crm_lead_scoring_rules FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Score History: Admins can view all
CREATE POLICY "Admins can view all score history" ON crm_lead_score_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

COMMENT ON TABLE crm_leads IS 'CRM Lead Management - Track leads through the sales pipeline';
COMMENT ON TABLE crm_lead_sources IS 'Lead source definitions for tracking lead origins';
COMMENT ON TABLE crm_lead_scoring_rules IS 'Configurable rules for automatic lead scoring';

