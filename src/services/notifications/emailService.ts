/**
 * Notification Email Service
 *
 * Orchestrates email delivery for the notification system.
 * Checks user preferences, enforces frequency caps, resolves templates,
 * and sends via Resend. Fire-and-forget — never throws, never blocks callers.
 *
 * Flow:
 *   1. Look up notification type in NOTIFICATION_CONFIG
 *   2. Check if user has email enabled for this type (preferences + overrides)
 *   3. Check frequency cap (don't spam)
 *   4. Resolve user email address
 *   5. Generate email from template
 *   6. Send via Resend
 *   7. Log delivery for cap tracking
 *
 * Created: 2026-03-27
 */

import { fromTable } from '@/lib/supabase/untyped';
import { createAdminClient } from '@/lib/supabase/admin';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { sendEmail } from '@/lib/email/client';
import {
  NOTIFICATION_CONFIG,
  isTransactional,
  type NotificationTypeConfig,
  type NotificationCategory,
  type FrequencyCap,
} from '@/config/notification-config';
import { welcomeTemplate } from '@/lib/email/templates/welcome';
import { milestoneTemplate, type MilestoneType } from '@/lib/email/templates/milestone';
import { weeklyDigestTemplate, type EntityPerformance } from '@/lib/email/templates/weekly-digest';
import { displayBTC } from '@/services/currency/formatting';
import {
  groupActivityTemplate,
  type GroupActivityType,
} from '@/lib/email/templates/group-activity';
import { reengagementTemplate, type ReengagementStage } from '@/lib/email/templates/reengagement';
import { logger } from '@/utils/logger';

const LOG_SOURCE = 'NotificationEmailService';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://orangecat.ch';

// =====================================================================
// TYPES
// =====================================================================

interface SendNotificationEmailParams {
  /** Recipient user ID (auth.users.id) */
  userId: string;
  /** Notification type key from NOTIFICATION_CONFIG */
  type: string;
  /** Template data — varies by notification type */
  data: Record<string, unknown>;
}

interface SendResult {
  sent: boolean;
  reason?: string;
}

// Map category names to the preference column that controls them
const CATEGORY_PREFERENCE_COLUMNS: Record<NotificationCategory, string> = {
  transactional: 'economic_emails', // unused — transactional always sends
  economic: 'economic_emails',
  social: 'social_emails',
  group: 'group_emails',
  progress: 'progress_emails',
  reengagement: 'reengagement_emails',
};

// =====================================================================
// SERVICE
// =====================================================================

