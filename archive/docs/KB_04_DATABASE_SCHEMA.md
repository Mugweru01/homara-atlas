# 2.1 Database Schema - Complete Reference

**All Tables, Columns, Relationships, and Constraints**

---

## 📊 Schema Overview

**Total Tables:** 50+  
**Total Columns:** 500+  
**Total Indexes:** 150+  
**Total Functions:** 100+  
**Total Triggers:** 20+

---

## 🗃️ Table Categories

### Core Tables:
- admins
- profiles
- properties
- landlord_verifications
- property_flags

### Security Tables:
- admin_security_preferences
- ip_whitelist
- trusted_devices
- password_policies
- password_history
- security_scan_results
- login_attempts
- account_lockouts

### Operational Tables:
- task_assignments
- workflow_rules
- escalation_history
- admin_notifications
- admin_activity_log

### Reporting Tables:
- admin_report_schedules
- admin_generated_reports
- custom_report_definitions
- custom_report_executions
- admin_saved_filters
- admin_export_history

### Monitoring Tables:
- system_metrics
- monitoring_alerts
- alert_configurations
- backup_configurations
- backup_history
- performance_metrics
- error_logs
- page_load_metrics
- analytics_metrics

### System Tables:
- admin_email_templates
- admin_email_preferences
- admin_email_queue
- admin_dashboard_preferences
- dashboard_widgets

---

## 📋 Detailed Table Schemas

### **admins**
Primary table for admin users.

```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  admin_role admin_role NOT NULL DEFAULT 'admin',
  status admin_status NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id)
);
```

**Columns:**
- `id` - Primary key
- `user_id` - Link to Supabase auth.users
- `email` - Admin email (unique)
- `full_name` - Display name
- `admin_role` - ENUM: 'super_admin', 'senior_admin', 'admin'
- `status` - ENUM: 'active', 'inactive', 'suspended'
- `last_login_at` - Last login timestamp
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `created_by` - Admin who created this record

**Indexes:**
- `idx_admins_user_id` ON user_id
- `idx_admins_email` ON email
- `idx_admins_role` ON admin_role
- `idx_admins_status` ON status

**RLS Policies:**
- Admins can view own record
- Super admins can view all
- Super admins can update all

---

### **profiles**
User profiles for platform users.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  role profile_role NOT NULL DEFAULT 'customer',
  avatar_url TEXT,
  bio TEXT,
  trust_score INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Primary key
- `user_id` - Link to auth.users
- `full_name` - User's full name
- `email` - User email
- `phone` - Contact phone
- `role` - ENUM: 'renter', 'customer', 'landlord'
- `avatar_url` - Profile picture URL
- `bio` - User bio/description
- `trust_score` - Calculated trust score (0-100)
- `is_verified` - Email verification status
- `created_at` - Account creation date
- `updated_at` - Last profile update

**Indexes:**
- `idx_profiles_user_id` ON user_id
- `idx_profiles_email` ON email
- `idx_profiles_role` ON role
- `idx_profiles_trust_score` ON trust_score

---

### **properties**
Property listings on the platform.

```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  property_type VARCHAR(50),
  bedrooms INTEGER,
  bathrooms INTEGER,
  price_kes DECIMAL(12, 2),
  location_county VARCHAR(100),
  location_town VARCHAR(100),
  location_address TEXT,
  property_status property_status DEFAULT 'pending',
  is_active BOOLEAN DEFAULT FALSE,
  views_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  images JSONB DEFAULT '[]'::jsonb,
  amenities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);
```

**Columns:**
- `id` - Primary key
- `owner_id` - Property owner (landlord)
- `title` - Listing title
- `description` - Full description
- `property_type` - apartment, house, studio, etc.
- `bedrooms` - Number of bedrooms
- `bathrooms` - Number of bathrooms
- `price_kes` - Monthly rent in KES
- `location_county` - County name
- `location_town` - Town/city name
- `location_address` - Full address
- `property_status` - ENUM: 'pending', 'approved', 'rejected', 'archived'
- `is_active` - Currently available for rent
- `views_count` - Total views
- `saves_count` - Total saves/favorites
- `images` - JSONB array of image URLs
- `amenities` - JSONB array of amenities
- `created_at` - Listing creation date
- `updated_at` - Last update
- `published_at` - When approved and published

**Indexes:**
- `idx_properties_owner` ON owner_id
- `idx_properties_status` ON property_status
- `idx_properties_active` ON is_active
- `idx_properties_price` ON price_kes
- `idx_properties_location` ON location_county, location_town
- `idx_properties_created` ON created_at
- `idx_properties_type` ON property_type

