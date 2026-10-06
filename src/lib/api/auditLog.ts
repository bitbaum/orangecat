/**
 * Audit Logging System
 *
 * Tracks critical operations for security, compliance, and debugging.
 * Week 3 Improvement: Centralized audit logging for all sensitive operations
 *
 * Usage:
 * ```typescript
 * await auditLog({
 *   action: 'WALLET_CREATED',
 *   userId: user.id,
 *   entityType: 'wallet',
 *   entityId: wallet.id,
 *   metadata: { address: wallet.address_or_xpub, category: wallet.category }
 * });
 * ```
 */

import { fromTable } from '@/lib/supabase/untyped';
import { createServerClient } from '@/lib/supabase/server';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';

/**
 * Audit action types - add more as needed
 */
export const AUDIT_ACTIONS = {
  // Authentication
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_REGISTERED: 'USER_REGISTERED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',

  // Profile
  PROFILE_CREATED: 'PROFILE_CREATED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  PROFILE_DELETED: 'PROFILE_DELETED',

  // Entities (generic — any registry entity type; the specific type is in entityType)
  ENTITY_CREATED: 'ENTITY_CREATED',
  ENTITY_UPDATED: 'ENTITY_UPDATED',
  ENTITY_DELETED: 'ENTITY_DELETED',

  // Projects
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  PROJECT_PUBLISHED: 'PROJECT_PUBLISHED',
  PROJECT_UNPUBLISHED: 'PROJECT_UNPUBLISHED',

  // Wallets
  WALLET_CREATED: 'WALLET_CREATED',
  WALLET_UPDATED: 'WALLET_UPDATED',
  WALLET_DELETED: 'WALLET_DELETED',
  WALLET_BALANCE_REFRESHED: 'WALLET_BALANCE_REFRESHED',

  // Social
  USER_FOLLOWED: 'USER_FOLLOWED',
  USER_UNFOLLOWED: 'USER_UNFOLLOWED',

  // Donations
  DONATION_INITIATED: 'DONATION_INITIATED',
  DONATION_COMPLETED: 'DONATION_COMPLETED',
  DONATION_FAILED: 'DONATION_FAILED',

  // Payments — money leaving a user's own wallet through our server
  PAYMENT_SENT: 'PAYMENT_SENT',
  PAYMENT_SEND_FAILED: 'PAYMENT_SEND_FAILED',

  // Admin
  ADMIN_ACTION: 'ADMIN_ACTION',
  PERMISSIONS_CHANGED: 'PERMISSIONS_CHANGED',

  // Security
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS_ATTEMPT: 'UNAUTHORIZED_ACCESS_ATTEMPT',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
} as const;

type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Audit log entry interface
 */
interface AuditLogEntry {
  action: AuditAction;
  userId: string | null;
  /** Any registry entity type (product, service, project, …) or profile/wallet/etc.
   *  Stored in the audit_logs.entity_type text column. */
  entityType?: string;
  entityId?: string;

  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Create audit log entry
 *
 * @param entry - Audit log entry data
 * @param client - Write through this client instead of the request's session.
 *   For callers that can run without a cookie session (the Cat's tools): the
 *   default client would fail there, and a failure here is swallowed, so the
 *   row would vanish without a sound.
 * @returns Promise that resolves when log is created
 *
 * @example
 * await auditLog({
 *   action: 'WALLET_CREATED',
 *   userId: user.id,
 *   entityType: 'wallet',
 *   entityId: newWallet.id,
 *   metadata: { address: newWallet.address_or_xpub }
 * });
 */
export async function auditLog(entry: AuditLogEntry, client?: AnySupabaseClient): Promise<void> {
  try {
    const supabase = client ?? (await createServerClient());

    // Create audit log entry in database

    const { error } = await fromTable(supabase, DATABASE_TABLES.AUDIT_LOGS).insert({
      action: entry.action,
      user_id: entry.userId,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      metadata: entry.metadata || {},
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      success: entry.success ?? true,
      error_message: entry.errorMessage,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // If audit logging fails, log to console but don't fail the operation
      logger.error('Failed to create audit log', {
        action: entry.action,
        userId: entry.userId,
        error: error.message,
      });
    } else {
      // Also log to structured logger for real-time monitoring
      logger.info('Audit log created', {
        action: entry.action,
        userId: entry.userId,
        entityType: entry.entityType,
        entityId: entry.entityId,
      });
    }
  } catch (error) {
    // Never throw errors from audit logging - it should not break the main operation
    logger.error('Unexpected error in audit logging', { error });
  }
}

/**
 * Simplified audit log for successful operations
 */
export async function auditSuccess(
  action: AuditAction,
  userId: string,
  entityType?: AuditLogEntry['entityType'],
  entityId?: string,

  metadata?: Record<string, unknown>
): Promise<void> {
  return auditLog({
    action,
    userId,
    entityType,
    entityId,
    metadata,
    success: true,
  });
}