export class NotificationEmailService {
  /**
   * Send a single notification email.
   *
   * Fire-and-forget: returns { sent, reason } instead of throwing.
   */
  async sendNotificationEmail(params: SendNotificationEmailParams): Promise<SendResult> {
    const { userId, type, data } = params;

    try {
      // 1. Look up notification config
      const config = NOTIFICATION_CONFIG[type];
      if (!config) {
        return { sent: false, reason: `unknown notification type: ${type}` };
      }

      if (!config.emailEnabled) {
        return { sent: false, reason: 'email not enabled for this type' };
      }

      // 2. Check if user should receive this email
      const shouldSend = await this.shouldSendEmail(userId, type, config);
      if (!shouldSend.allowed) {
        return { sent: false, reason: shouldSend.reason };
      }

      // 3. Check frequency cap
      if (config.frequencyCap) {
        const withinCap = await this.isWithinFrequencyCap(userId, type, config.frequencyCap);
        if (!withinCap) {
          return { sent: false, reason: 'frequency cap exceeded' };
        }
      }

      // 4. Resolve email address
      const emailInfo = await this.resolveEmail(userId);
      if (!emailInfo) {
        return { sent: false, reason: 'no email address found' };
      }

      // 5. Generate email content from template
      const emailContent = this.generateEmail(type, config, {
        ...data,
        displayName: emailInfo.displayName,
      });

      if (!emailContent) {
        return { sent: false, reason: `no template for type: ${type}` };
      }

      // 6. Send via mail-kit (never throws — returns an honest result)
      const sendResult = await sendEmail({
        to: emailInfo.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
      if (!sendResult.sent) {
        logger.error(
          'Notification email send failed',
          { userId, type, to: emailInfo.email, error: sendResult.error },
          LOG_SOURCE
        );
        return { sent: false, reason: sendResult.error };
      }

      // 7. Record delivery for frequency capping
      await this.recordDelivery(userId, type);

      logger.info('Notification email sent', { userId, type, to: emailInfo.email }, LOG_SOURCE);

      return { sent: true };
    } catch (err) {
      logger.error(
        'Failed to send notification email',
        { userId, type, error: err instanceof Error ? err.message : err },
        LOG_SOURCE
      );
      return { sent: false, reason: 'internal error' };
    }
  }

  // ===================================================================
  // PREFERENCE CHECKING
  // ===================================================================

  /**
   * Check if user should receive this email type based on preferences.
   * Transactional notifications always pass.
   */
  private async shouldSendEmail(
    userId: string,
    type: string,
    config: NotificationTypeConfig
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Transactional = always send
    if (isTransactional(type)) {
      return { allowed: true };
    }

    const admin = createAdminClient();

    // Fetch user preferences
    const { data: prefs } = await fromTable(admin, DATABASE_TABLES.NOTIFICATION_PREFERENCES)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // No preferences row = use defaults (all enabled)
    if (!prefs) {
      return config.emailDefaultOn
        ? { allowed: true }
        : { allowed: false, reason: 'email off by default, no preferences set' };
    }

    // Check per-type override first (most specific)
    const typeOverrides = prefs.type_overrides as Record<string, boolean> | null;
    if (typeOverrides && type in typeOverrides) {
      return typeOverrides[type]
        ? { allowed: true }
        : { allowed: false, reason: `user opted out of ${type}` };
    }

    // Check category-level toggle
    const categoryColumn = CATEGORY_PREFERENCE_COLUMNS[config.category];
    if (categoryColumn && prefs[categoryColumn] === false) {
      return { allowed: false, reason: `category ${config.category} disabled` };
    }

    return { allowed: true };
  }

  // ===================================================================
  // EMAIL RESOLUTION
  // ===================================================================

  /**
   * Resolve user's email address and display name.
   * Tries profile.contact_email first, falls back to auth.users.email.
   */
  private async resolveEmail(
    userId: string
  ): Promise<{ email: string; displayName: string } | null> {
    const admin = createAdminClient();

    // Profile: contact_email + display name
    const { data: profile } = await fromTable(admin, DATABASE_TABLES.PROFILES)
      .select('contact_email, display_name:name, username')
      .eq('id', userId)
      .single();

    const displayName = profile?.display_name || profile?.username || 'there';
    let email = profile?.contact_email ?? null;

    // Fallback to auth user email
    if (!email) {
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      email = authUser?.user?.email ?? null;
    }

    if (!email) {
      logger.warn('User has no email address', { userId }, LOG_SOURCE);
      return null;
    }

    return { email, displayName };
  }

  // ===================================================================
  // FREQUENCY CAPPING
  // ===================================================================

  /**
   * Check if sending this email would exceed the frequency cap.
   * Uses the notification_email_log table to count recent sends.
   */
  private async isWithinFrequencyCap(
    userId: string,
    type: string,
    cap: FrequencyCap
  ): Promise<boolean> {
    const admin = createAdminClient();

    try {
      // Check the tightest cap first (hourly > daily > weekly)
      if (cap.maxPerHour) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count } = await fromTable(admin, DATABASE_TABLES.NOTIFICATION_EMAIL_LOG)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('notification_type', type)
          .gte('sent_at', oneHourAgo);

        if ((count ?? 0) >= cap.maxPerHour) {
          logger.debug('Hourly cap hit', { userId, type, cap: cap.maxPerHour }, LOG_SOURCE);
          return false;
        }
      }

      if (cap.maxPerDay) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await fromTable(admin, DATABASE_TABLES.NOTIFICATION_EMAIL_LOG)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('notification_type', type)
          .gte('sent_at', oneDayAgo);

        if ((count ?? 0) >= cap.maxPerDay) {
          logger.debug('Daily cap hit', { userId, type, cap: cap.maxPerDay }, LOG_SOURCE);
          return false;
        }
      }

      if (cap.maxPerWeek) {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await fromTable(admin, DATABASE_TABLES.NOTIFICATION_EMAIL_LOG)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('notification_type', type)
          .gte('sent_at', oneWeekAgo);

        if ((count ?? 0) >= cap.maxPerWeek) {
          logger.debug('Weekly cap hit', { userId, type, cap: cap.maxPerWeek }, LOG_SOURCE);
          return false;
        }
      }

      return true;
    } catch (err) {
      // If the log table doesn't exist yet, allow sending (fail open)
      logger.warn(
        'Frequency cap check failed — allowing send',
        { userId, type, error: err instanceof Error ? err.message : err },
        LOG_SOURCE
      );
      return true;
    }
  }

  /**
   * Record that an email was sent for frequency cap tracking.
   */
  private async recordDelivery(userId: string, type: string): Promise<void> {
    try {
      const admin = createAdminClient();

      await fromTable(admin, DATABASE_TABLES.NOTIFICATION_EMAIL_LOG).insert({
        user_id: userId,
        notification_type: type,
        sent_at: new Date().toISOString(),
      });
    } catch (err) {
      // Non-fatal — if logging fails, the email was still sent
      logger.warn(
        'Failed to record email delivery',
        { userId, type, error: err instanceof Error ? err.message : err },
        LOG_SOURCE
      );
    }
  }

  // ===================================================================
  // TEMPLATE RESOLUTION
  // ===================================================================

  /**
   * Generate email content by dispatching to the appropriate template.
   * Returns null if no template is found for the given type.
   */
  private generateEmail(
    type: string,
    _config: NotificationTypeConfig,
    data: Record<string, unknown>
  ): { subject: string; html: string; text: string } | null {
    const displayName = (data.displayName as string) || 'there';
    const unsubscribeUrl = `${APP_URL}/settings/notifications`;

    // --- Welcome ---
    if (type === 'welcome') {
      return welcomeTemplate({
        displayName,
        dashboardUrl: `${APP_URL}/dashboard`,
        profileUrl: `${APP_URL}/dashboard/info/edit`,
        walletUrl: `${APP_URL}${ENTITY_REGISTRY['wallet'].basePath}`,
        createUrl: `${APP_URL}/dashboard`,
        unsubscribeUrl,
      });
    }

    // --- Milestones ---
    const milestoneMap: Record<string, MilestoneType> = {
      milestone_first_entity: 'first_entity',
      milestone_first_payment: 'first_payment',
      milestone_first_view: 'first_view',
      milestone_profile_complete: 'profile_complete',
      milestone_published: 'entity_published',
    };
    if (type in milestoneMap) {
      return milestoneTemplate({
        displayName,
        milestoneType: milestoneMap[type],
        detail: data.entityTitle as string | undefined,
        dashboardUrl: (data.dashboardUrl as string) || `${APP_URL}/dashboard`,
        unsubscribeUrl,
      });
    }

    // --- Weekly digest ---
    if (type === 'weekly_digest') {
      return buildWeeklyDigestEmail(displayName, data, {
        dashboardUrl: `${APP_URL}/dashboard`,
        chatUrl: `${APP_URL}/dashboard/cat`,
        unsubscribeUrl,
      });
    }

    // --- Group activity ---
    const groupMap: Record<string, GroupActivityType> = {
      group_invite: 'invite',
      proposal_created: 'proposal',
      vote_reminder: 'vote_reminder',
      proposal_resolved: 'proposal_resolved',
    };
    if (type in groupMap) {
      return groupActivityTemplate({
        displayName,
        activityType: groupMap[type],
        groupName: (data.groupName as string) || 'your group',
        groupUrl: (data.groupUrl as string) || `${APP_URL}${ENTITY_REGISTRY['group'].basePath}`,
        invitedBy: data.invitedBy as string | undefined,
        proposalTitle: data.proposalTitle as string | undefined,
        proposalUrl: data.proposalUrl as string | undefined,
        votingEnds: data.votingEnds as string | undefined,
        outcome: data.outcome as 'passed' | 'failed' | undefined,
        votesFor: data.votesFor as number | undefined,
        votesAgainst: data.votesAgainst as number | undefined,
        unsubscribeUrl,
      });
    }

    // --- Re-engagement ---
    const reengagementMap: Record<string, ReengagementStage> = {
      dormant_14d: '14d',
      dormant_30d: '30d',
      dormant_60d: '60d',
      dormant_90d: '90d',
    };
    if (type in reengagementMap) {
      return reengagementTemplate({
        displayName,
        stage: reengagementMap[type],
        entityTitle: data.entityTitle as string | undefined,
        recentViews: data.recentViews as number | undefined,
        dashboardUrl: `${APP_URL}/dashboard`,
        entityUrl: data.entityUrl as string | undefined,
        exploreUrl: `${APP_URL}/discover`,
        unsubscribeUrl,
      });
    }

    // No matching template
    logger.warn(`No email template for notification type: ${type}`, { type }, LOG_SOURCE);
    return null;
  }
}

