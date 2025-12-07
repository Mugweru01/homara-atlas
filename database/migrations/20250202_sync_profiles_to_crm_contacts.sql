-- Sync Profiles to CRM Contacts
-- Automatically create CRM contacts for all users with profiles
-- Created: February 2, 2025

-- =====================================================
-- 1. FUNCTION TO SYNC PROFILE TO CRM CONTACT
-- =====================================================

CREATE OR REPLACE FUNCTION sync_profile_to_crm_contact(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_profile RECORD;
  v_contact_id UUID;
  v_existing_contact_id UUID;
BEGIN
  -- Get profile data
  SELECT 
    id,
    full_name,
    email,
    phone_e164,
    created_at
  INTO v_profile
  FROM profiles
  WHERE id = p_user_id;

  -- If profile doesn't exist, return NULL
  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if contact already exists for this user
  SELECT id INTO v_existing_contact_id
  FROM crm_contacts
  WHERE user_id = p_user_id
  LIMIT 1;

  -- If contact exists, return existing ID
  IF v_existing_contact_id IS NOT NULL THEN
    RETURN v_existing_contact_id;
  END IF;

  -- Parse full_name into first_name and last_name
  DECLARE
    v_first_name VARCHAR(100);
    v_last_name VARCHAR(100);
    v_name_parts TEXT[];
  BEGIN
    IF v_profile.full_name IS NOT NULL THEN
      v_name_parts := string_to_array(trim(v_profile.full_name), ' ');
      IF array_length(v_name_parts, 1) > 0 THEN
        v_first_name := v_name_parts[1];
        IF array_length(v_name_parts, 1) > 1 THEN
          v_last_name := array_to_string(v_name_parts[2:], ' ');
        END IF;
      END IF;
    END IF;
  END;

  -- Create CRM contact
  INSERT INTO crm_contacts (
    user_id,
    contact_type,
    first_name,
    last_name,
    email,
    phone_e164,
    status,
    source,
    source_details,
    created_at
  ) VALUES (
    p_user_id,
    'user', -- All profiles are marked as 'user' type
    v_first_name,
    v_last_name,
    v_profile.email,
    v_profile.phone_e164,
    'active',
    'platform_registration',
    jsonb_build_object(
      'synced_from', 'profiles',
      'synced_at', NOW(),
      'original_created_at', v_profile.created_at
    ),
    COALESCE(v_profile.created_at, NOW())
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_contact_id;

  -- If no conflict, return new contact ID
  IF v_contact_id IS NOT NULL THEN
    RETURN v_contact_id;
  END IF;

  -- If conflict occurred, get existing contact ID
  SELECT id INTO v_contact_id
  FROM crm_contacts
  WHERE user_id = p_user_id
  LIMIT 1;

  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. FUNCTION TO SYNC ALL EXISTING PROFILES
-- =====================================================

CREATE OR REPLACE FUNCTION sync_all_profiles_to_contacts()
RETURNS TABLE (
  profiles_processed INTEGER,
  contacts_created INTEGER,
  contacts_updated INTEGER
) AS $$
DECLARE
  v_profile RECORD;
  v_contact_id UUID;
  v_created_count INTEGER := 0;
  v_updated_count INTEGER := 0;
  v_total_count INTEGER := 0;
BEGIN
  -- Loop through all profiles
  FOR v_profile IN
    SELECT 
      id,
      full_name,
      email,
      phone_e164,
      created_at
    FROM profiles
    ORDER BY created_at
  LOOP
    v_total_count := v_total_count + 1;

    -- Check if contact exists
    SELECT id INTO v_contact_id
    FROM crm_contacts
    WHERE user_id = v_profile.id
    LIMIT 1;

    IF v_contact_id IS NULL THEN
      -- Create new contact
      v_contact_id := sync_profile_to_crm_contact(v_profile.id);
      IF v_contact_id IS NOT NULL THEN
        v_created_count := v_created_count + 1;
      END IF;
    ELSE
      -- Update existing contact with latest profile data
      DECLARE
        v_first_name VARCHAR(100);
        v_last_name VARCHAR(100);
        v_name_parts TEXT[];
      BEGIN
        IF v_profile.full_name IS NOT NULL THEN
          v_name_parts := string_to_array(trim(v_profile.full_name), ' ');
          IF array_length(v_name_parts, 1) > 0 THEN
            v_first_name := v_name_parts[1];
            IF array_length(v_name_parts, 1) > 1 THEN
              v_last_name := array_to_string(v_name_parts[2:], ' ');
            END IF;
          END IF;
        END IF;
      END;

      UPDATE crm_contacts
      SET
        first_name = COALESCE(v_first_name, first_name),
        last_name = COALESCE(v_last_name, last_name),
        email = COALESCE(v_profile.email, email),
        phone_e164 = COALESCE(v_profile.phone_e164, phone_e164),
        updated_at = NOW()
      WHERE id = v_contact_id;

      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_total_count, v_created_count, v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. TRIGGER TO AUTO-SYNC NEW PROFILES
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_sync_profile_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if this is a new profile (INSERT)
  IF TG_OP = 'INSERT' THEN
    PERFORM sync_profile_to_crm_contact(NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update existing contact if profile data changed
    UPDATE crm_contacts
    SET
      email = COALESCE(NEW.email, email),
      phone_e164 = COALESCE(NEW.phone_e164, phone_e164),
      updated_at = NOW()
    WHERE user_id = NEW.id;

    -- If name changed, update first_name and last_name
    IF OLD.full_name IS DISTINCT FROM NEW.full_name AND NEW.full_name IS NOT NULL THEN
      DECLARE
        v_first_name VARCHAR(100);
        v_last_name VARCHAR(100);
        v_name_parts TEXT[];
      BEGIN
        v_name_parts := string_to_array(trim(NEW.full_name), ' ');
        IF array_length(v_name_parts, 1) > 0 THEN
          v_first_name := v_name_parts[1];
          IF array_length(v_name_parts, 1) > 1 THEN
            v_last_name := array_to_string(v_name_parts[2:], ' ');
          END IF;
        END IF;

        UPDATE crm_contacts
        SET
          first_name = COALESCE(v_first_name, first_name),
          last_name = COALESCE(v_last_name, last_name),
          updated_at = NOW()
        WHERE user_id = NEW.id;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_sync_profile_to_contact ON profiles;
CREATE TRIGGER trigger_sync_profile_to_contact
  AFTER INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_profile_to_contact();

-- =====================================================
-- 4. ADD UNIQUE CONSTRAINT ON USER_ID (if not exists)
-- =====================================================

-- Add unique constraint to prevent duplicate contacts for same user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'crm_contacts_user_id_unique'
  ) THEN
    ALTER TABLE crm_contacts
    ADD CONSTRAINT crm_contacts_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- =====================================================
-- 5. INITIAL SYNC OF ALL EXISTING PROFILES
-- =====================================================

-- Run initial sync (commented out - run manually if needed)
-- SELECT * FROM sync_all_profiles_to_contacts();

COMMENT ON FUNCTION sync_profile_to_crm_contact IS 'Syncs a single profile to CRM contact';
COMMENT ON FUNCTION sync_all_profiles_to_contacts IS 'Syncs all existing profiles to CRM contacts';
COMMENT ON FUNCTION trigger_sync_profile_to_contact IS 'Auto-syncs profiles to CRM contacts on insert/update';

