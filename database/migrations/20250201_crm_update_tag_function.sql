-- CRM Update Tag Function
-- Created: February 1, 2025
-- Adds update functionality for tags

-- Update tag
CREATE OR REPLACE FUNCTION update_tag(
  p_tag_id UUID,
  p_name VARCHAR DEFAULT NULL,
  p_color VARCHAR DEFAULT NULL,
  p_category VARCHAR DEFAULT NULL,
  p_description TEXT DEFAULT NULL
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
    RAISE EXCEPTION 'Only admins can update tags';
  END IF;

  -- Check if tag exists and is not a system tag
  IF EXISTS (
    SELECT 1 FROM crm_contact_tags 
    WHERE id = p_tag_id AND is_system = TRUE
  ) THEN
    RAISE EXCEPTION 'System tags cannot be updated';
  END IF;

  -- Update tag with provided values
  UPDATE crm_contact_tags
  SET 
    name = COALESCE(p_name, name),
    color = COALESCE(p_color, color),
    category = COALESCE(p_category, category),
    description = COALESCE(p_description, description),
    updated_at = NOW()
  WHERE id = p_tag_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_tag TO authenticated;

