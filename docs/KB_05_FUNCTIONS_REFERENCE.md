# 2.2 Database Functions Reference

**Complete RPC Functions Documentation**

---

## 📚 Function Categories

### **Dashboard & Stats:**
- get_dashboard_stats()
- get_dashboard_overview()
- get_user_statistics()
- get_listing_statistics()

### **Security:**
- get_admin_security_preferences()
- update_admin_security_preferences()
- add_ip_to_whitelist()
- remove_ip_from_whitelist()
- revoke_trusted_device()
- get_active_password_policy()
- update_password_policy()
- run_security_scan()
- get_security_scan_history()

### **Tasks & Workflows:**
- get_my_assignments()
- get_assignment_statistics()
- complete_assignment()
- escalate_assignment()
- get_overdue_assignments()
- auto_assign_verification()

### **Backups:**
- record_backup()
- get_backup_status()
- get_backup_history()

### **Monitoring:**
- get_system_metrics()
- record_alert()
- get_active_alerts()

### **Reports:**
- create_report_schedule()
- get_report_schedules()
- execute_custom_report()
- get_generated_reports()

### **Analytics:**
- get_user_growth()
- get_listing_growth()
- get_revenue_by_period()
- get_top_listings()
- get_trust_score_distribution()

### **Performance:**
- record_performance_metric()
- get_performance_summary()
- get_error_statistics()

---

## 🔧 Function Details

### **get_dashboard_stats()**

**Purpose:** Get overview statistics for the main dashboard

**Parameters:** None

**Returns:** JSONB
```json
{
  "total_users": 1250,
  "new_users_today": 15,
  "total_listings": 450,
  "pending_verifications": 12,
  "flagged_content": 3,
  "total_revenue": 1250000.00
}
```

**Usage:**
```typescript
const { data, error } = await supabase.rpc('get_dashboard_stats');
```

**Permissions:** All admins

**Performance:** ~50ms (optimized with indexes)

---

### **get_admin_security_preferences()**

**Purpose:** Get security settings for current admin

**Parameters:** None

**Returns:** JSONB
```json
{
  "two_factor_enabled": true,
  "ip_whitelist_enabled": false,
  "trusted_devices_only": false,
  "session_timeout_minutes": 1440,
  "require_password_change_days": 90
}
```

**Usage:**
```typescript
const { data, error } = await supabase.rpc('get_admin_security_preferences');
```

**Permissions:** Own preferences only

**Default Values:** Returns defaults if no preferences exist

---

### **update_admin_security_preferences(...)**

**Purpose:** Update security settings for current admin

**Parameters:**
- `p_two_factor_enabled` BOOLEAN (optional)
- `p_ip_whitelist_enabled` BOOLEAN (optional)
- `p_trusted_devices_only` BOOLEAN (optional)
- `p_session_timeout_minutes` INTEGER (optional)

**Returns:** JSONB
```json
{
  "success": true,
  "message": "Security preferences updated successfully"
}
```

**Usage:**
```typescript
const { data, error } = await supabase.rpc('update_admin_security_preferences', {
  p_two_factor_enabled: true,
  p_ip_whitelist_enabled: false
});
```

**Permissions:** Own preferences only

**Notes:** 
- Only updates provided parameters
- Creates preferences if they don't exist
- Validates all inputs

---

### **add_ip_to_whitelist(...)**

**Purpose:** Add IP address to admin's whitelist

**Parameters:**
- `p_ip_address` TEXT (required) - IP address in dotted notation
- `p_description` TEXT (optional) - Description of location/device

**Returns:** JSONB
```json
{
  "success": true,
  "message": "IP address added to whitelist",
  "ip_id": "uuid-here"
}
```

**Usage:**
```typescript
const { data, error } = await supabase.rpc('add_ip_to_whitelist', {
  p_ip_address: '192.168.1.1',
  p_description: 'Office'
});
```

**Validation:**
- IP address format checked
- Duplicate IPs updated instead of creating new
- Maximum 10 IPs per admin

**Permissions:** Own whitelist only

---

### **run_security_scan()**

**Purpose:** Run automated security vulnerability scan

**Parameters:** None

