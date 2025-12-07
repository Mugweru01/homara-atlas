-- CRM Tags and Custom Fields Management Functions
-- Created: January 31, 2025
-- Additional RPC functions for tag and custom field management

-- =====================================================
-- TAG MANAGEMENT FUNCTIONS
-- =====================================================

-- Get all tags
CREATE OR REPLACE FUNCTION get_all_tags()
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  color VARCHAR,
  category VARCHAR,
  description TEXT,
  is_system BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.color,
    t.category,
    t.description,
    t.is_system,
    t.created_at
  FROM crm_contact_tags t
  ORDER BY t.category, t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create tag
CREATE OR REPLACE FUNCTION create_tag(
  p_name VARCHAR,
  p_color VARCHAR DEFAULT '#3b82f6',
  p_category VARCHAR DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_tag_id UUID;
  v_admin_id UUID;
BEGIN
  -- Get current admin user ID
  SELECT user_id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can create tags';
  END IF;
  
  INSERT INTO crm_contact_tags (name, color, category, description, created_by)
  VALUES (p_name, p_color, p_category, p_description, v_admin_id)
  RETURNING id INTO v_tag_id;
  
  RETURN v_tag_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign tag to contact
CREATE OR REPLACE FUNCTION assign_tag_to_contact(
  p_contact_id UUID,
  p_tag_id UUID
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
    RAISE EXCEPTION 'Only admins can assign tags';
  END IF;
  
  INSERT INTO crm_contact_tag_assignments (contact_id, tag_id, assigned_by)
  VALUES (p_contact_id, p_tag_id, v_admin_id)
  ON CONFLICT (contact_id, tag_id) DO NOTHING;
  
  -- Update contact tags array (denormalized for performance)
  UPDATE crm_contacts
  SET tags = (
    SELECT array_agg(t.name)
    FROM crm_contact_tags t
    INNER JOIN crm_contact_tag_assignments ta ON t.id = ta.tag_id
    WHERE ta.contact_id = p_contact_id
  )
  WHERE id = p_contact_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unassign tag from contact
CREATE OR REPLACE FUNCTION unassign_tag_from_contact(
  p_contact_id UUID,
  p_tag_id UUID
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
    RAISE EXCEPTION 'Only admins can unassign tags';
  END IF;
  
  DELETE FROM crm_contact_tag_assignments
  WHERE contact_id = p_contact_id AND tag_id = p_tag_id;
  
  -- Update contact tags array
  UPDATE crm_contacts
  SET tags = (
    SELECT COALESCE(array_agg(t.name), '{}')
    FROM crm_contact_tags t
    INNER JOIN crm_contact_tag_assignments ta ON t.id = ta.tag_id
    WHERE ta.contact_id = p_contact_id
  )
  WHERE id = p_contact_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CUSTOM FIELDS MANAGEMENT FUNCTIONS
-- =====================================================

-- Get all custom field definitions
CREATE OR REPLACE FUNCTION get_all_custom_field_definitions()
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  field_key VARCHAR,
  field_type VARCHAR,
  field_options JSONB,
  is_required BOOLEAN,
  default_value TEXT,
  placeholder TEXT,
  description TEXT,
  display_order INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.field_key,
    f.field_type,
    f.field_options,
    f.is_required,
    f.default_value,
    f.placeholder,
    f.description,
    f.display_order,
    f.is_active,
    f.created_at
  FROM crm_contact_custom_field_definitions f
  WHERE f.is_active = TRUE
  ORDER BY f.display_order, f.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create custom field definition
CREATE OR REPLACE FUNCTION create_custom_field_definition(
  p_name VARCHAR,
  p_field_key VARCHAR,
  p_field_type VARCHAR,
  p_field_options JSONB DEFAULT NULL,
  p_is_required BOOLEAN DEFAULT FALSE,
  p_default_value TEXT DEFAULT NULL,
  p_placeholder TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_display_order INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_field_id UUID;
  v_admin_id UUID;
BEGIN
  -- Get current admin user ID
  SELECT user_id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can create custom field definitions';
  END IF;
  
  INSERT INTO crm_contact_custom_field_definitions (
    name, field_key, field_type, field_options, is_required,
    default_value, placeholder, description, display_order, created_by
  )
  VALUES (
    p_name, p_field_key, p_field_type, p_field_options, p_is_required,
    p_default_value, p_placeholder, p_description, p_display_order, v_admin_id
  )
  RETURNING id INTO v_field_id;
  
  RETURN v_field_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update custom field value for contact
CREATE OR REPLACE FUNCTION update_contact_custom_field(
  p_contact_id UUID,
  p_field_key VARCHAR,
  p_value TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
  v_current_fields JSONB;
BEGIN
  -- Get current admin user ID
  SELECT user_id INTO v_admin_id
  FROM admins
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can update custom fields';
  END IF;
  
  -- Get current custom_fields
  SELECT custom_fields INTO v_current_fields
  FROM crm_contacts
  WHERE id = p_contact_id;
  
  -- Update the specific field
  v_current_fields := COALESCE(v_current_fields, '{}'::jsonb);
  v_current_fields := jsonb_set(v_current_fields, ARRAY[p_field_key], to_jsonb(p_value));
  
  -- Update contact
  UPDATE crm_contacts
  SET custom_fields = v_current_fields, updated_by = v_admin_id
  WHERE id = p_contact_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_all_tags TO authenticated;
GRANT EXECUTE ON FUNCTION create_tag TO authenticated;
GRANT EXECUTE ON FUNCTION assign_tag_to_contact TO authenticated;
GRANT EXECUTE ON FUNCTION unassign_tag_from_contact TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_custom_field_definitions TO authenticated;
GRANT EXECUTE ON FUNCTION create_custom_field_definition TO authenticated;
GRANT EXECUTE ON FUNCTION update_contact_custom_field TO authenticated;

