-- CRM Activity Auto-Capture Triggers
-- Created: February 1, 2025
-- Automatically creates CRM activities from existing system events

-- =====================================================
-- HELPER FUNCTION: Get or create contact from user_id
-- =====================================================

CREATE OR REPLACE FUNCTION get_or_create_contact_from_user(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  -- Try to find existing contact
  SELECT id INTO v_contact_id
  FROM crm_contacts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If not found, try to create one (this will need admin context)
  -- For now, just return NULL if not found - will be handled by sync trigger
  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: Create CRM activity automatically
-- =====================================================

CREATE OR REPLACE FUNCTION create_crm_activity_auto(
  p_user_id UUID,
  p_activity_type VARCHAR,
  p_subject VARCHAR DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_activity_data JSONB DEFAULT NULL,
  p_related_record_type VARCHAR DEFAULT NULL,
  p_related_record_id UUID DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_contact_id UUID;
  v_activity_id UUID;
BEGIN
  -- Get contact_id from user_id
  SELECT id INTO v_contact_id
  FROM crm_contacts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- Only create if contact exists
  IF v_contact_id IS NOT NULL THEN
    INSERT INTO crm_activities (
      contact_id,
      user_id,
      activity_type,
      subject,
      description,
      activity_data,
      related_record_type,
      related_record_id,
      duration_minutes,
      status,
      created_by
    ) VALUES (
      v_contact_id,
      p_user_id,
      p_activity_type,
      p_subject,
      p_description,
      COALESCE(p_activity_data, '{}'::jsonb),
      p_related_record_type,
      p_related_record_id,
      p_duration_minutes,
      'completed',
      NULL -- Auto-created, not by admin
    )
    RETURNING id INTO v_activity_id;
    
    RETURN v_activity_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 1. PROPERTY VIEWS AUTO-CAPTURE
-- =====================================================

CREATE OR REPLACE FUNCTION capture_property_view_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_property_title TEXT;
BEGIN
  -- Only capture if user_id exists (not anonymous views)
  IF NEW.user_id IS NOT NULL THEN
    -- Get property title for subject
    SELECT title INTO v_property_title
    FROM properties
    WHERE id = NEW.property_id
    LIMIT 1;
    
    -- Create activity
    PERFORM create_crm_activity_auto(
      NEW.user_id,
      'property_view',
      COALESCE('Viewed property: ' || v_property_title, 'Viewed property'),
      'User viewed property details',
      jsonb_build_object(
        'property_id', NEW.property_id,
        'view_duration', NEW.view_duration,
        'is_unique', NEW.is_unique,
        'ip_address', NEW.ip_address
      ),
      'property',
      NEW.property_id,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_capture_property_view_activity ON property_views;
CREATE TRIGGER trigger_capture_property_view_activity
  AFTER INSERT ON property_views
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION capture_property_view_activity();

-- =====================================================
-- 2. PROPERTY SAVES AUTO-CAPTURE
-- =====================================================

CREATE OR REPLACE FUNCTION capture_property_save_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_property_title TEXT;
BEGIN
  -- Get property title
  SELECT title INTO v_property_title
  FROM properties
  WHERE id = NEW.property_id
  LIMIT 1;
  
  -- Create activity
  PERFORM create_crm_activity_auto(
    NEW.user_id,
    'property_save',
    COALESCE('Saved property: ' || v_property_title, 'Saved property'),
    'User saved/favorited property',
    jsonb_build_object(
      'property_id', NEW.property_id
    ),
    'property',
    NEW.property_id,
    NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_capture_property_save_activity ON property_saves;
CREATE TRIGGER trigger_capture_property_save_activity
  AFTER INSERT ON property_saves
  FOR EACH ROW
  EXECUTE FUNCTION capture_property_save_activity();

-- =====================================================
-- 3. PROPERTY INQUIRIES AUTO-CAPTURE
-- =====================================================

CREATE OR REPLACE FUNCTION capture_property_inquiry_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_property_title TEXT;
  v_inquiry_subject TEXT;
BEGIN
  -- Only capture if user_id exists
  IF NEW.user_id IS NOT NULL THEN
    -- Get property title
    SELECT title INTO v_property_title
    FROM properties
    WHERE id = NEW.property_id
    LIMIT 1;
    
    -- Build subject
    v_inquiry_subject := COALESCE('Inquiry about: ' || v_property_title, 'Property inquiry');
    
    -- Create activity
    PERFORM create_crm_activity_auto(
      NEW.user_id,
      'property_inquiry',
      v_inquiry_subject,
      COALESCE(NEW.message, 'Property inquiry submitted'),
      jsonb_build_object(
        'property_id', NEW.property_id,
        'inquiry_type', NEW.inquiry_type,
        'message', NEW.message,
        'contact_info', NEW.contact_info
      ),
      'property',
      NEW.property_id,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_capture_property_inquiry_activity ON property_inquiries;
CREATE TRIGGER trigger_capture_property_inquiry_activity
  AFTER INSERT ON property_inquiries
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION capture_property_inquiry_activity();

-- =====================================================
-- 4. PROPERTY APPLICATIONS AUTO-CAPTURE
-- =====================================================

CREATE OR REPLACE FUNCTION capture_application_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_property_title TEXT;
  v_activity_type VARCHAR;
  v_subject TEXT;
  v_description TEXT;
BEGIN
  -- Determine activity type based on status
  IF TG_OP = 'INSERT' THEN
    v_activity_type := 'application_submitted';
    v_subject := 'Application submitted';
    v_description := 'Property application submitted';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_activity_type := 'application_status_changed';
    v_subject := 'Application status: ' || NEW.status;
    v_description := 'Application status changed from ' || COALESCE(OLD.status, 'pending') || ' to ' || NEW.status;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Get property title
  SELECT title INTO v_property_title
  FROM properties
  WHERE id = NEW.property_id
  LIMIT 1;
  
  -- Update subject with property title
  v_subject := v_subject || ': ' || COALESCE(v_property_title, 'Property');
  
  -- Create activity
  PERFORM create_crm_activity_auto(
    NEW.tenant_id,
    v_activity_type,
    v_subject,
    v_description,
    jsonb_build_object(
      'property_id', NEW.property_id,
      'application_id', NEW.id,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'application_date', NEW.created_at
    ),
    'application',
    NEW.id,
    NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if property_applications table exists before creating trigger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'property_applications'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_capture_application_activity_insert ON property_applications;
    DROP TRIGGER IF EXISTS trigger_capture_application_activity_update ON property_applications;
    
    CREATE TRIGGER trigger_capture_application_activity_insert
      AFTER INSERT ON property_applications
      FOR EACH ROW
      EXECUTE FUNCTION capture_application_activity();
    
    CREATE TRIGGER trigger_capture_application_activity_update
      AFTER UPDATE ON property_applications
      FOR EACH ROW
      WHEN (OLD.status IS DISTINCT FROM NEW.status)
      EXECUTE FUNCTION capture_application_activity();
  END IF;
END $$;

-- =====================================================
-- 5. VIEWING SCHEDULED AUTO-CAPTURE
-- =====================================================

CREATE OR REPLACE FUNCTION capture_viewing_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_property_title TEXT;
  v_activity_type VARCHAR;
  v_subject TEXT;
BEGIN
  -- Determine activity type
  IF TG_OP = 'INSERT' THEN
    v_activity_type := 'viewing_scheduled';
    v_subject := 'Viewing scheduled';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      v_activity_type := 'viewing_completed';
      v_subject := 'Viewing completed';
    ELSIF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
      v_activity_type := 'viewing_cancelled';
      v_subject := 'Viewing cancelled';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Get property title if property_id exists
  IF NEW.property_id IS NOT NULL THEN
    SELECT title INTO v_property_title
    FROM properties
    WHERE id = NEW.property_id
    LIMIT 1;
    
    v_subject := v_subject || ': ' || COALESCE(v_property_title, 'Property');
  END IF;
  
  -- Create activity (for tenant)
  IF NEW.tenant_id IS NOT NULL THEN
    PERFORM create_crm_activity_auto(
      NEW.tenant_id,
      v_activity_type,
      v_subject,
      COALESCE('Scheduled viewing at ' || NEW.viewing_time::text, 'Viewing scheduled'),
      jsonb_build_object(
        'property_id', NEW.property_id,
        'viewing_id', NEW.id,
        'viewing_time', NEW.viewing_time,
        'status', NEW.status
      ),
      'viewing',
      NEW.id,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if viewing_schedules table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'viewing_schedules'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_capture_viewing_activity_insert ON viewing_schedules;
    DROP TRIGGER IF EXISTS trigger_capture_viewing_activity_update ON viewing_schedules;
    
    CREATE TRIGGER trigger_capture_viewing_activity_insert
      AFTER INSERT ON viewing_schedules
      FOR EACH ROW
      EXECUTE FUNCTION capture_viewing_activity();
    
    CREATE TRIGGER trigger_capture_viewing_activity_update
      AFTER UPDATE ON viewing_schedules
      FOR EACH ROW
      WHEN (OLD.status IS DISTINCT FROM NEW.status)
      EXECUTE FUNCTION capture_viewing_activity();
  END IF;
END $$;

-- =====================================================
-- 6. NOTES AUTO-CAPTURE (from crm_contact_notes)
-- =====================================================

CREATE OR REPLACE FUNCTION capture_note_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm_activities (
      contact_id,
      user_id,
      activity_type,
      subject,
      description,
      activity_data,
      related_record_type,
      related_record_id,
      status,
      created_by
    )
    SELECT
      NEW.contact_id,
      c.user_id,
      'note_added',
      COALESCE(NEW.title, 'Note added'),
      NEW.content,
      jsonb_build_object(
        'note_type', NEW.note_type,
        'is_pinned', NEW.is_pinned,
        'is_private', NEW.is_private
      ),
      'note',
      NEW.id,
      'completed',
      NEW.created_by
    FROM crm_contacts c
    WHERE c.id = NEW.contact_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_capture_note_activity ON crm_contact_notes;
CREATE TRIGGER trigger_capture_note_activity
  AFTER INSERT ON crm_contact_notes
  FOR EACH ROW
  EXECUTE FUNCTION capture_note_activity();

-- =====================================================
-- 7. TAG ASSIGNMENTS AUTO-CAPTURE
-- =====================================================

CREATE OR REPLACE FUNCTION capture_tag_assignment_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_tag_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get tag name
    SELECT name INTO v_tag_name
    FROM crm_contact_tags
    WHERE id = NEW.tag_id
    LIMIT 1;
    
    -- Create activity
    INSERT INTO crm_activities (
      contact_id,
      user_id,
      activity_type,
      subject,
      description,
      activity_data,
      related_record_type,
      related_record_id,
      status
    )
    SELECT
      NEW.contact_id,
      c.user_id,
      'tag_assigned',
      'Tag assigned: ' || COALESCE(v_tag_name, 'Unknown'),
      'Tag assigned to contact',
      jsonb_build_object(
        'tag_id', NEW.tag_id,
        'tag_name', v_tag_name
      ),
      'tag',
      NEW.tag_id,
      'completed'
    FROM crm_contacts c
    WHERE c.id = NEW.contact_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_capture_tag_assignment_activity ON crm_contact_tag_assignments;
CREATE TRIGGER trigger_capture_tag_assignment_activity
  AFTER INSERT ON crm_contact_tag_assignments
  FOR EACH ROW
  EXECUTE FUNCTION capture_tag_assignment_activity();

-- =====================================================
-- 8. CONTACT CREATED/UPDATED AUTO-CAPTURE
-- =====================================================

CREATE OR REPLACE FUNCTION capture_contact_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_type VARCHAR;
  v_subject TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_activity_type := 'contact_created';
    v_subject := 'Contact created: ' || COALESCE(NEW.full_name, NEW.email, 'Unknown');
    
    -- Create activity
    INSERT INTO crm_activities (
      contact_id,
      user_id,
      activity_type,
      subject,
      description,
      activity_data,
      related_record_type,
      related_record_id,
      status,
      created_by
    ) VALUES (
      NEW.id,
      NEW.user_id,
      v_activity_type,
      v_subject,
      'New contact created in CRM',
      jsonb_build_object(
        'contact_type', NEW.contact_type,
        'source', NEW.source
      ),
      'contact',
      NEW.id,
      'completed',
      NEW.created_by
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only create activity if significant fields changed
    IF (
      OLD.first_name IS DISTINCT FROM NEW.first_name OR
      OLD.last_name IS DISTINCT FROM NEW.last_name OR
      OLD.email IS DISTINCT FROM NEW.email OR
      OLD.phone IS DISTINCT FROM NEW.phone OR
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.contact_type IS DISTINCT FROM NEW.contact_type
    ) THEN
      v_activity_type := 'contact_updated';
      v_subject := 'Contact updated: ' || COALESCE(NEW.full_name, NEW.email, 'Unknown');
      
      INSERT INTO crm_activities (
        contact_id,
        user_id,
        activity_type,
        subject,
        description,
        activity_data,
        related_record_type,
        related_record_id,
        status,
        created_by
      ) VALUES (
        NEW.id,
        NEW.user_id,
        v_activity_type,
        v_subject,
        'Contact information updated',
        jsonb_build_object(
          'changes', jsonb_build_object(
            'first_name', jsonb_build_object('old', OLD.first_name, 'new', NEW.first_name),
            'last_name', jsonb_build_object('old', OLD.last_name, 'new', NEW.last_name),
            'email', jsonb_build_object('old', OLD.email, 'new', NEW.email),
            'phone', jsonb_build_object('old', OLD.phone, 'new', NEW.phone),
            'status', jsonb_build_object('old', OLD.status, 'new', NEW.status),
            'contact_type', jsonb_build_object('old', OLD.contact_type, 'new', NEW.contact_type)
          )
        ),
        'contact',
        NEW.id,
        'completed',
        NEW.updated_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_capture_contact_activity ON crm_contacts;
CREATE TRIGGER trigger_capture_contact_activity
  AFTER INSERT OR UPDATE ON crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION capture_contact_activity();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_crm_activity_auto TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_contact_from_user TO authenticated;

COMMENT ON FUNCTION create_crm_activity_auto IS 'Automatically creates CRM activities from system events';

