/**
 * Notification Dispatcher
 *
 * Central entry point for triggering notifications across the app.
 * Creates an in-app notification and optionally fires an email.
 *
 * Fire-and-forget design: never throws, never blocks the caller.
 * All errors are logged internally.
 *
 * Created: 2026-03-27
 */

import { fromTable } from '@/lib/supabase/untyped';
import { createAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { isEmailConfigured, sendEmail } from '@/lib/email/client';
import { EMAIL_COLORS } from '@/lib/email/templates/layout';
import { SITE_URL } from '@/config/brand';
import { logger } from '@/utils/logger';

const LOG_SOURCE = 'NotificationDispatcher';

// isEmailConfigured() exists specifically so callers can short-circuit before
// attempting a send — this dispatcher wasn't using it, so every dispatched
// notification produced a fresh unconfigured-transport error. Found
// 2026-08-29: 56 identical "RESEND_API_KEY is not set" errors in 24h, one per
// notification, drowning any real email failure in the same log. The
// condition is static (no key deployed), not per-notification, so it only
// needs saying once.
let _unconfiguredWarned = false;

// =====================================================================
// CONFIG: Which notification types trigger emails
// =====================================================================

/**
 * Notification types that also send an email.
 * Add types here as email templates are created.
 */
const EMAIL_ENABLED_TYPES: Record<string, boolean> = {
  // NOTE: 'payment' intentionally omitted — payment confirmation emails are
  // sent via the dedicated payment-received template in paymentFlowService
  // (sendSellerPaymentNotification). Enabling it here double-emails the seller.
  project_funded: true,
  booking_request: true,
  booking_update: true,
  // Growth loop: "someone tried to tip you" is exactly the moment to reach a
  // user who hasn't set up receiving — and they may not visit the app to see
  // the in-app notification. Deduped at the dispatch site (7 days).
  tip_dead_end: true,
  // Onboarding drip emails are dispatched directly by the scheduler,
  // not through this config, since they use custom templates.
};

// =====================================================================
// TYPES
// =====================================================================

interface DispatchParams {
  /** Recipient user ID (auth.users.id) */
  userId: string;
  /** Notification type (e.g., 'payment', 'follow', 'system') */
  type: string;
  /** Short title for the notification */
  title: string;
  /** Longer message body */
  message: string;
  /** Optional metadata for the notification */
  data?: Record<string, unknown>;
  /** Optional URL the notification links to */
  actionUrl?: string;
  /** Source actor ID (who triggered this notification) */
  sourceActorId?: string;
  /** Source entity type */
  sourceEntityType?: string;
  /** Source entity ID */
  sourceEntityId?: string;
}

// =====================================================================
// DISPATCHER
// =====================================================================

export class NotificationDispatcher {
  /**
   * Fire-and-forget: creates in-app notification AND sends email if applicable.
   *
   * Never throws. All errors are logged internally.
   */
  static async dispatch(params: DispatchParams): Promise<void> {
    const { userId, type, title } = params;

    logger.debug('Dispatching notification', { userId, type, title }, LOG_SOURCE);

    // Create in-app notification (non-blocking)
    const inAppPromise = NotificationDispatcher.createInAppNotification(params).catch(err => {
      logger.error(
        'Failed to create in-app notification',
        { userId, type, error: err instanceof Error ? err.message : err },
        LOG_SOURCE
      );
    });

    // Send email if this type has email enabled (non-blocking)
    const emailPromise = EMAIL_ENABLED_TYPES[type]
      ? NotificationDispatcher.sendEmailNotification(params).catch(err => {
          logger.error(
            'Failed to send email notification',
            { userId, type, error: err instanceof Error ? err.message : err },
            LOG_SOURCE
          );
        })
      : Promise.resolve();

    // Wait for both but don't throw
    await Promise.allSettled([inAppPromise, emailPromise]);

    logger.debug('Notification dispatch complete', { userId, type }, LOG_SOURCE);
  }

  /**
   * Insert a notification row into the notifications table.
   * Schema: id, user_id, type, message, metadata, is_read, created_at, read_at, action_url
   * Title is combined with message since the table has no title column.
   */
  private static async createInAppNotification(params: DispatchParams): Promise<void> {
    const admin = createAdminClient();

    // Fold title into metadata so the UI can display it separately if desired
    const metadata: Record<string, unknown> = {
      ...(params.data ?? {}),
      title: params.title,
      source_actor_id: params.sourceActorId,
      source_entity_type: params.sourceEntityType,
      source_entity_id: params.sourceEntityId,
    };

    const { error } = await fromTable(admin, DATABASE_TABLES.NOTIFICATIONS).insert({
      user_id: params.userId,
      type: params.type,
      message: params.message,
      action_url: params.actionUrl ?? null,
      metadata,
      is_read: false,
    });

    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }

    logger.debug(
      'In-app notification created',
      { userId: params.userId, type: params.type },
      LOG_SOURCE
    );
  }

  /**
   * Send an email notification for the given type.
   * Resolves the user's email address and sends via Resend.
   */
  private static async sendEmailNotification(params: DispatchParams): Promise<void> {
    if (!isEmailConfigured()) {
      if (!_unconfiguredWarned) {
        _unconfiguredWarned = true;
        logger.warn(
          'Dropping email notifications: RESEND_API_KEY (Resend) is unset. ' +
            'Every notification email since process start has been silently discarded. ' +
            'This warns once per process, not once per notification — treat one line as an ongoing outage, not a benign default.',
          {},
          LOG_SOURCE
        );
      }
      return;
    }

    const admin = createAdminClient();

    // Resolve email: profile contact_email -> auth user email
    const { data: profile } = await fromTable(admin, DATABASE_TABLES.PROFILES)
      .select('contact_email, display_name:name')
      .eq('id', params.userId)
      .single();

    let email = profile?.contact_email ?? null;

    if (!email) {
      const { data: authUser } = await admin.auth.admin.getUserById(params.userId);
      email = authUser?.user?.email ?? null;
    }

    if (!email) {
      logger.warn(
        'User has no email — skipping email notification',
        { userId: params.userId, type: params.type },
        LOG_SOURCE
      );
      return;
    }

    // Build a simple email from the notification data.
    // For specialized templates (payment-received, tasks, etc.),
    // callers should use the dedicated send functions directly.
    const subject = params.title;
    const userName = profile?.display_name || 'there';

    // actionUrl is typically a relative path (e.g. /dashboard/bookings).
    // Email clients can't resolve relative hrefs — absolutize against SITE_URL.
    const absoluteActionUrl = params.actionUrl
      ? params.actionUrl.startsWith('http')
        ? params.actionUrl
        : `${SITE_URL}${params.actionUrl.startsWith('/') ? '' : '/'}${params.actionUrl}`
      : null;

    const text = [
      `Hi ${userName},`,
      '',
      params.message,
      '',
      absoluteActionUrl ? `View details: ${absoluteActionUrl}` : '',
      '',
      '-- OrangeCat',
    ]
      .filter(Boolean)
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Inter,system-ui,sans-serif;color:${EMAIL_COLORS.TEXT_PRIMARY};">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;padding:0 16px;">
    <tr>
      <td>
        <p style="font-size:13px;color:${EMAIL_COLORS.TEXT_MUTED};margin:0 0 24px;">OrangeCat</p>
        <h1 style="font-size:22px;font-weight:600;margin:0 0 16px;">${params.title}</h1>
        <p style="font-size:15px;color:${EMAIL_COLORS.TEXT_SECONDARY};margin:0 0 32px;">${params.message}</p>
        ${
          absoluteActionUrl
            ? `<a href="${absoluteActionUrl}"
                style="display:inline-block;background:${EMAIL_COLORS.TIFFANY};color:#ffffff;text-decoration:none;
                       padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500;">
                View Details
              </a>`
            : ''
        }
        <p style="font-size:12px;color:${EMAIL_COLORS.TEXT_MUTED};margin-top:40px;">
          You're receiving this because you have an account on OrangeCat.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const result = await sendEmail({ to: email, subject, html, text });
    if (!result.sent) {
      // Caller catches and logs 'Failed to send email notification'.
      throw new Error(result.error);
    }

    logger.info(
      'Email notification sent',
      { userId: params.userId, type: params.type, to: email },
      LOG_SOURCE
    );
  }
}
