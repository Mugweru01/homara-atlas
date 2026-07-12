/**
 * Validation Schemas
 * 
 * Zod schemas for validating all user inputs in the admin panel.
 * Prevents SQL injection, XSS, and data corruption.
 */

import { z } from 'zod';

// =====================================================
// AUTHENTICATION SCHEMAS
// =====================================================

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  adminCode: z.string().min(6, 'Admin code must be at least 6 characters').max(100),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

// =====================================================
// SEARCH & FILTER SCHEMAS
// =====================================================

export const searchSchema = z.object({
  query: z.string().max(200, 'Search query too long').optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(50),
});

export const roleFilterSchema = z.enum(['all', 'landlord', 'customer', 'admin']);

export const statusFilterSchema = z.enum(['all', 'pending', 'approved', 'declined', 'rejected']);

// =====================================================
// PROPERTY SCHEMAS
// =====================================================

export const propertyApprovalSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  status: z.enum(['approved', 'declined']),
  reason: z.string().max(500).optional(),
});

export type PropertyApprovalInput = z.infer<typeof propertyApprovalSchema>;

// =====================================================
// USER SCHEMAS
// =====================================================

export const userVerificationSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  verified: z.boolean(),
  reason: z.string().max(500).optional(),
});

export type UserVerificationInput = z.infer<typeof userVerificationSchema>;

// =====================================================
// VERIFICATION SCHEMAS
// =====================================================

export const verificationDecisionSchema = z.object({
  verificationId: z.string().uuid('Invalid verification ID'),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().min(10, 'Rejection reason required (min 10 characters)').max(1000).optional(),
});

export type VerificationDecisionInput = z.infer<typeof verificationDecisionSchema>;

// =====================================================
// ADMIN MANAGEMENT SCHEMAS
// =====================================================

export const createAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  adminRole: z.enum(['super_admin', 'senior_admin', 'junior_admin', 'support_admin']),
  adminCode: z.string().min(12, 'Admin code must be at least 12 characters'),
});

export const updateAdminSchema = z.object({
  adminId: z.string().uuid('Invalid admin ID'),
  adminRole: z.enum(['super_admin', 'senior_admin', 'junior_admin', 'support_admin']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

// =====================================================
// DATE RANGE SCHEMA
// =====================================================

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().or(z.date()).optional(),
  endDate: z.string().datetime().or(z.date()).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start <= end;
    }
    return true;
  },
  { message: 'Start date must be before end date' }
);

// =====================================================
// BULK ACTION SCHEMAS
// =====================================================

export const bulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one ID required').max(100, 'Maximum 100 items'),
  action: z.enum(['approve', 'reject', 'delete', 'verify', 'unverify']),
  reason: z.string().max(500).optional(),
});

export type BulkActionInput = z.infer<typeof bulkActionSchema>;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize search input
 */
export function validateSearch(input: unknown): string {
  const parsed = z.string().max(200).safeParse(input);
  if (!parsed.success) {
    return '';
  }
  return sanitizeHtml(parsed.data);
}

/**
 * Safe UUID validation
 */
export function isValidUuid(input: string): boolean {
  const uuidSchema = z.string().uuid();
  return uuidSchema.safeParse(input).success;
}

