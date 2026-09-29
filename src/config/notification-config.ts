/**
 * Notification Configuration - Single Source of Truth
 *
 * Every notification type, its email behavior, frequency caps, and subject lines.
 * The Cat speaks through these emails — subject lines should feel personal, not corporate.
 *
 * Categories:
 * - transactional: Always sent, can't opt out (security, verification)
 * - economic: Payment/contribution events (per-event, high priority)
 * - social: Follows, messages, mentions (batchable)
 * - group: Proposals, votes, members (per-event)
 * - progress: Milestones, digests, onboarding (scheduled)
 * - reengagement: Dormant user outreach
 *
 * Created: 2026-03-27
 */

// =====================================================================
// TYPES
// =====================================================================

export type NotificationCategory =
  | 'transactional'
  | 'economic'
  | 'social'
  | 'group'
  | 'progress'
  | 'reengagement';

export interface FrequencyCap {
  maxPerHour?: number;
  maxPerDay?: number;
  maxPerWeek?: number;
}

export interface NotificationTypeConfig {
  /** Unique notification type key */
  type: string;
  /** Which category this belongs to */
  category: NotificationCategory;
  /** Can this type trigger an email? */
  emailEnabled: boolean;
  /** Is email on by default for new users? */
  emailDefaultOn: boolean;
  /** Can user disable email for this type? (false = always sent) */
  canOptOut: boolean;
  /** Max sends per time period */
  frequencyCap?: FrequencyCap;
  /** Can be batched into a digest email? */
  batchable: boolean;
  /** Generate the email subject line. Cat voice when appropriate. */
  subject: (data: Record<string, unknown>) => string;
  /** Should the email body use Cat personality? */
  catVoice: boolean;
  /** Human-readable label for preferences UI */
  label: string;
  /** Short description for preferences UI */
  description: string;
}

// =====================================================================
// NOTIFICATION CONFIG REGISTRY
// =====================================================================

