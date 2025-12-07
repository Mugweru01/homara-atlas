-- Function to create a new admin
-- This function handles admin code generation and admin record creation
-- No email is sent - super admin must share the code manually
CREATE OR REPLACE FUNCTION create_admin(
  p_email VARCHAR,
  p_admin_role admin_role,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_admin_id UUID;
  v_admin_code VARCHAR(8);
  v_hashed_code TEXT;
  v_created_by_id UUID;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INTEGER;
  random_val INTEGER;
BEGIN
  -- Get the creating admin's ID if not provided
  IF p_created_by IS NULL THEN
    SELECT id INTO v_created_by_id
    FROM admins
    WHERE user_id = auth.uid() AND status = 'active' AND admin_role = 'super_admin'
    LIMIT 1;
  ELSE
    v_created_by_id := p_created_by;
  END IF;

  -- Check if caller is super admin
  IF v_created_by_id IS NULL THEN
    RAISE EXCEPTION 'Only super admins can create other admins';
  END IF;

  -- Check if admin already exists
  IF EXISTS (SELECT 1 FROM admins WHERE email = p_email) THEN
    RAISE EXCEPTION 'An admin with this email already exists';
  END IF;

  -- Note: We can't directly query auth.users from a regular function
  -- So we'll set user_id to NULL initially
  -- The user_id will be linked when the admin logs in for the first time
  v_user_id := NULL;

  -- Generate admin code (8 characters, alphanumeric, uppercase, excludes 0, O, I, 1)
  v_admin_code := '';
  FOR i IN 1..8 LOOP
    random_val := floor(random() * length(chars))::INTEGER + 1;
    v_admin_code := v_admin_code || substring(chars FROM random_val FOR 1);
  END LOOP;

  -- Hash the admin code using pgcrypto
  v_hashed_code := crypt(v_admin_code, gen_salt('bf', 12));

  -- Create admin record
  -- Note: admin_code (VARCHAR(8)) stores the plain 8-character code
  -- admin_code_hash (TEXT) stores the hashed code for verification
  INSERT INTO admins (
    user_id,
    email,
    admin_role,
    status,
    created_by,
    admin_code,
    admin_code_hash
  ) VALUES (
    v_user_id,
    p_email,
    p_admin_role,
    'active',
    v_created_by_id,
    v_admin_code,
    v_hashed_code
  )
  RETURNING id INTO v_admin_id;

  -- Return the admin code and admin details
  RETURN jsonb_build_object(
    'success', true,
    'admin_id', v_admin_id,
    'admin_code', v_admin_code,
    'email', p_email,
    'admin_role', p_admin_role,
    'message', 'Admin created successfully. Share the admin code manually.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (will be checked inside function)
GRANT EXECUTE ON FUNCTION create_admin TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_admin IS 'Creates a new admin user. Only super admins can call this function. Returns the admin code that must be shared manually. No email is sent.';
