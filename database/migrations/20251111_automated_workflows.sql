-- Automated Workflows System
-- Week 5, Day 23
-- Created: November 11, 2025

-- =====================================================
-- 1. WORKFLOW RULES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(255) NOT NULL,
  rule_description TEXT,
  entity_type VARCHAR(50) NOT NULL, -- 'verification', 'listing', 'flag', 'user'
  trigger_event VARCHAR(50) NOT NULL, -- 'created', 'updated', 'time_elapsed', 'status_changed'
  conditions JSONB, -- Conditions that must be met
  actions JSONB NOT NULL, -- Actions to perform (assign, escalate, notify)
  priority INTEGER DEFAULT 0, -- Higher priority rules execute first
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_rules_entity ON workflow_rules(entity_type);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_trigger ON workflow_rules(trigger_event);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_active ON workflow_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflow_rules_priority ON workflow_rules(priority DESC);

-- =====================================================
-- 2. WORKFLOW EXECUTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES workflow_rules(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  triggered_by VARCHAR(50), -- Event that triggered the workflow
  actions_performed JSONB, -- What actions were taken
  execution_status VARCHAR(20) DEFAULT 'success', -- 'success', 'failed', 'partial'
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_exec_rule ON workflow_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_entity ON workflow_executions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_date ON workflow_executions(executed_at DESC);

-- =====================================================
-- 3. TASK ASSIGNMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  assigned_to UUID REFERENCES admins(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  assignment_reason VARCHAR(100), -- 'manual', 'workflow', 'escalation'
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  due_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'escalated'
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_assign_admin ON task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_assign_entity ON task_assignments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_task_assign_status ON task_assignments(status);
CREATE INDEX IF NOT EXISTS idx_task_assign_priority ON task_assignments(priority);
CREATE INDEX IF NOT EXISTS idx_task_assign_due ON task_assignments(due_date) WHERE status IN ('pending', 'in_progress');

-- =====================================================
-- 4. ESCALATION HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS escalation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES task_assignments(id) ON DELETE CASCADE,
  escalated_from UUID REFERENCES admins(id) ON DELETE SET NULL,
  escalated_to UUID REFERENCES admins(id) ON DELETE SET NULL,
  escalation_reason TEXT,
  escalated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_escalation_task ON escalation_history(task_id);
CREATE INDEX IF NOT EXISTS idx_escalation_to ON escalation_history(escalated_to);

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_history ENABLE ROW LEVEL SECURITY;

-- Workflow Rules: Super/Senior admins can manage
CREATE POLICY "Admins can view workflow rules" ON workflow_rules FOR SELECT
USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
);

CREATE POLICY "Senior admins can manage rules" ON workflow_rules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
      AND status = 'active'
  )
);

-- Workflow Executions: Senior admins can view
CREATE POLICY "Senior admins can view executions" ON workflow_executions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
  )
);

-- Task Assignments: Admins can view own and assigned tasks
CREATE POLICY "Admins can view own assignments" ON task_assignments FOR SELECT
USING (
  assigned_to = (SELECT id FROM admins WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
  )
);

CREATE POLICY "Admins can update own assignments" ON task_assignments FOR UPDATE
USING (
  assigned_to = (SELECT id FROM admins WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
  )
);

CREATE POLICY "System can create assignments" ON task_assignments FOR INSERT
WITH CHECK (true);

-- Escalation History: Admins can view relevant escalations
CREATE POLICY "Admins can view escalations" ON escalation_history FOR SELECT
USING (
  escalated_to = (SELECT id FROM admins WHERE user_id = auth.uid())
  OR escalated_from = (SELECT id FROM admins WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid() 
      AND admin_role IN ('super_admin', 'senior_admin')
  )
);

-- =====================================================
-- 6. WORKFLOW FUNCTIONS
-- =====================================================

-- Auto-assign verification to available admin
CREATE OR REPLACE FUNCTION auto_assign_verification()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_workload INTEGER;
  v_min_workload INTEGER := 999999;
