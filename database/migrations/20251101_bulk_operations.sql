-- Bulk Operations System
-- Week 2, Days 6-7
-- Created: November 1, 2025

-- =====================================================
-- 1. BULK VERIFICATION OPERATIONS
-- =====================================================

CREATE OR REPLACE FUNCTION bulk_update_verifications(
  p_verification_ids UUID[],
  p_status verification_status,
  p_rejection_reason TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
  v_updated_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_results JSONB := '[]'::jsonb;
  v_verification_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin not found'
    );
  END IF;
  
  -- Process each verification
  FOREACH v_verification_id IN ARRAY p_verification_ids
  LOOP
    BEGIN
      UPDATE landlord_verifications
      SET 
        status = p_status,
        reviewed_by = v_admin_id,
        reviewed_at = NOW(),
        rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        updated_at = NOW()
      WHERE id = v_verification_id
        AND status IN ('pending', 'in_review');
      
      IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        v_results := v_results || jsonb_build_object(
          'id', v_verification_id,
          'success', true
        );
      ELSE
        v_failed_count := v_failed_count + 1;
        v_results := v_results || jsonb_build_object(
          'id', v_verification_id,
          'success', false,
          'error', 'Not found or already processed'
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      v_results := v_results || jsonb_build_object(
        'id', v_verification_id,
        'success', false,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'updated', v_updated_count,
    'failed', v_failed_count,
    'total', array_length(p_verification_ids, 1),
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. BULK USER OPERATIONS
-- =====================================================

CREATE OR REPLACE FUNCTION bulk_update_user_status(
  p_user_ids UUID[],
  p_action TEXT, -- 'suspend', 'activate', 'delete'
  p_reason TEXT DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
  v_updated_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_results JSONB := '[]'::jsonb;
  v_user_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  -- Validate action
  IF p_action NOT IN ('suspend', 'activate', 'delete') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid action');
  END IF;
  
  -- Process each user
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    BEGIN
      IF p_action = 'suspend' THEN
        UPDATE profiles
        SET 
          is_suspended = true,
          suspension_reason = p_reason,
          updated_at = NOW()
        WHERE id = v_user_id;
        
      ELSIF p_action = 'activate' THEN
        UPDATE profiles
        SET 
          is_suspended = false,
          suspension_reason = NULL,
          updated_at = NOW()
        WHERE id = v_user_id;
        
      ELSIF p_action = 'delete' THEN
        -- Soft delete - mark as deleted but keep data
        UPDATE profiles
        SET 
          is_deleted = true,
          deleted_at = NOW(),
          deleted_by = v_admin_id,
          updated_at = NOW()
        WHERE id = v_user_id;
      END IF;
      
      IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        v_results := v_results || jsonb_build_object('id', v_user_id, 'success', true);
      ELSE
        v_failed_count := v_failed_count + 1;
        v_results := v_results || jsonb_build_object('id', v_user_id, 'success', false, 'error', 'User not found');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      v_results := v_results || jsonb_build_object('id', v_user_id, 'success', false, 'error', SQLERRM);
    END;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'updated', v_updated_count,
    'failed', v_failed_count,
    'total', array_length(p_user_ids, 1),
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. BULK PROPERTY/LISTING OPERATIONS
-- =====================================================

CREATE OR REPLACE FUNCTION bulk_update_property_status(
  p_property_ids UUID[],
  p_status TEXT, -- 'active', 'inactive', 'pending', 'rejected'
  p_reason TEXT DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
  v_updated_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_results JSONB := '[]'::jsonb;
  v_property_id UUID;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  -- Process each property
  FOREACH v_property_id IN ARRAY p_property_ids
  LOOP
    BEGIN
      UPDATE properties
      SET 
        status = p_status,
        updated_at = NOW()
      WHERE id = v_property_id;
      
      IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        v_results := v_results || jsonb_build_object('id', v_property_id, 'success', true);
      ELSE
        v_failed_count := v_failed_count + 1;
        v_results := v_results || jsonb_build_object('id', v_property_id, 'success', false, 'error', 'Property not found');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      v_results := v_results || jsonb_build_object('id', v_property_id, 'success', false, 'error', SQLERRM);
    END;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'updated', v_updated_count,
    'failed', v_failed_count,
    'total', array_length(p_property_ids, 1),
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. BULK FLAG RESOLUTION
-- =====================================================

CREATE OR REPLACE FUNCTION bulk_resolve_flags(
  p_flag_ids UUID[],
  p_action TEXT, -- 'resolve', 'dismiss', 'escalate'
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_admin_id UUID;
  v_updated_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_results JSONB := '[]'::jsonb;
  v_flag_id UUID;
  v_new_status TEXT;
BEGIN
  v_admin_id := get_admin_id();
  
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin not found');
  END IF;
  
  -- Determine new status based on action
  v_new_status := CASE 
    WHEN p_action = 'resolve' THEN 'resolved'
    WHEN p_action = 'dismiss' THEN 'dismissed'
    WHEN p_action = 'escalate' THEN 'escalated'
    ELSE 'pending'
  END;
  
  -- Process each flag
  FOREACH v_flag_id IN ARRAY p_flag_ids
  LOOP
    BEGIN
      UPDATE property_flags
      SET 
        status = v_new_status,
        resolved_by = v_admin_id,
        resolved_at = NOW(),
        resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
        updated_at = NOW()
      WHERE id = v_flag_id
        AND status = 'pending';
      
      IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        v_results := v_results || jsonb_build_object('id', v_flag_id, 'success', true);
      ELSE
        v_failed_count := v_failed_count + 1;
        v_results := v_results || jsonb_build_object('id', v_flag_id, 'success', false, 'error', 'Flag not found or already resolved');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      v_results := v_results || jsonb_build_object('id', v_flag_id, 'success', false, 'error', SQLERRM);
    END;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'updated', v_updated_count,
    'failed', v_failed_count,
    'total', array_length(p_flag_ids, 1),
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- These functions are SECURITY DEFINER, so they run with the permissions of the function owner
-- The get_admin_id() check ensures only authenticated admins can use them
-- No additional grants needed as RLS is enforced within the functions