---

### **landlord_verifications**
Landlord verification requests and status.

```sql
CREATE TABLE landlord_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  id_document_url TEXT,
  proof_of_ownership_url TEXT,
  status verification_status DEFAULT 'pending',
  verified_by UUID REFERENCES admins(id),
  verification_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Primary key
- `landlord_id` - User requesting verification
- `id_document_url` - ID document (storage URL)
- `proof_of_ownership_url` - Ownership proof (storage URL)
- `status` - ENUM: 'pending', 'approved', 'rejected'
- `verified_by` - Admin who processed
- `verification_notes` - Admin notes
- `submitted_at` - Submission timestamp
- `verified_at` - Processing timestamp
- `rejection_reason` - If rejected, why
- `created_at` - Record creation
- `updated_at` - Last update

**Indexes:**
- `idx_verif_landlord` ON landlord_id
- `idx_verif_status` ON status
- `idx_verif_submitted` ON submitted_at

**Triggers:**
- Auto-creates task assignment on insert
- Logs activity on status change
- Creates notification for admins

---

### **admin_notifications**
Real-time notifications for admins.

```sql
CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  notification_type notification_type NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  priority notification_priority DEFAULT 'normal',
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Primary key
- `admin_id` - Target admin (NULL = all admins)
- `title` - Notification title
- `message` - Full message text
- `notification_type` - ENUM: 'new_user', 'new_verification', 'flagged_content', 'system_alert'
- `entity_type` - Type of related entity
- `entity_id` - ID of related entity
- `is_read` - Read status
- `priority` - ENUM: 'low', 'normal', 'high', 'urgent'
- `action_url` - Link to take action
- `created_at` - When created

**Indexes:**
- `idx_notif_admin` ON admin_id
- `idx_notif_read` ON is_read
- `idx_notif_created` ON created_at
- `idx_notif_type` ON notification_type

**Realtime:** Enabled for live updates

---

### **task_assignments**
Automated task assignments to admins.

```sql
CREATE TABLE task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to UUID REFERENCES admins(id) ON DELETE SET NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  status task_status DEFAULT 'pending',
  priority task_priority DEFAULT 'normal',
  due_date TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assignment_reason VARCHAR(50) DEFAULT 'workflow',
  notes TEXT,
  escalated BOOLEAN DEFAULT FALSE,
  escalated_at TIMESTAMPTZ
);
```

**Columns:**
- `id` - Primary key
- `assigned_to` - Admin assigned
- `entity_type` - 'verification', 'property', 'user', etc.
- `entity_id` - ID of entity
- `task_type` - Type of task
- `status` - ENUM: 'pending', 'in_progress', 'completed', 'cancelled'
- `priority` - ENUM: 'low', 'normal', 'high', 'urgent'
- `due_date` - When task is due
- `assigned_at` - Assignment timestamp
- `started_at` - When admin started
- `completed_at` - When completed
- `assignment_reason` - 'workflow', 'manual', 'escalation'
- `notes` - Admin notes
- `escalated` - Has been escalated
- `escalated_at` - When escalated

**Indexes:**
- `idx_task_assign_admin` ON assigned_to
- `idx_task_assign_entity` ON entity_type, entity_id
- `idx_task_assign_status` ON status
- `idx_task_assign_priority` ON priority
- `idx_task_assign_due` ON due_date (WHERE status IN ('pending', 'in_progress'))

---

### **admin_security_preferences**
Security settings per admin.

```sql
CREATE TABLE admin_security_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE UNIQUE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  ip_whitelist_enabled BOOLEAN DEFAULT FALSE,
  trusted_devices_only BOOLEAN DEFAULT FALSE,
  session_timeout_minutes INTEGER DEFAULT 1440,
  require_password_change_days INTEGER DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Primary key
- `admin_id` - Admin (unique)
- `two_factor_enabled` - 2FA enabled
- `ip_whitelist_enabled` - IP restriction active
- `trusted_devices_only` - Only trusted devices
- `session_timeout_minutes` - Session length (default 24 hours)
- `require_password_change_days` - Password expiry (default 90 days)
- `created_at` - Record creation
- `updated_at` - Last update

---

### **ip_whitelist**
IP addresses allowed for admin access.

```sql
CREATE TABLE ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
```

**Columns:**
- `id` - Primary key
- `admin_id` - Admin who owns this IP
- `ip_address` - IP address (INET type)
- `description` - Location/device description
- `is_active` - Currently active
- `created_at` - When added
- `expires_at` - Optional expiration

**Indexes:**
- `idx_ip_whitelist_admin` ON admin_id
- `idx_ip_whitelist_ip` ON ip_address

---

### **password_policies**
Password requirements and policies.

```sql
CREATE TABLE password_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name VARCHAR(100) NOT NULL UNIQUE,
  min_length INTEGER DEFAULT 8,
  require_uppercase BOOLEAN DEFAULT TRUE,
  require_lowercase BOOLEAN DEFAULT TRUE,
  require_numbers BOOLEAN DEFAULT TRUE,
  require_special_chars BOOLEAN DEFAULT TRUE,
  prevent_reuse_count INTEGER DEFAULT 5,
  max_age_days INTEGER DEFAULT 90,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Primary key