BEGIN
  -- Only auto-assign on creation if status is pending
  IF NEW.status = 'pending' THEN
    -- Find admin with least workload
    FOR v_admin_id IN 
      SELECT a.id 
      FROM admins a
      WHERE a.status = 'active'
        AND a.admin_role IN ('admin', 'senior_admin', 'super_admin')
    LOOP
      SELECT COUNT(*) INTO v_workload
      FROM task_assignments
      WHERE assigned_to = v_admin_id
        AND status IN ('pending', 'in_progress');
      
      IF v_workload < v_min_workload THEN
        v_min_workload := v_workload;
        v_admin_id := v_admin_id;
      END IF;
    END LOOP;
    
    -- Create assignment if admin found
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO task_assignments (
        entity_type,
        entity_id,
        assigned_to,
        assignment_reason,
        priority,
        due_date
      ) VALUES (
        'verification',
        NEW.id,
        v_admin_id,
        'workflow',
        'normal',
        NOW() + INTERVAL '48 hours'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_verification ON landlord_verifications;
CREATE TRIGGER trigger_auto_assign_verification
  AFTER INSERT ON landlord_verifications
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_verification();

-- Get my pending assignments
CREATE OR REPLACE FUNCTION get_my_assignments()
RETURNS TABLE(
  id UUID,
  entity_type VARCHAR,
  entity_id UUID,
  priority VARCHAR,
  due_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR,
  entity_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin not found.';
  END IF;
  
  RETURN QUERY
  SELECT 
    ta.id,
    ta.entity_type,
    ta.entity_id,
    ta.priority,
    ta.due_date,
    ta.status,
    CASE
      WHEN ta.entity_type = 'verification' THEN
        (SELECT row_to_json(lv.*) FROM landlord_verifications lv WHERE lv.id = ta.entity_id)
      WHEN ta.entity_type = 'listing' THEN
        (SELECT row_to_json(p.*) FROM properties p WHERE p.id = ta.entity_id)
      WHEN ta.entity_type = 'flag' THEN
        (SELECT row_to_json(pf.*) FROM property_flags pf WHERE pf.id = ta.entity_id)
      ELSE NULL
    END as entity_details,
    ta.created_at
  FROM task_assignments ta
  WHERE ta.assigned_to = v_admin_id
    AND ta.status IN ('pending', 'in_progress')
  ORDER BY 
    CASE ta.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    ta.due_date ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete assignment
CREATE OR REPLACE FUNCTION complete_assignment(p_assignment_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin not found.';
  END IF;
  
  UPDATE task_assignments
  SET status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_assignment_id
    AND assigned_to = v_admin_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assignment not found or unauthorized');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Assignment completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Escalate assignment
CREATE OR REPLACE FUNCTION escalate_assignment(
  p_assignment_id UUID,
  p_escalate_to UUID,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_current_assignee UUID;
BEGIN
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin not found.';
  END IF;
  
  -- Get current assignee
  SELECT assigned_to INTO v_current_assignee
  FROM task_assignments
  WHERE id = p_assignment_id;
  
  -- Update assignment
  UPDATE task_assignments
  SET assigned_to = p_escalate_to,
      status = 'escalated',
      priority = 'high',
      updated_at = NOW()
  WHERE id = p_assignment_id;
  
  -- Record escalation
  INSERT INTO escalation_history (
    task_id,
    escalated_from,
    escalated_to,
    escalation_reason
  ) VALUES (
    p_assignment_id,
    v_current_assignee,
    p_escalate_to,
    p_reason
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Assignment escalated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get overdue assignments (for escalation)
CREATE OR REPLACE FUNCTION get_overdue_assignments()
RETURNS TABLE(
  id UUID,
  entity_type VARCHAR,
  entity_id UUID,
  assigned_to UUID,
  due_date TIMESTAMP WITH TIME ZONE,
  hours_overdue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ta.id,
    ta.entity_type,
    ta.entity_id,
    ta.assigned_to,
    ta.due_date,
    EXTRACT(EPOCH FROM (NOW() - ta.due_date)) / 3600 as hours_overdue
  FROM task_assignments ta
  WHERE ta.status IN ('pending', 'in_progress')
    AND ta.due_date < NOW()
  ORDER BY ta.due_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get assignment statistics
CREATE OR REPLACE FUNCTION get_assignment_statistics()
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_stats JSONB;
BEGIN
  SELECT id INTO v_admin_id FROM admins WHERE user_id = auth.uid();
  
  SELECT jsonb_build_object(
    'total_pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
    'completed_today', COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > CURRENT_DATE),
    'overdue', COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND due_date < NOW()),
    'high_priority', COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND priority IN ('high', 'urgent'))
  )
  INTO v_stats
  FROM task_assignments
  WHERE assigned_to = v_admin_id;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