**Returns:** JSONB
```json
{
  "success": true,
  "scans_performed": 5,
  "issues_found": 2,
  "critical": 0,
  "high": 1,
  "medium": 1,
  "low": 0,
  "scan_id": "uuid-here"
}
```

**Scans Performed:**
1. Inactive admin accounts (90+ days)
2. Admins without 2FA enabled
3. Multiple failed login attempts
4. Suspicious IP patterns
5. Weak password hashes (if accessible)

**Usage:**
```typescript
const { data, error } = await supabase.rpc('run_security_scan');
```

**Permissions:** Super admin, senior admin only

**Performance:** ~500ms (scans multiple tables)

---

### **get_my_assignments(...)**

**Purpose:** Get tasks assigned to current admin

**Parameters:**
- `p_status` TEXT (optional) - Filter by status
- `p_priority` TEXT (optional) - Filter by priority
- `p_limit` INTEGER (optional, default 50)

**Returns:** TABLE
```sql
RETURNS TABLE(
  id UUID,
  entity_type VARCHAR,
  entity_id UUID,
  task_type VARCHAR,
  status task_status,
  priority task_priority,
  due_date TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  entity_details JSONB
)
```

**Usage:**
```typescript
const { data, error } = await supabase.rpc('get_my_assignments', {
  p_status: 'pending',
  p_priority: 'high'
});
```

**Entity Details:** Includes relevant data from the linked entity (e.g., landlord verification details)

**Permissions:** Own assignments only

---

### **complete_assignment(...)**

**Purpose:** Mark task as completed

**Parameters:**
- `p_assignment_id` UUID (required)
- `p_notes` TEXT (optional)

**Returns:** JSONB
```json
{
  "success": true,
  "message": "Assignment completed successfully"
}
```

**Usage:**
```typescript
const { data, error } = await supabase.rpc('complete_assignment', {
  p_assignment_id: 'task-uuid',
  p_notes: 'Documents verified and approved'
});
```

**Side Effects:**
- Updates task status to 'completed'
- Sets completed_at timestamp
- Logs activity
- May trigger notifications

**Permissions:** Only assigned admin can complete

---

### **execute_custom_report(...)**

**Purpose:** Execute a custom report definition

**Parameters:**
- `p_report_id` UUID (required) - Report definition ID
- `p_parameters` JSONB (optional) - Report parameters

**Returns:** TABLE (dynamic columns based on report)

**Usage:**
```typescript
const { data, error } = await supabase.rpc('execute_custom_report', {
  p_report_id: 'report-uuid',
  p_parameters: { start_date: '2024-01-01', end_date: '2024-12-31' }
});
```

**Notes:**
- Builds dynamic SQL from report definition
- Validates parameters
- Records execution in admin_generated_reports
- Supports multiple data sources
- Enforces row limits for safety

**Permissions:** Report owner or super admin

---

### **get_user_growth(...)**

**Purpose:** Get user registration trends over time

**Parameters:**
- `p_start_date` DATE (optional, default 30 days ago)
- `p_end_date` DATE (optional, default today)
- `p_interval` TEXT (optional, default 'day') - 'day', 'week', 'month'

**Returns:** TABLE
```sql
RETURNS TABLE(
  period DATE,
  new_users BIGINT,
  cumulative_users BIGINT,
  new_renters BIGINT,
  new_customers BIGINT
)
```

**Usage:**
```typescript
const { data, error } = await supabase.rpc('get_user_growth', {
  p_start_date: '2024-01-01',
  p_end_date: '2024-12-31',
  p_interval: 'month'
});
```

**Performance:** Optimized with date indexes

**Permissions:** All admins

---

### **record_performance_metric(...)**

**Purpose:** Log performance metric for monitoring

**Parameters:**
- `p_category` VARCHAR (required) - 'api', 'database', 'frontend'
- `p_name` VARCHAR (required) - Metric name
- `p_value` NUMERIC (required) - Metric value
- `p_unit` VARCHAR (optional) - 'ms', 'seconds', 'count'
- `p_metadata` JSONB (optional) - Additional context

**Returns:** UUID (metric ID)