- `policy_name` - Policy identifier
- `min_length` - Minimum password length
- `require_uppercase` - Needs uppercase letter
- `require_lowercase` - Needs lowercase letter
- `require_numbers` - Needs number
- `require_special_chars` - Needs special character
- `prevent_reuse_count` - How many old passwords to check
- `max_age_days` - Password expiry days
- `is_active` - Currently enforced (only one active)
- `created_at` - Creation date
- `updated_at` - Last update

---

### **backup_configurations**
Automated backup settings.

```sql
CREATE TABLE backup_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type VARCHAR(50) NOT NULL,
  schedule_interval INTERVAL NOT NULL DEFAULT '3 days',
  retention_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Primary key
- `backup_type` - 'full', 'incremental'
- `schedule_interval` - How often (INTERVAL type)
- `retention_days` - Keep backups for X days
- `is_active` - Currently running
- `last_run_at` - Last backup time
- `next_run_at` - Next scheduled backup
- `created_at` - Config creation
- `updated_at` - Last config update

---

### **analytics_metrics**
Platform analytics and metrics.

```sql
CREATE TABLE analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_category VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC,
  dimensions JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Primary key
- `metric_category` - 'users', 'properties', 'revenue', etc.
- `metric_name` - Specific metric
- `metric_value` - Numeric value
- `dimensions` - Additional context (JSONB)
- `recorded_at` - Timestamp

**Indexes:**
- `idx_analytics_metrics_recorded` ON recorded_at
- `idx_analytics_metrics_category` ON metric_category

---

## 🔗 Table Relationships

### Primary Relationships:

```
auth.users (Supabase)
  └─> admins (user_id)
  └─> profiles (user_id)

profiles
  └─> properties (owner_id)
  └─> landlord_verifications (landlord_id)

admins
  └─> admin_notifications (admin_id)
  └─> admin_security_preferences (admin_id)
  └─> ip_whitelist (admin_id)
  └─> task_assignments (assigned_to)
  └─> admin_saved_filters (admin_id)
  └─> custom_report_definitions (created_by)

landlord_verifications
  └─> task_assignments (entity_id, WHERE entity_type = 'verification')

properties
  └─> property_flags (property_id)
```

---

## 📚 Enum Types

### **admin_role**
```sql
CREATE TYPE admin_role AS ENUM (
  'super_admin',
  'senior_admin',
  'admin'
);
```

### **admin_status**
```sql
CREATE TYPE admin_status AS ENUM (
  'active',
  'inactive',
  'suspended'
);
```

### **verification_status**
```sql
CREATE TYPE verification_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);
```

### **property_status**
```sql
CREATE TYPE property_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'archived'
);
```

### **task_status**
```sql
CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled'
);
```

### **task_priority**
```sql
CREATE TYPE task_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);
```

### **notification_type**
```sql
CREATE TYPE notification_type AS ENUM (
  'new_user',
  'new_verification',
  'flagged_content',
  'system_alert',
  'task_assigned',
  'task_escalated'
);
```

---

## 🔍 Indexes Summary

**Total Indexes:** 150+

**High-Impact Indexes:**
- All foreign keys
- Status columns (for filtering)
- Timestamp columns (for sorting)
- Combination indexes for common queries
- Partial indexes for active records

**Example Partial Index:**
```sql
CREATE INDEX idx_task_assign_due 
ON task_assignments(due_date) 
WHERE status IN ('pending', 'in_progress');
```

---

## 📖 Related Documentation

- [Database Functions Reference](./KB_05_FUNCTIONS_REFERENCE.md)
- [RLS Policies Guide](./KB_06_RLS_POLICIES.md)
- [Triggers & Automation](./KB_07_TRIGGERS.md)
- [Tables Reference](./KB_30_TABLES_REFERENCE.md)

---

**Next:** [Database Functions →](./KB_05_FUNCTIONS_REFERENCE.md)

