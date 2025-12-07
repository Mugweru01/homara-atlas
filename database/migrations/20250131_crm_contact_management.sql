-- CRM Contact Management System
-- Created: January 31, 2025
-- Phase 1: CRM Features - CRM-1: Contact Management

-- =====================================================
-- 1. CRM CONTACTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Link to existing user if exists
  contact_type VARCHAR(50) NOT NULL DEFAULT 'prospect' CHECK (contact_type IN ('user', 'lead', 'prospect', 'customer')),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(200) GENERATED ALWAYS AS (COALESCE(first_name || ' ' || last_name, first_name, last_name, 'Unknown')) STORED,
  email VARCHAR(255),
  phone VARCHAR(50),
  phone_e164 VARCHAR(50), -- E.164 formatted phone
  company_name VARCHAR(200),
  job_title VARCHAR(100),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  county VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Kenya',
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived', 'duplicate')),
  source VARCHAR(100), -- How they were added (manual, import, api, website, referral, etc.)
  source_details JSONB, -- Additional source information
  assigned_to UUID, -- Admin user assigned to this contact
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb, -- Flexible custom fields
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata
  tags TEXT[] DEFAULT '{}', -- Quick tags array (denormalized for performance)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID, -- Admin who created this contact
  updated_by UUID, -- Admin who last updated
  archived_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT crm_contacts_email_check CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT crm_contacts_user_or_contact CHECK (
    user_id IS NOT NULL OR (first_name IS NOT NULL OR last_name IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone ON crm_contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_type ON crm_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned_to ON crm_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_source ON crm_contacts(source);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_at ON crm_contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_updated_at ON crm_contacts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_full_name ON crm_contacts(full_name);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tags ON crm_contacts USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_custom_fields ON crm_contacts USING gin(custom_fields);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_metadata ON crm_contacts USING gin(metadata);

-- =====================================================
-- 2. CRM CONTACT TAGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_contact_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#3b82f6', -- Hex color code
  description TEXT,
  category VARCHAR(50), -- Group tags into categories
  is_system BOOLEAN DEFAULT FALSE, -- System tags cannot be deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  
  CONSTRAINT crm_contact_tags_name_check CHECK (char_length(trim(name)) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_contact_tags_name ON crm_contact_tags(name);
CREATE INDEX IF NOT EXISTS idx_crm_contact_tags_category ON crm_contact_tags(category);

-- Junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS crm_contact_tag_assignments (
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES crm_contact_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID,
  
  PRIMARY KEY (contact_id, tag_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_contact_tag_assignments_contact ON crm_contact_tag_assignments(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_tag_assignments_tag ON crm_contact_tag_assignments(tag_id);

-- =====================================================
-- 3. CRM CONTACT CUSTOM FIELDS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_contact_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  field_key VARCHAR(100) NOT NULL UNIQUE, -- Used in JSONB custom_fields
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'datetime', 'dropdown', 'checkbox', 'textarea', 'url', 'email', 'phone')),
  field_options JSONB, -- For dropdown options: {"options": ["Option 1", "Option 2"]}
  is_required BOOLEAN DEFAULT FALSE,
  default_value TEXT,
  placeholder TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  
  CONSTRAINT crm_contact_custom_field_definitions_key_check CHECK (field_key ~ '^[a-z0-9_]+$') -- Only lowercase, numbers, underscore
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_contact_custom_field_definitions_key ON crm_contact_custom_field_definitions(field_key);
CREATE INDEX IF NOT EXISTS idx_crm_contact_custom_field_definitions_active ON crm_contact_custom_field_definitions(is_active);

-- =====================================================
-- 4. CRM CONTACT NOTES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  note_type VARCHAR(50) DEFAULT 'general' CHECK (note_type IN ('general', 'call', 'meeting', 'email', 'follow-up', 'system')),
  title VARCHAR(200),
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_private BOOLEAN DEFAULT FALSE, -- Private notes only visible to creator
  created_by UUID NOT NULL, -- Admin user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID,
  
  CONSTRAINT crm_contact_notes_content_check CHECK (char_length(trim(content)) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_contact_notes_contact ON crm_contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_notes_created_at ON crm_contact_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contact_notes_type ON crm_contact_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_crm_contact_notes_created_by ON crm_contact_notes(created_by);

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_crm_contact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_crm_contact_updated_at
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_contact_updated_at();

-- Update contact notes updated_at
CREATE OR REPLACE FUNCTION update_crm_contact_note_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_crm_contact_note_updated_at
  BEFORE UPDATE ON crm_contact_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_contact_note_updated_at();

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_notes ENABLE ROW LEVEL SECURITY;

-- Admins can view all contacts
CREATE POLICY "Admins can view all contacts" ON crm_contacts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Admins can insert contacts
CREATE POLICY "Admins can insert contacts" ON crm_contacts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Admins can update contacts
CREATE POLICY "Admins can update contacts" ON crm_contacts FOR UPDATE
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

-- Admins can delete contacts
CREATE POLICY "Admins can delete contacts" ON crm_contacts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Tags policies
CREATE POLICY "Admins can manage tags" ON crm_contact_tags FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Tag assignments policies
CREATE POLICY "Admins can manage tag assignments" ON crm_contact_tag_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Custom field definitions policies
CREATE POLICY "Admins can manage custom field definitions" ON crm_contact_custom_field_definitions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

-- Contact notes policies
CREATE POLICY "Admins can view all notes" ON crm_contact_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
  OR (is_private = FALSE) -- Public notes visible to all admins
);

CREATE POLICY "Admins can insert notes" ON crm_contact_notes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

CREATE POLICY "Admins can update own notes or public notes" ON crm_contact_notes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
  AND (created_by = auth.uid() OR is_private = FALSE)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
);

CREATE POLICY "Admins can delete own notes or public notes" ON crm_contact_notes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE admins.user_id = auth.uid() 
      AND admins.status = 'active'
  )
  AND (created_by = auth.uid() OR is_private = FALSE)
);

-- =====================================================
-- 7. RPC FUNCTIONS
-- =====================================================

-- Get all contacts with filters
CREATE OR REPLACE FUNCTION get_all_contacts(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_contact_type TEXT DEFAULT NULL,
  p_assigned_to UUID DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  contact_type VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  full_name VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  company_name VARCHAR,
  status VARCHAR,
  source VARCHAR,
  assigned_to UUID,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_contacts AS (
    SELECT 
      c.*,
      COUNT(*) OVER() as total_count
    FROM crm_contacts c
    WHERE 
      (p_search IS NULL OR 
        c.full_name ILIKE '%' || p_search || '%' OR
        c.email ILIKE '%' || p_search || '%' OR
        c.phone ILIKE '%' || p_search || '%' OR
        c.company_name ILIKE '%' || p_search || '%')
      AND (p_status IS NULL OR c.status = p_status)
      AND (p_contact_type IS NULL OR c.contact_type = p_contact_type)
      AND (p_assigned_to IS NULL OR c.assigned_to = p_assigned_to)
      AND (p_tags IS NULL OR c.tags && p_tags) -- Overlap operator for array intersection
      AND (p_source IS NULL OR c.source = p_source)
      AND c.status != 'duplicate' -- Exclude duplicates by default
    ORDER BY c.updated_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    fc.id,
    fc.user_id,
    fc.contact_type::VARCHAR,
    fc.first_name,
    fc.last_name,
    fc.full_name,
    fc.email,
    fc.phone,
    fc.company_name,
    fc.status::VARCHAR,
    fc.source,
    fc.assigned_to,
    fc.tags,
    fc.created_at,
    fc.updated_at,
    fc.total_count
  FROM filtered_contacts fc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get contact details with all related data
CREATE OR REPLACE FUNCTION get_contact_details(p_contact_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_contact JSONB;
  v_tags JSONB;
  v_notes JSONB;
  v_result JSONB;
BEGIN
  -- Get contact
  SELECT to_jsonb(c.*) INTO v_contact
  FROM crm_contacts c
  WHERE c.id = p_contact_id;
  
  IF v_contact IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get tags
  SELECT COALESCE(jsonb_agg(t.*), '[]'::jsonb) INTO v_tags
  FROM crm_contact_tags t
  INNER JOIN crm_contact_tag_assignments ta ON t.id = ta.tag_id
  WHERE ta.contact_id = p_contact_id;
  
  -- Get notes (most recent first)
  SELECT COALESCE(jsonb_agg(n.* ORDER BY n.created_at DESC), '[]'::jsonb) INTO v_notes
  FROM crm_contact_notes n
  WHERE n.contact_id = p_contact_id
    AND (n.is_private = FALSE OR n.created_by = auth.uid());
  
  -- Combine results
  v_result := jsonb_build_object(
    'contact', v_contact,
    'tags', v_tags,
    'notes', v_notes
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create contact
CREATE OR REPLACE FUNCTION create_contact(
  p_first_name VARCHAR DEFAULT NULL,
  p_last_name VARCHAR DEFAULT NULL,
  p_email VARCHAR DEFAULT NULL,
  p_phone VARCHAR DEFAULT NULL,
  p_company_name VARCHAR DEFAULT NULL,
  p_contact_type VARCHAR DEFAULT 'prospect',
  p_source VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_custom_fields JSONB DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_contact_id UUID;
  v_admin_id UUID;
BEGIN
  -- Get current admin user ID
  SELECT user_id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can create contacts';
  END IF;
  
  -- Insert contact
  INSERT INTO crm_contacts (
    first_name,
    last_name,
    email,
    phone,
    company_name,
    contact_type,
    source,
    notes,
    custom_fields,
    tags,
    created_by,
    updated_by
  ) VALUES (
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_company_name,
    p_contact_type,
    p_source,
    p_notes,
    COALESCE(p_custom_fields, '{}'::jsonb),
    COALESCE(p_tags, '{}'),
    v_admin_id,
    v_admin_id
  )
  RETURNING id INTO v_contact_id;
  
  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update contact
CREATE OR REPLACE FUNCTION update_contact(
  p_contact_id UUID,
  p_first_name VARCHAR DEFAULT NULL,
  p_last_name VARCHAR DEFAULT NULL,
  p_email VARCHAR DEFAULT NULL,
  p_phone VARCHAR DEFAULT NULL,
  p_company_name VARCHAR DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL,
  p_contact_type VARCHAR DEFAULT NULL,
  p_assigned_to UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_custom_fields JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Get current admin user ID
  SELECT user_id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can update contacts';
  END IF;
  
  -- Update contact (only non-null values)
  UPDATE crm_contacts
  SET
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    email = COALESCE(p_email, email),
    phone = COALESCE(p_phone, phone),
    company_name = COALESCE(p_company_name, company_name),
    status = COALESCE(p_status, status),
    contact_type = COALESCE(p_contact_type, contact_type),
    assigned_to = COALESCE(p_assigned_to, assigned_to),
    notes = COALESCE(p_notes, notes),
    custom_fields = COALESCE(p_custom_fields, custom_fields),
    updated_by = v_admin_id
  WHERE id = p_contact_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Archive contact
CREATE OR REPLACE FUNCTION archive_contact(p_contact_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Get current admin user ID
  SELECT user_id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can archive contacts';
  END IF;
  
  UPDATE crm_contacts
  SET
    status = 'archived',
    archived_at = NOW(),
    updated_by = v_admin_id
  WHERE id = p_contact_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add note to contact
CREATE OR REPLACE FUNCTION add_contact_note(
  p_contact_id UUID,
  p_note_type VARCHAR DEFAULT 'general',
  p_title VARCHAR DEFAULT NULL,
  p_content TEXT,
  p_is_pinned BOOLEAN DEFAULT FALSE,
  p_is_private BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
  v_note_id UUID;
  v_admin_id UUID;
BEGIN
  -- Get current admin user ID
  SELECT user_id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can add notes';
  END IF;
  
  INSERT INTO crm_contact_notes (
    contact_id,
    note_type,
    title,
    content,
    is_pinned,
    is_private,
    created_by
  ) VALUES (
    p_contact_id,
    p_note_type,
    p_title,
    p_content,
    p_is_pinned,
    p_is_private,
    v_admin_id
  )
  RETURNING id INTO v_note_id;
  
  RETURN v_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_all_contacts TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_details TO authenticated;
GRANT EXECUTE ON FUNCTION create_contact TO authenticated;
GRANT EXECUTE ON FUNCTION update_contact TO authenticated;
GRANT EXECUTE ON FUNCTION archive_contact TO authenticated;
GRANT EXECUTE ON FUNCTION add_contact_note TO authenticated;

-- =====================================================
-- 8. INSERT DEFAULT TAGS
-- =====================================================

INSERT INTO crm_contact_tags (name, color, category, is_system, description) VALUES
  ('VIP', '#ef4444', 'Priority', true, 'Very Important Person'),
  ('Hot Lead', '#f59e0b', 'Priority', true, 'High-value potential customer'),
  ('Follow Up', '#3b82f6', 'Action', true, 'Requires follow-up'),
  ('Qualified', '#10b981', 'Status', true, 'Qualified lead'),
  ('Not Interested', '#6b7280', 'Status', true, 'Not interested in services'),
  ('Do Not Contact', '#dc2626', 'Status', true, 'Do not contact this person')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE crm_contacts IS 'CRM Contact Management - Unified contact database';
COMMENT ON TABLE crm_contact_tags IS 'Tags for categorizing contacts';
COMMENT ON TABLE crm_contact_notes IS 'Notes and interactions for contacts';

