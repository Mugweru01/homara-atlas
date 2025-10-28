# Foreign Key Constraint Fix

## Problem
**Error Message:**
```
insert or update on table "admin_security_preferences" violates foreign key constraint "admin_security_preferences_admin_id_fkey"
```

## Root Cause

The `admins` table has **two different ID columns**:
- `id` - The admin record ID (primary key)
- `user_id` - The Supabase auth user ID (references `auth.users`)

**The Issue:**
- Security functions were using `auth.uid()` directly
- `auth.uid()` returns the Supabase auth user ID
- The foreign key `admin_security_preferences.admin_id` references `admins.id` (not `admins.user_id`)
- This caused a foreign key mismatch

## Solution

### 1. Created Helper Function `get_admin_id()`
```sql
CREATE OR REPLACE FUNCTION get_admin_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id 
    FROM admins 
    WHERE user_id = auth.uid() 
      AND status = 'active' 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

This function:
- Takes `auth.uid()` (the Supabase auth user ID)
- Looks up the corresponding `admins.id`
- Ensures the admin is active
- Returns the correct admin ID to use for foreign keys

### 2. Updated All Security Functions

**Functions Updated:**
- ✅ `get_admin_security_preferences()` - Uses `get_admin_id()`
- ✅ `update_admin_security_preferences()` - Uses `get_admin_id()`
- ✅ `add_ip_to_whitelist()` - Uses `get_admin_id()`
- ✅ `remove_ip_from_whitelist()` - Uses `get_admin_id()`
- ✅ `get_ip_whitelist()` - Uses `get_admin_id()`
- ✅ `get_trusted_devices()` - Uses `get_admin_id()`
- ✅ `revoke_trusted_device()` - Uses `get_admin_id()`

**Before:**
```sql
INSERT INTO admin_security_preferences (admin_id, ...)
VALUES (auth.uid(), ...); -- WRONG! This is user_id, not admin.id
```

**After:**
```sql
v_admin_id := get_admin_id(); -- Gets the correct admin.id
INSERT INTO admin_security_preferences (admin_id, ...)
VALUES (v_admin_id, ...); -- CORRECT!
```

### 3. Updated RLS Policies

All Row Level Security policies now use `get_admin_id()`:

```sql
CREATE POLICY "Admins can manage own security prefs" 
ON admin_security_preferences FOR ALL
USING (admin_id = get_admin_id());
```

This ensures:
- Admins can only access their own data
- Correct admin ID is used for comparisons
- Policies work with the updated functions

## Benefits

1. **Correct Foreign Key Relationships** - All references to `admins.id` are now correct
2. **Better Error Handling** - Returns "Admin not found" if user isn't an active admin
3. **Security** - Only active admins can access security settings
4. **Consistency** - All security functions use the same ID lookup pattern

## Testing

The fix is now live. Test by:

1. **Navigate to `/admin/security`**
2. **Toggle any preference** - Should work without foreign key errors
3. **Add an IP address** - Should save successfully
4. **Refresh page** - All settings should persist

## Technical Details

### Database Schema
```
admins table:
  - id (UUID, primary key) ← This is what foreign keys reference
  - user_id (UUID) ← This is what auth.uid() returns
  - admin_role (enum)
  - status (enum)

admin_security_preferences table:
  - admin_id (UUID) → REFERENCES admins(id)
  
admin_ip_whitelist table:
  - admin_id (UUID) → REFERENCES admins(id)
  
admin_trusted_devices table:
  - admin_id (UUID) → REFERENCES admins(id)
```

### ID Relationship Flow
```
1. User logs in → Gets Supabase auth session
2. auth.uid() → Returns user_id from auth.users table
3. get_admin_id() → Looks up admins table:
   - WHERE user_id = auth.uid()
   - Returns admins.id
4. Functions use admins.id → Matches foreign key constraints ✓
```

## Files Modified

- Database functions (all updated via `execute_sql`)
- RLS policies updated
- No frontend changes needed (functions return same structure)

## Rollback (If Needed)

If issues occur, functions can be reverted by recreating them without `get_admin_id()`, but the foreign key error would return.

---

**Status:** ✅ Fixed and Deployed
**Date:** October 31, 2025
**Impact:** All security features now functional

