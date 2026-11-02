/**
 * OrangeCat's bots reaching the owner on Telegram — through Loki's ONE notify
 * gateway, never a Telegram call of their own.
 *
 * The owner, 2026-11-02: Telegram should be "the way for any bot of mine to
 * contact me", and "if you send me something … I should read it and click one
 * time". Loki owns that contract (loki: src/lib/notify/policy.ts): a notice
 * with a button may reach the phone, rate-limited and quiet at night; a notice
 * without one is kept in Loki's list. So this file only decides WHAT to say and
 * which ONE link does it; Loki decides whether and when.
 *
 * Only the owner's own news goes this way (OPS_NOTIFY_USER_ID — the operator
 * account, the same person Loki's operator is). Every other OrangeCat user
 * keeps hearing through in-app notifications. Signed with the shared rail
 * secret (signed-post.ts); inert until it is set. Never throws.
 */
import { SITE_URL } from '@/config/brand';
import { OPS_NOTIFY_USER_ID } from '@/services/cat/ops-alert';
import { logger } from '@/utils/logger';
import { lokiRailConfigured, postSignedToLoki } from './signed-post';

const LOKI_NOTIFY_URL =
  process.env.LOKI_NOTIFY_URL || 'https://loki.orangecat.ch/api/orangecat/notify';

export interface OwnerNotice {
  /** Which OrangeCat bot speaks: "cat", "cat-watch", "ops". */
  source: string;
  title: string;
  body?: string;
  /** The one tap. Omit only for things that belong in Loki's list, not the phone. */
  action?: { label: string; path: string };
  urgency?: 'now' | 'today';
  /** Same key = same incident on Loki's side (deduped, reminders back off). */
  key?: string;
}

/** The wire body Loki's /api/orangecat/notify accepts. Pure, for tests. */
export function ownerNoticeBody(n: OwnerNotice, siteUrl = SITE_URL) {
  const base = siteUrl.replace(/\/$/, '');
  return {
    source: n.source,
    title: n.title.slice(0, 140),
    ...(n.body ? { body: n.body.slice(0, 600) } : {}),
    actions: n.action
      ? [{ label: n.action.label.slice(0, 24), url: `${base}${n.action.path}` }]
      : [],
    urgency: n.urgency ?? 'today',
    ...(n.key ? { key: n.key } : {}),
  };
}

/** Tell the owner via Loki — only when `userId` IS the owner. */
export async function notifyOwnerViaLoki(userId: string, notice: OwnerNotice): Promise<void> {
  if (userId !== OPS_NOTIFY_USER_ID || !lokiRailConfigured()) {
    return;
  }
  const result = await postSignedToLoki(LOKI_NOTIFY_URL, ownerNoticeBody(notice));
  if (!result.ok) {
    logger.warn(
      'owner notice did not reach Loki',
      { status: result.status, source: notice.source },
      'LokiNotify'
    );
  }
}
