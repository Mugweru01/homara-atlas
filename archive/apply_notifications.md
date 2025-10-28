# Apply Notifications Migration

This migration creates the admin notifications system.

## Steps to Apply

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `20251028_admin_notifications_system.sql`
4. Click "Run"

### Option 2: Using Supabase CLI
```bash
supabase db push
```

### Option 3: Direct SQL
If you have psql or another PostgreSQL client:
```bash
psql -h YOUR_DB_HOST -U postgres -d postgres -f 20251028_admin_notifications_system.sql
```

## What This Migration Creates

1. **admin_notifications table** - Stores all admin notifications
2. **Database triggers** for:
   - New user registrations
   - New verification requests
   - Verification status updates
   - Listings needing verification
   - Flagged content
3. **Helper functions**:
   - `create_admin_notification()` - Create notifications for admins
   - `mark_notification_read()` - Mark single notification as read
   - `mark_all_notifications_read()` - Mark all as read
   - `get_unread_notification_count()` - Get unread count
   - `cleanup_old_notifications()` - Clean up old notifications

## Verification

After running the migration, verify it worked:

```sql
-- Check if table exists
SELECT * FROM admin_notifications LIMIT 1;

-- Check if functions exist
SELECT proname FROM pg_proc WHERE proname LIKE '%notification%';

-- Check if triggers exist
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%notify%';
```

## Testing

To test notifications:

1. Create a new user (should trigger notification)
2. Submit a verification request (should trigger notification)
3. Flag content (should trigger notification)

Check the notifications table:
```sql
SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 10;
```

