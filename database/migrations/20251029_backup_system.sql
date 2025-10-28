-- Automated Backup System
-- Configures backup monitoring and history tracking
-- Backup schedule: Every 3 days

-- Backup configurations table
CREATE TABLE IF NOT EXISTS backup_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type VARCHAR(50) NOT NULL, -- 'auto', 'manual'
  interval_days INTEGER NOT NULL DEFAULT 3, -- Backup every 3 days
  retention_days INTEGER NOT NULL DEFAULT 30,
  storage_location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_backup_at TIMESTAMP WITH TIME ZONE,
  next_backup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backup history table
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id TEXT NOT NULL,
  backup_type VARCHAR(50), -- 'scheduled', 'manual', 'pitr'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'success', 'failed'
  file_size_mb NUMERIC,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);
CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_configs_active ON backup_configurations(is_active);

-- Enable RLS
ALTER TABLE backup_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only super admins can view
CREATE POLICY "Super admins can view backup configs"
ON backup_configurations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE id = auth.uid() 
      AND admin_role = 'super_admin'
      AND status = 'active'
  )
);

CREATE POLICY "Super admins can update backup configs"
ON backup_configurations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE id = auth.uid() 
      AND admin_role = 'super_admin'
      AND status = 'active'
  )
);

CREATE POLICY "Super admins can view backup history"
ON backup_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE id = auth.uid() 
      AND admin_role = 'super_admin'
      AND status = 'active'
  )
);

-- Insert default configuration (3-day interval)
INSERT INTO backup_configurations (
  backup_type,
  interval_days,
  retention_days,
  is_active
) VALUES (
  'auto',
  3, -- Every 3 days
  30, -- Keep for 30 days
  TRUE
) ON CONFLICT DO NOTHING;

-- Function to get backup status
CREATE OR REPLACE FUNCTION get_backup_status()
RETURNS TABLE(
  last_backup_time TIMESTAMP WITH TIME ZONE,
  next_backup_time TIMESTAMP WITH TIME ZONE,
  backup_interval_days INTEGER,
  total_backups INTEGER,
  successful_backups INTEGER,
  failed_backups INTEGER,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bc.last_backup_at,
    bc.next_backup_at,
    bc.interval_days,
    COUNT(bh.id)::INTEGER as total_backups,
    COUNT(CASE WHEN bh.status = 'success' THEN 1 END)::INTEGER as successful_backups,
    COUNT(CASE WHEN bh.status = 'failed' THEN 1 END)::INTEGER as failed_backups,
    CASE 
      WHEN bc.last_backup_at IS NULL THEN 'never_run'
      WHEN bc.last_backup_at < NOW() - (bc.interval_days || ' days')::INTERVAL THEN 'overdue'
      WHEN bc.next_backup_at < NOW() + INTERVAL '24 hours' THEN 'due_soon'
      ELSE 'healthy'
    END::TEXT as status
  FROM backup_configurations bc
  LEFT JOIN backup_history bh ON bh.created_at > NOW() - INTERVAL '30 days'
  WHERE bc.is_active = TRUE
  GROUP BY bc.id, bc.last_backup_at, bc.next_backup_at, bc.interval_days
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record backup
CREATE OR REPLACE FUNCTION record_backup(
  p_backup_id TEXT,
  p_backup_type VARCHAR DEFAULT 'manual',
  p_status VARCHAR DEFAULT 'success',
  p_file_size_mb NUMERIC DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_history_id UUID;
BEGIN
  -- Insert backup history
  INSERT INTO backup_history (
    backup_id,
    backup_type,
    status,
    file_size_mb,
    completed_at,
    error_message
  ) VALUES (
    p_backup_id,
    p_backup_type,
    p_status,
    p_file_size_mb,
    NOW(),
    p_error_message
  ) RETURNING id INTO v_history_id;
  
  -- Update configuration if successful
  IF p_status = 'success' THEN
    UPDATE backup_configurations
    SET 
      last_backup_at = NOW(),
      next_backup_at = NOW() + (interval_days || ' days')::INTERVAL,
      updated_at = NOW()
    WHERE is_active = TRUE;
  END IF;
  
  RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent backups
CREATE OR REPLACE FUNCTION get_recent_backups(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  id UUID,
  backup_id TEXT,
  backup_type VARCHAR,
  status VARCHAR,
  file_size_mb NUMERIC,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bh.id,
    bh.backup_id,
    bh.backup_type,
    bh.status,
    bh.file_size_mb,
    bh.started_at,
    bh.completed_at,
    EXTRACT(EPOCH FROM (bh.completed_at - bh.started_at))::INTEGER as duration_seconds,
    bh.error_message
  FROM backup_history bh
  ORDER BY bh.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE backup_configurations IS 'Backup configuration with 3-day interval';
COMMENT ON TABLE backup_history IS 'Historical record of all backup operations';
COMMENT ON FUNCTION get_backup_status IS 'Returns current backup system status';
COMMENT ON FUNCTION record_backup IS 'Records a backup operation';
COMMENT ON FUNCTION get_recent_backups IS 'Returns recent backup history';