**Usage:**
```typescript
await supabase.rpc('record_performance_metric', {
  p_category: 'api',
  p_name: 'get_dashboard_stats',
  p_value: 45.2,
  p_unit: 'ms'
});
```

**Use Cases:**
- API response time tracking
- Database query performance
- Frontend render times
- Custom business metrics

**Permissions:** All admins

---

### **get_performance_summary(...)**

**Purpose:** Get performance metrics summary

**Parameters:**
- `p_hours` INTEGER (optional, default 24) - Lookback period

**Returns:** TABLE
```sql
RETURNS TABLE(
  category VARCHAR,
  metric_name VARCHAR,
  avg_value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  p50_value NUMERIC,
  p95_value NUMERIC,
  p99_value NUMERIC,
  sample_count BIGINT
)
```

**Usage:**
```typescript
const { data, error } = await supabase.rpc('get_performance_summary', {
  p_hours: 24
});
```

**Metrics Include:**
- Average response time
- Percentiles (p50, p95, p99)
- Min/max values
- Sample count

**Permissions:** Super admin, senior admin

---

### **get_backup_status()**

**Purpose:** Get current backup configuration and status

**Parameters:** None

**Returns:** TABLE
```sql
RETURNS TABLE(
  backup_type VARCHAR,
  schedule_interval INTERVAL,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_backup_size BIGINT,
  status VARCHAR
)
```

**Usage:**
```typescript
const { data, error } = await supabase.rpc('get_backup_status');
```

**Permissions:** Super admin only

---

### **auto_assign_verification()**

**Purpose:** Automatically assign verification to admin (trigger function)

**Parameters:** None (uses NEW record from trigger)

**Returns:** VOID

**Logic:**
1. Finds eligible admins (active, not suspended)
2. Counts pending tasks per admin
3. Assigns to admin with least workload
4. Creates notification
5. Logs activity

**Triggered By:** INSERT on landlord_verifications WHERE status = 'pending'

**Permissions:** System (trigger function)

---

## 🔍 Helper Functions

### **get_admin_id()**

**Purpose:** Get admin.id from auth.uid()

**Parameters:** None

**Returns:** UUID

**Usage:**
```sql
SELECT get_admin_id();
```

**Notes:**
- Used internally by RLS policies
- Maps auth.users.id to admins.id
- Returns NULL if not an admin

---

## 🎯 Function Performance

### Optimization Tips:

1. **Use Indexes:**
   - All functions use indexed columns
   - Compound indexes for complex queries

2. **Limit Results:**
   - Most functions have default limits
   - Pass smaller limits for faster queries

3. **Filter Early:**
   - Use parameters to filter data
   - Avoid fetching and filtering client-side

4. **Cache Results:**
   - Use React Query caching
   - Set appropriate stale times

---

## 🔒 Security Attributes

### All Functions Have:
```sql
SECURITY DEFINER  -- Run with function owner's permissions
STABLE            -- Can be optimized by query planner
SET search_path = public, pg_temp  -- Prevent SQL injection
```

### Permission Checks:
- Functions validate caller is admin
- Most check admin_role for authorization
- Some restrict to own records (e.g., preferences)

---

## 📊 Error Handling

### Standard Error Responses:

**Success:**
```json
{
  "success": true,
  "message": "Operation completed",
  "data": {...}
}
```

**Failure:**
```json
{
  "success": false,
  "message": "Error description",
  "error_code": "INVALID_INPUT"
}
```

### Common Error Codes:
- `UNAUTHORIZED` - Not an admin or wrong role
- `INVALID_INPUT` - Parameter validation failed
- `NOT_FOUND` - Record doesn't exist
- `ALREADY_EXISTS` - Duplicate record
- `OPERATION_FAILED` - Unexpected error

---

## 📖 Related Documentation

- [Database Schema](./KB_04_DATABASE_SCHEMA.md)
- [RLS Policies](./KB_06_RLS_POLICIES.md)
- [API Integration](./KB_22_API_INTEGRATION.md)
- [Complete API Reference](./KB_29_API_REFERENCE.md)

---

**Next:** [RLS Policies Guide →](./KB_06_RLS_POLICIES.md)

