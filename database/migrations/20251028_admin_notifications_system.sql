-- Admin Notifications System
-- This migration creates a comprehensive notification system for admins

-- Create admin_notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  link VARCHAR(500),
  read BOOLEAN DEFAULT FALSE,
  priority VARCHAR(20) DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_admin_notifications_admin_id ON admin_notifications(admin_id);
CREATE INDEX idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
CREATE INDEX idx_admin_notifications_type ON admin_notifications(type);
CREATE INDEX idx_admin_notifications_resource ON admin_notifications(resource_type, resource_id);

-- Create composite index for common queries
CREATE INDEX idx_admin_notifications_unread_by_admin 
ON admin_notifications(admin_id, read, created_at DESC);

-- Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can only see their own notifications
CREATE POLICY "Admins can view own notifications"
ON admin_notifications FOR SELECT
USING (admin_id = auth.uid());

-- Policy: Allow admins to update their own notifications (mark as read)
CREATE POLICY "Admins can update own notifications"
ON admin_notifications FOR UPDATE
USING (admin_id = auth.uid());

-- Function to create notification for all admins or specific roles
CREATE OR REPLACE FUNCTION create_admin_notification(
  p_type VARCHAR,
  p_title VARCHAR,
  p_message TEXT,
  p_resource_type VARCHAR DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_link VARCHAR DEFAULT NULL,
  p_priority VARCHAR DEFAULT 'normal',
  p_admin_roles VARCHAR[] DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- If no specific roles provided, notify all admins
  IF p_admin_roles IS NULL THEN
    INSERT INTO admin_notifications (admin_id, type, title, message, resource_type, resource_id, link, priority)
    SELECT id, p_type, p_title, p_message, p_resource_type, p_resource_id, p_link, p_priority
    FROM admins
    WHERE status = 'active';
  ELSE
    -- Notify admins with specific roles
    INSERT INTO admin_notifications (admin_id, type, title, message, resource_type, resource_id, link, priority)
    SELECT id, p_type, p_title, p_message, p_resource_type, p_resource_id, p_link, p_priority
    FROM admins
    WHERE status = 'active' AND admin_role = ANY(p_admin_roles);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for new user registration
CREATE OR REPLACE FUNCTION notify_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_admin_notification(
    'new_user',
    'New User Registered',
    'A new user ' || COALESCE(NEW.full_name, NEW.email) || ' has registered.',
    'user',
    NEW.id,
    '/admin/users',
    'normal',
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new users
CREATE TRIGGER trigger_notify_new_user
AFTER INSERT ON profiles
FOR EACH ROW
WHEN (NEW.user_type = 'user')
EXECUTE FUNCTION notify_new_user();

-- Trigger function for new verification request
CREATE OR REPLACE FUNCTION notify_new_verification()
RETURNS TRIGGER AS $$
DECLARE
  landlord_name VARCHAR;
BEGIN
  -- Get landlord name
  SELECT full_name INTO landlord_name
  FROM profiles
  WHERE id = NEW.landlord_id;

  PERFORM create_admin_notification(
    'new_verification',
    'New Verification Request',
    'Landlord ' || COALESCE(landlord_name, 'Unknown') || ' submitted a verification request.',
    'verification',
    NEW.id,
    '/admin/verifications',
    'high',
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new verification requests
CREATE TRIGGER trigger_notify_new_verification
AFTER INSERT ON landlord_verifications
FOR EACH ROW
EXECUTE FUNCTION notify_new_verification();

-- Trigger function for verification status update
CREATE OR REPLACE FUNCTION notify_verification_update()
RETURNS TRIGGER AS $$
DECLARE
  landlord_name VARCHAR;
BEGIN
  -- Only notify if status changed to pending
  IF NEW.status = 'pending' AND OLD.status <> 'pending' THEN
    SELECT full_name INTO landlord_name
    FROM profiles
    WHERE id = NEW.landlord_id;

    PERFORM create_admin_notification(
      'verification_updated',
      'Verification Needs Review',
      'Verification request from ' || COALESCE(landlord_name, 'Unknown') || ' needs attention.',
      'verification',
      NEW.id,
      '/admin/verifications',
      'high',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for verification updates
CREATE TRIGGER trigger_notify_verification_update
AFTER UPDATE ON landlord_verifications
FOR EACH ROW
WHEN (NEW.status <> OLD.status)
EXECUTE FUNCTION notify_verification_update();

-- Trigger function for listings needing verification
CREATE OR REPLACE FUNCTION notify_listing_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify when listing is submitted and needs verification
  IF NEW.verification_status = 'pending' AND (OLD.verification_status IS NULL OR OLD.verification_status <> 'pending') THEN
    PERFORM create_admin_notification(
      'listing_verification',
      'Property Listing Needs Verification',
      'Property listing "' || NEW.title || '" requires verification.',
      'property',
      NEW.id,
      '/admin/listings',
      'normal',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new listings needing verification
CREATE TRIGGER trigger_notify_listing_verification
AFTER INSERT OR UPDATE ON properties
FOR EACH ROW
WHEN (NEW.verification_status = 'pending')
EXECUTE FUNCTION notify_listing_verification();

-- Trigger function for flagged content
CREATE OR REPLACE FUNCTION notify_flagged_content()
RETURNS TRIGGER AS $$
DECLARE
  resource_title VARCHAR;
BEGIN
  -- Get the title/name of the flagged resource
  IF NEW.flagged_entity_type = 'property' THEN
    SELECT title INTO resource_title
    FROM properties
    WHERE id = NEW.flagged_entity_id;
  ELSIF NEW.flagged_entity_type = 'user' THEN
    SELECT full_name INTO resource_title
    FROM profiles
    WHERE id = NEW.flagged_entity_id;
  END IF;

  PERFORM create_admin_notification(
    'flagged_content',
    'Content Flagged: ' || NEW.reason,
    COALESCE(resource_title, 'Unknown') || ' has been flagged for ' || NEW.reason || '.',
    NEW.flagged_entity_type,
    NEW.flagged_entity_id,
    '/admin/' || 
      CASE 
        WHEN NEW.flagged_entity_type = 'property' THEN 'listings'
        WHEN NEW.flagged_entity_type = 'user' THEN 'users'
        ELSE 'dashboard'
      END,
    'high',
    ARRAY['super_admin', 'senior_admin']::VARCHAR[]
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for flagged content
CREATE TRIGGER trigger_notify_flagged_content
AFTER INSERT ON content_flags
FOR EACH ROW
EXECUTE FUNCTION notify_flagged_content();

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE admin_notifications
  SET read = TRUE, read_at = NOW()
  WHERE id = notification_id AND admin_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for current admin
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
  UPDATE admin_notifications
  SET read = TRUE, read_at = NOW()
  WHERE admin_id = auth.uid() AND read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unread_count
  FROM admin_notifications
  WHERE admin_id = auth.uid() AND read = FALSE;
  
  RETURN unread_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete old notifications (older than 30 days and read)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_notifications
  WHERE read = TRUE 
    AND read_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up old notifications (if pg_cron is available)
-- This is optional and requires pg_cron extension
-- SELECT cron.schedule('cleanup-old-notifications', '0 2 * * *', 'SELECT cleanup_old_notifications()');

COMMENT ON TABLE admin_notifications IS 'Stores notifications for admin users';
COMMENT ON FUNCTION create_admin_notification IS 'Creates notifications for admins based on role';
COMMENT ON FUNCTION mark_notification_read IS 'Marks a specific notification as read';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Marks all notifications as read for the current admin';
COMMENT ON FUNCTION get_unread_notification_count IS 'Returns count of unread notifications for current admin';

