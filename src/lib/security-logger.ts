/**
 * Security Event Logger
 * 
 * Logs all admin actions to database for auditing and compliance.
 * Should be used for:
 * - Admin login/logout
 * - Property approvals/rejections
 * - User verification changes
 * - Landlord verification decisions
 * - Admin role changes
 * - Sensitive data access
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from './production-logger';

export type ActionType =
  | 'admin_login'
  | 'admin_logout'
  | 'admin_login_failed'
  | 'property_approved'
  | 'property_rejected'
  | 'property_viewed'
  | 'user_verified'
  | 'user_unverified'
  | 'user_viewed'
  | 'verification_approved'
  | 'verification_rejected'
  | 'verification_viewed'
  | 'admin_created'
  | 'admin_updated'
  | 'admin_deleted'
  | 'settings_changed';

export type TargetType = 'property' | 'user' | 'verification' | 'admin' | 'settings';

interface SecurityLogEvent {
  actionType: ActionType;
  targetType?: TargetType;
  targetId?: string;
  details?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Log a security event to the audit table
 */
export async function logSecurityEvent(event: SecurityLogEvent): Promise<void> {
  try {
    // Get current admin info
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      logger.warn('Security event logged without authenticated user', { event });
      return;
    }

    // Get admin record
    const { data: adminData } = await supabase
      .from('admins')
      .select('id, email')
      .eq('user_id', user.id)
      .single();

    if (!adminData) {
      logger.warn('Security event logged by non-admin user', { event, userId: user.id });
      return;
    }

    // Get client IP and user agent (if available)
    const clientInfo = {
      ip_address: null, // Would need server-side implementation
      user_agent: navigator?.userAgent || null,
    };

    // Insert audit log
    const { error } = await supabase
      .from('admin_audit_logs')
      .insert({
        admin_id: adminData.id,
        admin_email: adminData.email || user.email,
        action_type: event.actionType,
        target_type: event.targetType,
        target_id: event.targetId,
        details: event.details || {},
        success: event.success !== false, // Default to true
        error_message: event.errorMessage,
        ...clientInfo,
      });

    if (error) {
      logger.error('Failed to log security event', { error, event });
    }
  } catch (error) {
    // Never let audit logging break the application
    logger.error('Security logging error', { error, event });
  }
}

/**
 * Log admin login
 */
export async function logAdminLogin(success: boolean, email: string, errorMessage?: string): Promise<void> {
  await logSecurityEvent({
    actionType: success ? 'admin_login' : 'admin_login_failed',
    details: { email },
    success,
    errorMessage,
  });
}

/**
 * Log admin logout
 */
export async function logAdminLogout(): Promise<void> {
  await logSecurityEvent({
    actionType: 'admin_logout',
    success: true,
  });
}

/**
 * Log property action
 */
export async function logPropertyAction(
  propertyId: string,
  action: 'approved' | 'rejected' | 'viewed',
  details?: Record<string, unknown>
): Promise<void> {
  const actionMap = {
    approved: 'property_approved',
    rejected: 'property_rejected',
    viewed: 'property_viewed',
  } as const;

  await logSecurityEvent({
    actionType: actionMap[action],
    targetType: 'property',
    targetId: propertyId,
    details,
    success: true,
  });
}

/**
 * Log user verification action
 */
export async function logUserVerificationAction(
  userId: string,
  verified: boolean,
  details?: Record<string, unknown>
): Promise<void> {
  await logSecurityEvent({
    actionType: verified ? 'user_verified' : 'user_unverified',
    targetType: 'user',
    targetId: userId,
    details,
    success: true,
  });
}

/**
 * Log landlord verification decision
 */
export async function logVerificationDecision(
  verificationId: string,
  approved: boolean,
  details?: Record<string, unknown>
): Promise<void> {
  await logSecurityEvent({
    actionType: approved ? 'verification_approved' : 'verification_rejected',
    targetType: 'verification',
    targetId: verificationId,
    details,
    success: true,
  });
}

/**
 * Log admin management action
 */
export async function logAdminManagementAction(
  targetAdminId: string,
  action: 'created' | 'updated' | 'deleted',
  details?: Record<string, unknown>
): Promise<void> {
  const actionMap = {
    created: 'admin_created',
    updated: 'admin_updated',
    deleted: 'admin_deleted',
  } as const;

  await logSecurityEvent({
    actionType: actionMap[action],
    targetType: 'admin',
    targetId: targetAdminId,
    details,
    success: true,
  });
}