export const NOTIFICATION_CONFIG: Record<string, NotificationTypeConfig> = {
  // ==================================================================
  // TRANSACTIONAL — Always sent, can't opt out
  // ==================================================================

  welcome: {
    type: 'welcome',
    category: 'transactional',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: false,
    batchable: false,
    subject: () => 'Welcome to OrangeCat — your Cat is ready',
    catVoice: true,
    label: 'Welcome email',
    description: 'Sent when you create your account',
  },

  email_verification: {
    type: 'email_verification',
    category: 'transactional',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: false,
    batchable: false,
    subject: () => 'Verify your email address',
    catVoice: false,
    label: 'Email verification',
    description: 'Confirm your email to activate your account',
  },

  password_reset: {
    type: 'password_reset',
    category: 'transactional',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: false,
    batchable: false,
    subject: () => 'Reset your password',
    catVoice: false,
    label: 'Password reset',
    description: 'Link to set a new password',
  },

  security_alert: {
    type: 'security_alert',
    category: 'transactional',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: false,
    batchable: false,
    subject: data => `Security alert: new sign-in from ${data.device || 'unknown device'}`,
    catVoice: false,
    label: 'Security alerts',
    description: 'New device logins and suspicious activity',
  },

  // ==================================================================
  // ECONOMIC — Per-event, high priority
  // ==================================================================

  payment_received: {
    type: 'payment_received',
    category: 'economic',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data =>
      `You received ${data.amount || 'a payment'} for ${data.entityTitle || 'your listing'}`,
    catVoice: true,
    label: 'Payment received',
    description: 'Someone paid for your product, service, or listing',
  },

  payment_sent_confirmation: {
    type: 'payment_sent_confirmation',
    category: 'economic',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data => `Payment confirmed: ${data.amount || ''} to ${data.recipientName || 'seller'}`,
    catVoice: false,
    label: 'Payment confirmations',
    description: 'Confirmation that your payment went through',
  },

  contribution_received: {
    type: 'contribution_received',
    category: 'economic',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data =>
      `${data.supporterName || 'Someone'} backed ${data.entityTitle || 'your project'} with ${data.amount || 'a contribution'}`,
    catVoice: true,
    label: 'Contributions received',
    description: 'Someone backed your project or cause',
  },

  order_status: {
    type: 'order_status',
    category: 'economic',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data =>
      `Your order ${data.status === 'shipped' ? 'has shipped' : data.status === 'delivered' ? 'was delivered' : `is now ${data.status || 'updated'}`}`,
    catVoice: false,
    label: 'Order updates',
    description: 'Shipping and delivery status changes',
  },

  goal_reached: {
    type: 'goal_reached',
    category: 'economic',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data => `${data.entityTitle || 'Your project'} hit its funding goal!`,
    catVoice: true,
    label: 'Funding goal reached',
    description: 'Your project or cause reached its target',
  },

  // ==================================================================
  // SOCIAL — Batchable, lower urgency
  // ==================================================================

  new_message: {
    type: 'new_message',
    category: 'social',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    frequencyCap: { maxPerHour: 1, maxPerDay: 10 },
    batchable: false,
    subject: data => `${data.senderName || 'Someone'} sent you a message`,
    catVoice: false,
    label: 'Direct messages',
    description: 'New messages in your inbox (max 1 email/hour)',
  },

  new_follower: {
    type: 'new_follower',
    category: 'social',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    frequencyCap: { maxPerDay: 1 },
    batchable: true,
    subject: data =>
      data.count && Number(data.count) > 1
        ? `${data.count} new people followed you`
        : `${data.followerName || 'Someone'} started following you`,
    catVoice: true,
    label: 'New followers',
    description: 'When someone follows your profile (batched daily)',
  },

  mention: {
    type: 'mention',
    category: 'social',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    frequencyCap: { maxPerDay: 5 },
    batchable: true,
    subject: data =>
      `${data.mentionerName || 'Someone'} mentioned you${data.context ? ` in ${data.context}` : ''}`,
    catVoice: false,
    label: 'Mentions',
    description: 'When someone tags you in a post or comment (batched daily)',
  },

  comment: {
    type: 'comment',
    category: 'social',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    frequencyCap: { maxPerDay: 5 },
    batchable: true,
    subject: data =>
      `${data.commenterName || 'Someone'} commented on ${data.entityTitle || 'your post'}`,
    catVoice: false,
    label: 'Comments',
    description: 'New comments on your entities (batched daily)',
  },

  // ==================================================================
  // GROUP — Per-event
  // ==================================================================

  group_invite: {
    type: 'group_invite',
    category: 'group',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data => `You're invited to join ${data.groupName || 'a group'}`,
    catVoice: true,
    label: 'Group invitations',
    description: 'When someone invites you to a group',
  },

  proposal_created: {
    type: 'proposal_created',
    category: 'group',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data =>
      `New proposal in ${data.groupName || 'your group'}: ${data.proposalTitle || 'needs your vote'}`,
    catVoice: false,
    label: 'New proposals',
    description: 'When a new proposal is created in your group',
  },

  vote_reminder: {
    type: 'vote_reminder',
    category: 'group',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    frequencyCap: { maxPerDay: 3 },
    batchable: false,
    subject: data =>
      `Voting closes soon: ${data.proposalTitle || 'a proposal'} in ${data.groupName || 'your group'}`,
    catVoice: true,
    label: 'Vote reminders',
    description: 'Reminder 24h before a voting deadline',
  },

  proposal_resolved: {
    type: 'proposal_resolved',
    category: 'group',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data =>
      `Proposal ${data.outcome === 'passed' ? 'passed' : 'did not pass'}: ${data.proposalTitle || ''}`,
    catVoice: false,
    label: 'Proposal results',
    description: 'When a proposal vote is finalized',
  },

  member_joined: {
    type: 'member_joined',
    category: 'group',
    emailEnabled: true,
    emailDefaultOn: false,
    canOptOut: true,
    frequencyCap: { maxPerDay: 1 },
    batchable: true,
    subject: data =>
      data.count && Number(data.count) > 1
        ? `${data.count} new members joined ${data.groupName || 'your group'}`
        : `${data.memberName || 'Someone'} joined ${data.groupName || 'your group'}`,
    catVoice: false,
    label: 'New members',
    description: 'When someone joins a group you manage (batched daily)',
  },

  treasury_received: {
    type: 'treasury_received',
    category: 'group',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data => `${data.groupName || 'Your group'} received ${data.amount || 'funds'}`,
    catVoice: true,
    label: 'Treasury activity',
    description: 'When your group receives funds',
  },

  // ==================================================================
  // PROGRESS — Milestones & digests
  // ==================================================================

  weekly_digest: {
    type: 'weekly_digest',
    category: 'progress',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    frequencyCap: { maxPerWeek: 1 },
    batchable: false,
    subject: () => 'Your week on OrangeCat',
    catVoice: true,
    label: 'Weekly digest',
    description: 'A summary of your activity and what you missed',
  },

  milestone_first_entity: {
    type: 'milestone_first_entity',
    category: 'progress',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data => `You created your first ${data.entityType || 'listing'} — nice work`,
    catVoice: true,
    label: 'First entity milestone',
    description: 'Celebration when you create your first listing',
  },

  milestone_first_payment: {
    type: 'milestone_first_payment',
    category: 'progress',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: () => 'You received your first payment on OrangeCat',
    catVoice: true,
    label: 'First payment milestone',
    description: 'Celebration when you get your first payment',
  },

  milestone_first_view: {
    type: 'milestone_first_view',
    category: 'progress',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data => `${data.entityTitle || 'Your listing'} got its first view`,
    catVoice: true,
    label: 'First view milestone',
    description: 'When your entity gets its first visitor',
  },

  milestone_profile_complete: {
    type: 'milestone_profile_complete',
    category: 'progress',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: () => 'Your profile is 100% complete',
    catVoice: true,
    label: 'Profile complete milestone',
    description: 'When you fill out every profile field',
  },

  milestone_published: {
    type: 'milestone_published',
    category: 'progress',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: data => `${data.entityTitle || 'Your listing'} is live — the world can see it now`,
    catVoice: true,
    label: 'Entity published',
    description: 'Confirmation when your entity goes live',
  },

  // ==================================================================
  // RE-ENGAGEMENT — Dormant users
  // ==================================================================

  dormant_14d: {
    type: 'dormant_14d',
    category: 'reengagement',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: () => 'Your Cat misses you — here is what you missed',
    catVoice: true,
    label: '14-day check-in',
    description: 'Sent after 14 days of inactivity',
  },

  dormant_30d: {
    type: 'dormant_30d',
    category: 'reengagement',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: () => 'Still there? A quick update from OrangeCat',
    catVoice: true,
    label: '30-day check-in',
    description: 'Sent after 30 days of inactivity',
  },

  dormant_60d: {
    type: 'dormant_60d',
    category: 'reengagement',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: () => 'Things have changed — come take a look',
    catVoice: true,
    label: '60-day check-in',
    description: 'Sent after 60 days of inactivity',
  },

  dormant_90d: {
    type: 'dormant_90d',
    category: 'reengagement',
    emailEnabled: true,
    emailDefaultOn: true,
    canOptOut: true,
    batchable: false,
    subject: () => 'One last meow before we go quiet',
    catVoice: true,
    label: '90-day final check-in',
    description: 'Last outreach before stopping re-engagement emails',
  },
};

/** Check if a notification type is transactional (can't opt out) */
export function isTransactional(type: string): boolean {
  const config = NOTIFICATION_CONFIG[type];
  return config?.category === 'transactional' || config?.canOptOut === false;
}
