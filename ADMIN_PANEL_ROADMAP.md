# Homara Gatekeeper - Admin Panel Feature Roadmap
## Comprehensive Implementation Guide for Admin Features

**Version:** 1.0  
**Last Updated:** October 28, 2025  
**Status:** Ready for Implementation

---

## Table of Contents
1. [High Priority Features](#high-priority-features)
2. [Medium Priority Features](#medium-priority-features)
3. [Technical Improvements](#technical-improvements)
4. [Security Enhancements](#security-enhancements)
5. [Performance Optimizations](#performance-optimizations)
6. [Analytics & Reporting](#analytics--reporting)
7. [Workflow Automation](#workflow-automation)
8. [Implementation Timeline](#implementation-timeline)

---

## High Priority Features

### 1. Automated Database Backups 🔴 CRITICAL

**Priority:** HIGH  
**Estimated Time:** 2-3 hours  
**Impact:** High - Data protection

#### Description
Implement automated daily database backups with point-in-time recovery capability.

#### Implementation Steps

**Database Setup:**
```sql
-- Enable Point-in-Time Recovery (PITR) in Supabase Dashboard
-- Settings → Database → Backups → Enable PITR

-- Create backup configuration table
CREATE TABLE backup_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
  retention_days INTEGER NOT NULL DEFAULT 30,
  storage_location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_backup_at TIMESTAMP WITH TIME ZONE,
  next_backup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create backup history table
CREATE TABLE backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id TEXT NOT NULL,
  backup_type VARCHAR(50),
  status VARCHAR(20), -- 'success', 'failed', 'in_progress'
  file_size_mb NUMERIC,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Admin UI Component:** `src/pages/admin/Backups.tsx`
```typescript
// Features:
// - View backup history
// - Manual backup trigger
// - Download backups
// - Restore from backup (with confirmation)
// - Configure backup schedule
// - Monitor backup status
```

**Navigation Update:**
```typescript
// Add to navigation array in AdminLayout.tsx
{ 
  name: 'Backups', 
  href: '/admin/backups', 
  icon: Database, 
  roles: ['super_admin'] 
}
```

#### Success Metrics
- ✅ Daily automated backups running
- ✅ 30-day retention policy active
- ✅ Backup history visible in admin panel
- ✅ Manual backup/restore tested successfully

---

### 2. Real-Time Monitoring & Alerts 🔴 CRITICAL

**Priority:** HIGH  
**Estimated Time:** 4-5 hours  
**Impact:** High - System health

#### Description
Comprehensive monitoring dashboard showing system health, performance metrics, and automated alerts.

#### Implementation Steps

**Database Tables:**
```sql
-- System health metrics
CREATE TABLE system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL, -- 'cpu', 'memory', 'database', 'api'
  metric_name VARCHAR(100) NOT NULL,
  value NUMERIC NOT NULL,
  unit VARCHAR(20), -- '%', 'ms', 'mb', 'count'
  status VARCHAR(20), -- 'healthy', 'warning', 'critical'
  threshold_warning NUMERIC,
  threshold_critical NUMERIC,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert configurations
CREATE TABLE alert_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_name VARCHAR(100) NOT NULL,
  alert_type VARCHAR(50), -- 'system', 'security', 'business'
  condition JSONB NOT NULL, -- Alert trigger conditions
  notification_channels JSONB, -- email, slack, sms, in-app
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert history
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_config_id UUID REFERENCES alert_configurations(id),
  severity VARCHAR(20), -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  details JSONB,
  status VARCHAR(20), -- 'new', 'acknowledged', 'resolved'
  acknowledged_by UUID REFERENCES admins(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_system_metrics_recorded_at ON system_metrics(recorded_at DESC);
CREATE INDEX idx_alert_history_status ON alert_history(status);
CREATE INDEX idx_alert_history_created_at ON alert_history(created_at DESC);
```

**Monitoring Functions:**
```sql
-- Function to track database performance
CREATE OR REPLACE FUNCTION track_database_metrics()
RETURNS void AS $$
BEGIN
  -- Track active connections
  INSERT INTO system_metrics (metric_type, metric_name, value, unit, status)
  SELECT 
    'database',
    'active_connections',
    count(*),
    'count',
    CASE 
      WHEN count(*) > 80 THEN 'critical'
      WHEN count(*) > 50 THEN 'warning'
      ELSE 'healthy'
    END
  FROM pg_stat_activity
  WHERE state = 'active';
  
  -- Track database size
  INSERT INTO system_metrics (metric_type, metric_name, value, unit, status)
  SELECT 
    'database',
    'total_size',
    pg_database_size(current_database()) / 1024.0 / 1024.0,
    'mb',
    'healthy';
END;
$$ LANGUAGE plpgsql;

-- Function to check for suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS void AS $$
DECLARE
  failed_logins INTEGER;
BEGIN
  -- Check for multiple failed logins
  SELECT COUNT(*) INTO failed_logins
  FROM security_events
  WHERE event_type = 'login_failed'
    AND created_at > NOW() - INTERVAL '15 minutes'
  GROUP BY ip_address
  HAVING COUNT(*) > 5;
  
  IF failed_logins > 0 THEN
    INSERT INTO alert_history (severity, message, details)
    VALUES (
      'critical',
      'Multiple failed login attempts detected',
      jsonb_build_object('failed_count', failed_logins)
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Admin Components:**

1. **Dashboard Widget** - `src/components/admin/SystemHealthWidget.tsx`
   - CPU/Memory usage
   - Database performance
   - Active users
   - API response times
   - Real-time alerts

2. **Monitoring Page** - `src/pages/admin/Monitoring.tsx`
   - Detailed metrics charts
   - Alert management
   - System logs viewer
   - Performance trends

#### Alerts to Implement
- 🚨 High CPU usage (>80%)
- 🚨 Database connection pool near limit
- 🚨 Slow queries detected (>2s)
- 🚨 Multiple failed login attempts
- 🚨 Unusual admin activity
- 🚨 Backup failures
- 🚨 Storage near capacity
- 🚨 API errors spike

---

### 3. Bulk Operations Dashboard 🟡 HIGH

**Priority:** HIGH  
**Estimated Time:** 3-4 hours  
**Impact:** High - Admin efficiency

#### Description
Streamlined interface for bulk operations on users, listings, and verifications.

#### Implementation Steps

**Database Tables:**
```sql
-- Bulk operation jobs
CREATE TABLE bulk_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type VARCHAR(50) NOT NULL, -- 'approve', 'reject', 'delete', 'update'
  entity_type VARCHAR(50) NOT NULL, -- 'users', 'properties', 'verifications'
  entity_ids UUID[] NOT NULL,
  operation_data JSONB,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  successful_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  error_log JSONB,
  initiated_by UUID REFERENCES admins(id),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bulk_operations_status ON bulk_operations(status);
CREATE INDEX idx_bulk_operations_initiated_by ON bulk_operations(initiated_by);
```

**Bulk Operation Functions:**
```sql
-- Bulk approve properties
CREATE OR REPLACE FUNCTION bulk_approve_properties(
  p_property_ids UUID[],
  p_admin_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_operation_id UUID;
BEGIN
  -- Create operation record
  INSERT INTO bulk_operations (
    operation_type,
    entity_type,
    entity_ids,
    total_items,
    initiated_by
  ) VALUES (
    'approve',
    'properties',
    p_property_ids,
    array_length(p_property_ids, 1),
    p_admin_id
  ) RETURNING id INTO v_operation_id;
  
  -- Update properties
  UPDATE properties
  SET 
    approval_status = 'approved',
    moderated_by = p_admin_id,
    moderated_at = NOW()
  WHERE id = ANY(p_property_ids);
  
  -- Update operation status
  UPDATE bulk_operations
  SET 
    status = 'completed',
    processed_items = array_length(p_property_ids, 1),
    successful_items = array_length(p_property_ids, 1),
    completed_at = NOW()
  WHERE id = v_operation_id;
  
  RETURN v_operation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bulk reject verifications
CREATE OR REPLACE FUNCTION bulk_reject_verifications(
  p_verification_ids UUID[],
  p_admin_id UUID,
  p_rejection_reason TEXT
)
RETURNS UUID AS $$
DECLARE
  v_operation_id UUID;
BEGIN
  INSERT INTO bulk_operations (
    operation_type,
    entity_type,
    entity_ids,
    operation_data,
    total_items,
    initiated_by
  ) VALUES (
    'reject',
    'verifications',
    p_verification_ids,
    jsonb_build_object('reason', p_rejection_reason),
    array_length(p_verification_ids, 1),
    p_admin_id
  ) RETURNING id INTO v_operation_id;
  
  UPDATE landlord_verifications
  SET 
    status = 'rejected',
    rejection_reason = p_rejection_reason,
    reviewed_by = p_admin_id,
    reviewed_at = NOW()
  WHERE id = ANY(p_verification_ids);
  
  UPDATE bulk_operations
  SET 
    status = 'completed',
    processed_items = array_length(p_verification_ids, 1),
    successful_items = array_length(p_verification_ids, 1),
    completed_at = NOW()
  WHERE id = v_operation_id;
  
  RETURN v_operation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**UI Components:**

1. **Selection Interface** - Add checkboxes to all list views
2. **Bulk Action Bar** - Sticky bar at bottom when items selected
3. **Confirmation Modal** - Review before executing
4. **Progress Tracker** - Show operation progress
5. **History View** - Past bulk operations log

#### Features
- ✅ Select all / Select filtered
- ✅ Multi-page selection memory
- ✅ Bulk approve/reject/delete
- ✅ Bulk status updates
- ✅ Bulk assignment
- ✅ Export selected items
- ✅ Operation preview
- ✅ Undo capability (within time window)

---

### 4. Advanced Filtering & Search 🟡 HIGH

**Priority:** HIGH  
**Estimated Time:** 4-5 hours  
**Impact:** High - Admin productivity

#### Description
Powerful filtering system across all admin views with saved filters and advanced search.

#### Implementation Steps

**Database Tables:**
```sql
-- Saved filters
CREATE TABLE saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  filter_name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'users', 'properties', 'verifications'
  filter_criteria JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_saved_filters_admin_id ON saved_filters(admin_id);
CREATE INDEX idx_saved_filters_entity_type ON saved_filters(entity_type);
```

**Filter Component:** `src/components/admin/AdvancedFilter.tsx`

Features:
```typescript
interface FilterConfig {
  // Basic filters
  search: string;
  dateRange: { start: Date; end: Date };
  status: string[];
  
  // Advanced filters
  customFields: {
    field: string;
    operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
    value: any;
  }[];
  
  // Sorting
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  
  // Grouping
  groupBy?: string;
}
```

#### Filter Types by Entity

**Users:**
- Role (renter, landlord, admin)
- Status (active, suspended, pending)
- Verification level
- Registration date range
- Last login date
- Location
- Has listings (yes/no)
- Has verifications (yes/no)

**Properties:**
- Approval status
- Price range
- Location (county, area)
- Property type
- Bedrooms/bathrooms
- Listing type (rent, sale, airbnb)
- Featured status
- Landlord verification level
- Flags count
- Views/saves count range
- Posted date range

**Verifications:**
- Status
- Verification level
- Submission date range
- Reviewed by
- Documents status
- Trust score range
- Landlord name/ID

**Saved Filter Presets:**
- "Pending Verifications"
- "High-Priority Flags"
- "Recently Registered Users"
- "Premium Landlords"
- "Properties Needing Review"
- "Suspicious Activity"

---

### 5. Export & Reporting System 🟡 HIGH

**Priority:** HIGH  
**Estimated Time:** 5-6 hours  
**Impact:** High - Data access & compliance

#### Description
Comprehensive export system for all data with scheduled reports and custom report builder.

#### Implementation Steps

**Database Tables:**
```sql
-- Export jobs
CREATE TABLE export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type VARCHAR(50) NOT NULL, -- 'users', 'properties', 'verifications', 'reports'
  export_format VARCHAR(20) NOT NULL, -- 'csv', 'excel', 'pdf', 'json'
  filter_criteria JSONB,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  file_url TEXT,
  file_size_mb NUMERIC,
  row_count INTEGER,
  columns JSONB,
  initiated_by UUID REFERENCES admins(id),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name VARCHAR(100) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  schedule VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
  schedule_config JSONB, -- day of week, time, etc.
  recipients JSONB, -- emails to send to
  filter_criteria JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_export_jobs_initiated_by ON export_jobs(initiated_by);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at);
```

**Export Functions:**
```sql
-- Generate CSV export
CREATE OR REPLACE FUNCTION generate_export(
  p_entity_type VARCHAR,
  p_filter_criteria JSONB,
  p_admin_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_export_id UUID;
BEGIN
  INSERT INTO export_jobs (
    export_type,
    export_format,
    filter_criteria,
    initiated_by
  ) VALUES (
    p_entity_type,
    'csv',
    p_filter_criteria,
    p_admin_id
  ) RETURNING id INTO v_export_id;
  
  -- Trigger background job to generate export
  PERFORM pg_notify('export_job', v_export_id::text);
  
  RETURN v_export_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Report Types

**Operational Reports:**
1. **Daily Summary Report**
   - New users registered
   - New listings posted
   - Verifications processed
   - Flags received
   - System health metrics

2. **Weekly Performance Report**
   - User growth trends
   - Listing metrics
   - Verification pipeline status
   - Admin activity summary
   - Top performing properties

3. **Monthly Business Report**
   - Revenue metrics (if applicable)
   - User retention
   - Property trends by location
   - Verification success rate
   - Market insights

**Compliance Reports:**
1. **Audit Trail Report**
   - All admin actions
   - Security events
   - Data access logs
   - System changes

2. **User Data Report** (GDPR compliance)
   - User information
   - Data access history
   - Consent records

3. **Security Report**
   - Failed login attempts
   - Suspicious activities
   - Access violations
   - Security events summary

**Custom Report Builder:**
- Select entity type
- Choose fields to include
- Apply filters
- Set date range
- Choose format (CSV, Excel, PDF)
- Schedule or export now

---

## Medium Priority Features

### 6. Email Notification System 🟠 MEDIUM

**Priority:** MEDIUM  
**Estimated Time:** 6-8 hours  
**Impact:** Medium - Communication

#### Description
Automated email notifications for admins with customizable templates.

#### Implementation Steps

**Database Tables:**
```sql
-- Email templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(100) NOT NULL UNIQUE,
  template_type VARCHAR(50) NOT NULL, -- 'admin_alert', 'weekly_report', etc.
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB, -- Available template variables
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email queue
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES email_templates(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  template_data JSONB,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email preferences per admin
CREATE TABLE admin_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) UNIQUE,
  receive_daily_summary BOOLEAN DEFAULT TRUE,
  receive_security_alerts BOOLEAN DEFAULT TRUE,
  receive_system_alerts BOOLEAN DEFAULT TRUE,
  receive_verification_alerts BOOLEAN DEFAULT TRUE,
  receive_flag_alerts BOOLEAN DEFAULT TRUE,
  digest_frequency VARCHAR(20) DEFAULT 'daily', -- 'instant', 'hourly', 'daily'
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Email Templates to Create:**

1. **Security Alert Email**
   ```html
   Subject: 🚨 Security Alert: {{alert_type}}
   
   A security event requires your attention:
   - Type: {{event_type}}
   - Severity: {{severity}}
   - Time: {{timestamp}}
   - Details: {{details}}
   
   View in Dashboard: {{dashboard_link}}
   ```

2. **Daily Summary Email**
   ```html
   Subject: 📊 Daily Summary - {{date}}
   
   Today's Activity:
   - New Users: {{new_users}}
   - New Listings: {{new_listings}}
   - Pending Verifications: {{pending_verifications}}
   - Flags to Review: {{pending_flags}}
   
   View Dashboard: {{dashboard_link}}
   ```

3. **High-Priority Flag Email**
   ```html
   Subject: 🚩 High-Priority Flag: {{property_title}}
   
   A property has been flagged for {{reason}}:
   - Property: {{property_title}}
   - Flagged by: {{reporter_name}}
   - Reason: {{reason}}
   - Description: {{description}}
   
   Review Now: {{review_link}}
   ```

#### Email Service Integration
- Use Supabase Edge Functions
- Integrate with SendGrid/Resend/AWS SES
- HTML email templates with responsive design
- Unsubscribe management
- Bounce/complaint handling

---

### 7. Activity Timeline & Audit Trail 🟠 MEDIUM

**Priority:** MEDIUM  
**Estimated Time:** 4-5 hours  
**Impact:** Medium - Transparency & debugging

#### Description
Detailed activity timeline for users, properties, and verifications showing complete history.

#### Implementation Features

**Timeline Component:** `src/components/admin/ActivityTimeline.tsx`

```typescript
interface TimelineEvent {
  id: string;
  timestamp: Date;
  eventType: 'created' | 'updated' | 'action' | 'status_change';
  actor: {
    id: string;
    name: string;
    role: string;
  };
  action: string;
  details: Record<string, any>;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}
```

**Views:**
1. **User Timeline**
   - Account created
   - Profile updates
   - Login history
   - Actions taken
   - Status changes
   - Admin actions on user

2. **Property Timeline**
   - Listing created
   - Status changes (draft → pending → approved)
   - Price changes
   - Views/saves milestones
   - Flags received
   - Admin moderation actions
   - Featured status changes

3. **Verification Timeline**
   - Request submitted
   - Documents uploaded
   - Status changes
   - Admin reviews
   - Approval/rejection
   - Expiry/renewal

**UI Features:**
- Filter by event type
- Search timeline
- Export timeline
- Collapse/expand events
- Visual indicators (icons, colors)
- Relative timestamps ("2 hours ago")

---

### 8. Role-Based Dashboard Customization 🟠 MEDIUM

**Priority:** MEDIUM  
**Estimated Time:** 5-6 hours  
**Impact:** Medium - UX improvement

#### Description
Allow admins to customize their dashboard layout and widgets based on their role and preferences.

#### Implementation Steps

**Database Tables:**
```sql
-- Dashboard configurations
CREATE TABLE dashboard_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) UNIQUE,
  layout JSONB NOT NULL, -- Widget positions and sizes
  widgets JSONB NOT NULL, -- Enabled widgets
  theme_preferences JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Widget definitions
CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_key VARCHAR(50) NOT NULL UNIQUE,
  widget_name VARCHAR(100) NOT NULL,
  widget_type VARCHAR(50) NOT NULL, -- 'stat', 'chart', 'list', 'table'
  description TEXT,
  default_config JSONB,
  required_permissions JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Available Widgets:**

1. **Statistics Widgets**
   - Total Users
   - Active Listings
   - Pending Verifications
   - Flagged Content
   - Revenue (if applicable)

2. **Chart Widgets**
   - User Growth Chart
   - Listing Trends
   - Verification Pipeline
   - Property Types Distribution
   - Geographic Distribution

3. **List Widgets**
   - Recent Users
   - Recent Listings
   - Pending Actions
   - Recent Flags
   - System Alerts

4. **Table Widgets**
   - Top Properties
   - Top Landlords
   - Admin Activity
   - Audit Log

**Customization Features:**
- Drag-and-drop widget positioning
- Resize widgets
- Show/hide widgets
- Widget-specific settings
- Save multiple layouts
- Quick layout presets
- Export/import layouts

---

## Technical Improvements

### 9. Comprehensive Testing Suite 🔵 MEDIUM

**Priority:** MEDIUM  
**Estimated Time:** 10-12 hours  
**Impact:** High - Code quality

#### Test Types to Implement

**1. Unit Tests** (`vitest`)
```typescript
// Example: src/components/admin/__tests__/NotificationCenter.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationCenter } from '../NotificationCenter';

describe('NotificationCenter', () => {
  it('should display unread count', () => {
    // Test implementation
  });
  
  it('should mark notification as read on click', () => {
    // Test implementation
  });
});
```

**2. Integration Tests**
- Test database triggers
- Test RLS policies
- Test API endpoints
- Test authentication flows

**3. E2E Tests** (`Playwright`)
```typescript
// Example: tests/e2e/admin-workflow.spec.ts
test('admin can approve verification', async ({ page }) => {
  await page.goto('/admin/verifications');
  await page.click('[data-testid="verification-approve"]');
  await expect(page.locator('.toast')).toContainText('Approved');
});
```

**Test Coverage Goals:**
- Unit tests: 80%+
- Integration tests: Key workflows
- E2E tests: Critical admin paths

---

### 10. Performance Monitoring & Optimization 🔵 MEDIUM

**Priority:** MEDIUM  
**Estimated Time:** 6-8 hours  
**Impact:** Medium - UX improvement

#### Performance Optimizations

**1. Database Query Optimization**
```sql
-- Add missing indexes
CREATE INDEX idx_properties_approval_status_created ON properties(approval_status, created_at DESC);
CREATE INDEX idx_landlord_verifications_status_submitted ON landlord_verifications(status, submitted_at DESC);
CREATE INDEX idx_audit_logs_created_user ON audit_logs(created_at DESC, user_id);

-- Materialized views for analytics
CREATE MATERIALIZED VIEW admin_dashboard_stats AS
SELECT 
  COUNT(DISTINCT CASE WHEN role = 'renter' THEN id END) as total_renters,
  COUNT(DISTINCT CASE WHEN role = 'landlord' THEN id END) as total_landlords,
  COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN id END) as new_users_30d
FROM profiles;

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY admin_dashboard_stats;
END;
$$ LANGUAGE plpgsql;
```

**2. Frontend Optimizations**
- Implement virtual scrolling for large lists
- Lazy load components
- Image optimization (next/image or similar)
- Code splitting
- Bundle size optimization
- React Query for caching

**3. Caching Strategy**
```typescript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});
```

---

## Security Enhancements

### 11. Advanced Security Features 🔴 HIGH

**Priority:** HIGH  
**Estimated Time:** 8-10 hours  
**Impact:** High - Security

#### Features to Implement

**1. IP Whitelisting**
```sql
-- IP whitelist table
CREATE TABLE admin_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  ip_address INET NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Check IP whitelist function
CREATE OR REPLACE FUNCTION is_ip_whitelisted(
  p_admin_id UUID,
  p_ip_address TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_ip_whitelist
    WHERE admin_id = p_admin_id
      AND ip_address = p_ip_address::inet
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**2. Session Management**
```sql
-- Enhanced session timeout
ALTER TABLE admin_sessions ADD COLUMN idle_timeout_minutes INTEGER DEFAULT 30;
ALTER TABLE admin_sessions ADD COLUMN absolute_timeout_minutes INTEGER DEFAULT 480; -- 8 hours

-- Function to check session validity
CREATE OR REPLACE FUNCTION is_session_valid(p_session_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT * INTO v_session
  FROM admin_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check idle timeout
  IF v_session.last_activity + (v_session.idle_timeout_minutes || ' minutes')::INTERVAL < NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Check absolute timeout
  IF v_session.created_at + (v_session.absolute_timeout_minutes || ' minutes')::INTERVAL < NOW() THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

**3. Two-Factor Authentication (2FA)**
```sql
-- 2FA secrets table
CREATE TABLE admin_2fa_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) UNIQUE,
  secret_encrypted TEXT NOT NULL,
  backup_codes_encrypted TEXT[],
  is_enabled BOOLEAN DEFAULT FALSE,
  enabled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2FA verification attempts
CREATE TABLE admin_2fa_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  success BOOLEAN NOT NULL,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**4. Password Policy Enforcement**
```sql
-- Password policy configuration
CREATE TABLE password_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_length INTEGER DEFAULT 12,
  require_uppercase BOOLEAN DEFAULT TRUE,
  require_lowercase BOOLEAN DEFAULT TRUE,
  require_numbers BOOLEAN DEFAULT TRUE,
  require_special_chars BOOLEAN DEFAULT TRUE,
  password_expiry_days INTEGER DEFAULT 90,
  prevent_reuse_count INTEGER DEFAULT 5,
  max_failed_attempts INTEGER DEFAULT 5,
  lockout_duration_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE
);

-- Password history
CREATE TABLE admin_password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 12. Automated Security Scans 🔵 MEDIUM

**Priority:** MEDIUM  
**Estimated Time:** 4-5 hours  
**Impact:** Medium - Proactive security

#### Implementation

**1. Dependency Scanning**
```bash
# package.json scripts
"scripts": {
  "audit": "npm audit",
  "audit:fix": "npm audit fix",
  "snyk:test": "snyk test",
  "snyk:monitor": "snyk monitor"
}
```

**2. Code Security Scanning**
```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Snyk
        uses: snyk/actions/node@master
      - name: Run CodeQL
        uses: github/codeql-action/analyze@v2
```

**3. Database Security Checks**
```sql
-- Function to check for security issues
CREATE OR REPLACE FUNCTION run_security_checks()
RETURNS TABLE(check_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
  -- Check for weak passwords
  RETURN QUERY
  SELECT 
    'Weak Passwords'::TEXT,
    'warning'::TEXT,
    'Found ' || COUNT(*)::TEXT || ' admins with potentially weak passwords'
  FROM admins
  WHERE LENGTH(admin_code_hash) < 60; -- bcrypt should be 60 chars
  
  -- Check for inactive sessions
  RETURN QUERY
  SELECT 
    'Stale Sessions'::TEXT,
    'info'::TEXT,
    'Found ' || COUNT(*)::TEXT || ' sessions older than 24 hours'
  FROM admin_sessions
  WHERE last_activity < NOW() - INTERVAL '24 hours';
  
  -- Check for RLS policies
  RETURN QUERY
  SELECT 
    'RLS Status'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'critical' ELSE 'healthy' END::TEXT,
    'Tables without RLS: ' || COALESCE(string_agg(tablename, ', '), 'None')
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT IN (
      SELECT tablename 
      FROM pg_policies 
      WHERE schemaname = 'public'
    );
END;
$$ LANGUAGE plpgsql;
```

---

## Analytics & Reporting

### 13. Advanced Analytics Dashboard 🟠 MEDIUM

**Priority:** MEDIUM  
**Estimated Time:** 8-10 hours  
**Impact:** Medium - Business insights

#### Analytics to Implement

**1. User Analytics**
- User growth trends
- User retention rate
- Churn analysis
- User segmentation
- Geographic distribution
- Device/browser breakdown

**2. Property Analytics**
- Listing trends by type
- Price trends by location
- Time-to-approval metrics
- Popular locations
- Conversion funnel (view → save → contact)

**3. Verification Analytics**
- Verification pipeline status
- Average processing time
- Approval/rejection rates
- Common rejection reasons
- Trust score distribution

**4. Admin Performance**
- Actions per admin
- Response time metrics
- Workload distribution
- Efficiency metrics

**Database Views:**
```sql
-- User growth metrics
CREATE VIEW user_growth_metrics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  role,
  COUNT(*) as new_users,
  SUM(COUNT(*)) OVER (PARTITION BY role ORDER BY DATE_TRUNC('day', created_at)) as total_users
FROM profiles
GROUP BY DATE_TRUNC('day', created_at), role;

-- Property performance metrics
CREATE VIEW property_performance_metrics AS
SELECT 
  p.id,
  p.title,
  p.county,
  p.property_type,
  p.price_kes,
  COUNT(DISTINCT pv.id) as total_views,
  COUNT(DISTINCT ps.id) as total_saves,
  COUNT(DISTINCT pi.id) as total_inquiries,
  ROUND(COUNT(DISTINCT pi.id)::NUMERIC / NULLIF(COUNT(DISTINCT pv.id), 0) * 100, 2) as conversion_rate
FROM properties p
LEFT JOIN property_views pv ON p.id = pv.property_id
LEFT JOIN property_saves ps ON p.id = ps.property_id
LEFT JOIN property_inquiries pi ON p.id = pi.property_id
GROUP BY p.id;
```

---

### 14. Custom Report Builder 🟠 MEDIUM

**Priority:** MEDIUM  
**Estimated Time:** 10-12 hours  
**Impact:** Medium - Flexibility

#### Features

**Visual Query Builder:**
- Drag-and-drop interface
- Select data sources
- Choose fields
- Apply filters
- Add aggregations
- Create visualizations

**Report Types:**
- Tables
- Charts (line, bar, pie, area)
- Pivot tables
- Dashboards

**Sharing & Scheduling:**
- Save custom reports
- Schedule automated runs
- Share with other admins
- Export in multiple formats

---

## Workflow Automation

### 15. Automated Workflows 🔵 MEDIUM

**Priority:** MEDIUM  
**Estimated Time:** 6-8 hours  
**Impact:** Medium - Efficiency

#### Workflows to Automate

**1. Auto-Assignment**
```sql
-- Auto-assign verifications to admins
CREATE OR REPLACE FUNCTION auto_assign_verification()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Find admin with least workload
  SELECT a.id INTO v_admin_id
  FROM admins a
  LEFT JOIN (
    SELECT reviewed_by, COUNT(*) as workload
    FROM landlord_verifications
    WHERE status = 'in_review'
    GROUP BY reviewed_by
  ) w ON a.id = w.reviewed_by
  WHERE a.status = 'active'
    AND a.admin_role IN ('super_admin', 'senior_admin')
  ORDER BY COALESCE(w.workload, 0) ASC
  LIMIT 1;
  
  -- Assign to admin
  IF v_admin_id IS NOT NULL THEN
    UPDATE landlord_verifications
    SET reviewed_by = v_admin_id,
        status = 'in_review'
    WHERE id = NEW.id;
    
    -- Notify admin
    PERFORM create_admin_notification(
      'verification_assigned',
      'New Verification Assigned',
      'A verification request has been assigned to you.',
      'verification',
      NEW.id,
      '/admin/verifications',
      'normal',
      ARRAY[v_admin_id]
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_assign_verification
AFTER INSERT ON landlord_verifications
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION auto_assign_verification();
```

**2. Auto-Escalation**
```sql
-- Escalate old pending items
CREATE OR REPLACE FUNCTION auto_escalate_old_items()
RETURNS void AS $$
BEGIN
  -- Escalate verifications pending > 48 hours
  UPDATE landlord_verifications
  SET status = 'in_review',
      admin_notes = COALESCE(admin_notes, '') || '\n[AUTO-ESCALATED] Pending for more than 48 hours'
  WHERE status = 'pending'
    AND submitted_at < NOW() - INTERVAL '48 hours';
  
  -- Create high-priority notifications
  INSERT INTO admin_notifications (admin_id, type, title, message, priority)
  SELECT 
    a.id,
    'escalation',
    'Auto-Escalated Verification',
    'Verification has been escalated due to pending time > 48 hours',
    'high'
  FROM admins a
  WHERE a.admin_role IN ('super_admin', 'senior_admin')
    AND a.status = 'active';
END;
$$ LANGUAGE plpgsql;
```

**3. Auto-Cleanup**
```sql
-- Cleanup old data
CREATE OR REPLACE FUNCTION auto_cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete old notifications (read, older than 30 days)
  DELETE FROM admin_notifications
  WHERE read = TRUE 
    AND read_at < NOW() - INTERVAL '30 days';
  
  -- Archive old audit logs (older than 1 year)
  INSERT INTO audit_logs_archive
  SELECT * FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '1 year';
  
  -- Delete expired sessions
  DELETE FROM admin_sessions
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## Implementation Timeline

### Phase 1: Critical Foundation (Week 1-2)
**Focus:** Security & Stability
- ✅ Notification System (COMPLETED)
- 🔴 Automated Backups
- 🔴 Monitoring & Alerts
- 🔴 Advanced Security (IP whitelist, 2FA)

### Phase 2: Productivity Tools (Week 3-4)
**Focus:** Admin Efficiency
- 🟡 Bulk Operations
- 🟡 Advanced Filtering
- 🟡 Export & Reporting
- 🟡 Activity Timeline

### Phase 3: Analytics & Insights (Week 5-6)
**Focus:** Data-Driven Decisions
- 🟠 Analytics Dashboard
- 🟠 Custom Report Builder
- 🟠 Performance Metrics
- 🟠 Email Notifications

### Phase 4: Optimization & Automation (Week 7-8)
**Focus:** Efficiency & Quality
- 🔵 Testing Suite
- 🔵 Performance Optimization
- 🔵 Automated Workflows
- 🔵 Dashboard Customization

---

## Success Metrics

### Quantitative Metrics
- **Efficiency:** 50% reduction in time to process verifications
- **Response Time:** <30 seconds for all admin operations
- **Uptime:** 99.9% availability
- **Security:** Zero security incidents
- **Testing:** 80%+ code coverage

### Qualitative Metrics
- Admin satisfaction score: 4.5/5
- Ease of use rating: 4.5/5
- Feature completeness: 90%+

---

## Next Steps

1. **Review & Prioritize:** Review this roadmap with team
2. **Create Tasks:** Break down into individual tasks/tickets
3. **Assign Resources:** Assign developers to each phase
4. **Set Milestones:** Define completion criteria for each phase
5. **Track Progress:** Regular reviews and adjustments

---

## Notes

- All database migrations should be tested in staging first
- Each feature should include documentation
- Security features require thorough testing
- Performance benchmarks should be established
- User feedback should be collected regularly

---

**This is a living document. Update as priorities change or new requirements emerge.**

Last updated: October 28, 2025

