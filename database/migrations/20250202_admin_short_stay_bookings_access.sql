-- Admin Access to Short Stay Bookings
-- Allow admins to view all short stay bookings for oversight
-- Created: February 2, 2025

-- Helper function to check if user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Admin policy: Admins can view all short stay bookings
CREATE POLICY "Admins can view all bookings" ON short_stay_bookings FOR SELECT
USING (is_admin());

-- Admin policy: Admins can update all bookings (for oversight actions)
CREATE POLICY "Admins can update all bookings" ON short_stay_bookings FOR UPDATE
USING (is_admin());

-- Grant necessary permissions
GRANT SELECT, UPDATE ON short_stay_bookings TO authenticated;

