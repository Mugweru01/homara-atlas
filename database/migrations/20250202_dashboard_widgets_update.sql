-- Update Dashboard Widgets and Default Layout
-- Add new widgets: charts, activity_feed
-- Created: February 2, 2025

-- Add new widgets to dashboard_widgets table
INSERT INTO dashboard_widgets (widget_key, widget_name, widget_description, widget_category, default_size, default_position, min_role) VALUES
  ('charts', 'Charts & Analytics', 'User growth, revenue trends, and property analytics', 'charts', 'large', 6, 'admin'),
  ('activity_feed', 'Activity Feed', 'Recent platform activities and events', 'lists', 'large', 7, 'admin')
ON CONFLICT (widget_key) DO NOTHING;

-- Update default dashboard layout to include new widgets
CREATE OR REPLACE FUNCTION get_default_dashboard_layout()
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_array(
    jsonb_build_object('id', 'user_stats', 'position', 0, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'verification_stats', 'position', 1, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'listing_stats', 'position', 2, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'pending_verifications', 'position', 3, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'active_properties', 'position', 4, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'total_revenue', 'position', 5, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'active_bookings', 'position', 6, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'open_disputes', 'position', 7, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'active_auctions', 'position', 8, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'queue_status', 'position', 9, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'system_health', 'position', 10, 'visible', true, 'size', 'medium'),
    jsonb_build_object('id', 'charts', 'position', 11, 'visible', true, 'size', 'large'),
    jsonb_build_object('id', 'activity_feed', 'position', 12, 'visible', true, 'size', 'large'),
    jsonb_build_object('id', 'quick_actions', 'position', 13, 'visible', true, 'size', 'large')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