/**
 * Map the digest builder's output (digestBuilder.ts WeeklyDigestData) onto
 * the weekly-digest template's input. The two shapes drifted unnoticed —
 * the digest pipeline shipped unscheduled and was never exercised, so the
 * mismatches (object suggestions vs string[], totalPaymentsReceived vs
 * payments) surfaced only when the cron was finally installed 2026-06.
 * All digest→email field mapping lives HERE, covered by unit tests.
 *
 * Exported for tests; production callers go through sendNotificationEmail.
 */
export function buildWeeklyDigestEmail(
  displayName: string,
  data: Record<string, unknown>,
  urls: { dashboardUrl: string; chatUrl: string; unsubscribeUrl: string }
): { subject: string; html: string; text: string } {
  const stats = (data.stats ?? {}) as {
    totalViews?: number;
    totalPaymentsReceived?: number;
    paymentAmountBtc?: number;
    newFollowers?: number;
    newMessages?: number;
  };
  // Tolerate both shapes: the builder emits {text, actionLabel, actionUrl}
  // objects; plain strings also render (the template shows text only).
  const rawSuggestions = data.suggestions as Array<string | { text: string }> | undefined;

  return weeklyDigestTemplate({
    displayName,
    stats: {
      views: stats.totalViews,
      payments: stats.totalPaymentsReceived,
      amountBtc: stats.paymentAmountBtc ? displayBTC(stats.paymentAmountBtc) : undefined,
      newFollowers: stats.newFollowers,
      newMessages: stats.newMessages,
    },
    topEntities: data.topEntities as EntityPerformance[] | undefined,
    suggestions: rawSuggestions?.map(s => (typeof s === 'string' ? s : s.text)),
    ...urls,
  });
}
