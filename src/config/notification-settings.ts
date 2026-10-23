/** Email categories and supported digest choices shared by the notification settings UI. */
import type { DigestFrequency, NotificationPreferences } from '@/types/notification-preferences';

export const CATEGORIES: Array<{
  key: keyof Pick<
    NotificationPreferences,
    'economic_emails' | 'social_emails' | 'group_emails' | 'progress_emails' | 'reengagement_emails'
  >;
  label: string;
  description: string;
}> = [
  {
    key: 'economic_emails',
    label: 'Payments & orders',
    description: 'Receipts, contribution confirmations, order status changes.',
  },
  {
    key: 'social_emails',
    label: 'Social',
    description: 'Follows, mentions, comments, direct messages.',
  },
  {
    key: 'group_emails',
    label: 'Organizations',
    description: 'Proposals, votes, members joining, treasury activity.',
  },
  {
    key: 'progress_emails',
    label: 'Progress & digests',
    description: 'Onboarding tips, milestones, review reminders, the periodic digest.',
  },
  {
    key: 'reengagement_emails',
    label: 'Re-engagement',
    description: 'Outreach when you have not signed in for a while.',
  },
];

export const DIGEST_OPTIONS: Array<{ value: DigestFrequency; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'never', label: 'Never' },
];
