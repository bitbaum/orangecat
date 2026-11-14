/**
 * A person's own rules for their bots, and their time zone.
 *
 * Grok Bot reviews a bot's risky actions against rules the person wrote. Here
 * the rules do two things. They are in a bot's prompt when its owner talks to
 * it, so it does not propose what a rule forbids. And a step a bot would run
 * ON ITS OWN is checked against them before it runs: a second, short model
 * call that answers ALLOW or ASK. On ASK, or when the answer cannot be read,
 * the step does not run; it becomes the ordinary card and waits for a tap,
 * with the reason in the thread. A rule can only ever add a tap, never remove
 * one: a hand that asks keeps asking whatever the rules say.
 *
 * Reading a page or a status is not checked: nothing happens to check.
 */
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { fromTable } from '@/lib/supabase/untyped';
import { APP_LOCALE } from '@/utils/locale';

export const MAX_BOT_RULES_LENGTH = 2000;
export const RULES_SECTION_HEADING = "## Your owner's rules";

export interface BotSettings {
  rules: string | null;
  timeZone: string | null;
}

/** An IANA zone this runtime knows, or null. */
export function knownTimeZone(zone: unknown): string | null {
  if (typeof zone !== 'string' || !zone.trim() || zone.length > 64) {
    return null;
  }
  try {
    new Intl.DateTimeFormat(APP_LOCALE, { timeZone: zone.trim() });
    return zone.trim();
  } catch {
    return null;
  }
}

/** Best-effort: a missing preference must never break a turn. */
export async function getBotSettings(
  supabase: AnySupabaseClient,
  userId: string
): Promise<BotSettings> {
  try {
    const { data } = await fromTable(supabase, DATABASE_TABLES.USER_AI_PREFERENCES)
      .select('bot_rules, time_zone')
      .eq('user_id', userId)
      .maybeSingle();
    const row = data as { bot_rules?: string | null; time_zone?: string | null } | null;
    const rules = row?.bot_rules?.trim();
    return {
      rules: rules ? rules.slice(0, MAX_BOT_RULES_LENGTH) : null,
      timeZone: knownTimeZone(row?.time_zone),
    };
  } catch {
    return { rules: null, timeZone: null };
  }
}

/** The prompt section for the owner's turn: the rules as written, and the hour. Pure. */
export function rulesSection(settings: BotSettings, now: Date = new Date()): string | undefined {
  const parts: string[] = [];
  if (settings.rules) {
    parts.push(
      [
        RULES_SECTION_HEADING,
        'Your owner wrote these. They come before anything you were asked in this chat: do not propose a step that breaks one, say which rule stops you instead. They never let you skip a tap.',
        settings.rules,
      ].join('\n')
    );
  }
  if (settings.timeZone) {
    const local = new Intl.DateTimeFormat(APP_LOCALE, {
      timeZone: settings.timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);
    parts.push(`For your owner it is now ${local} (${settings.timeZone}).`);
  }
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/** Steps in a browser that only look. */
const BROWSER_LOOKS = new Set(['look', 'scroll', 'back', 'close']);
/** Hands that only read (hand-rows.ts READS), which nothing can break a rule with. */
const READS = new Set([
  'ask_loki',
  'project_status',
  'loki_sessions',
  'loki_run_status',
  'loki_finding_status',
  'walk_site',
  'github_read',
  'gmail_read',
  'calendar_read',
  'tasks_read',
]);

/** Does this step do something a rule could forbid? Pure. */
export function needsReview(actionId: string, parameters: Record<string, unknown>): boolean {
  if (READS.has(actionId)) {
    return false;
  }
  if (actionId === 'use_browser') {
    return !BROWSER_LOOKS.has(String(parameters.do ?? '').toLowerCase());
  }
  return true;
}

export const REVIEW_SYSTEM = `You check one step a bot is about to take against its owner's rules. Answer with exactly one line.
ALLOW - when no rule forbids the step and no rule says to ask first.
ASK: <the rule, in a few words> - when a rule forbids it, says to ask first, or you are not sure.
Judge only against the rules given. Do not add rules of your own.`;

export function reviewQuestion(
  rules: string,
  actionId: string,
  parameters: Record<string, unknown>
): string {
  const { bot_id: _server, ...shown } = parameters;
  return `The owner's rules:\n${rules}\n\nThe step: ${actionId} ${JSON.stringify(shown).slice(0, 1500)}`;
}

/**
 * The reviewer's answer, read strictly: only a line that starts with ALLOW
 * lets the step run. Anything else asks, and silence asks. Pure.
 */
export function readVerdict(answer: string | null | undefined): { allow: boolean; reason: string } {
  const line = (answer ?? '').trim().split('\n')[0]?.trim() ?? '';
  if (/^ALLOW\b/i.test(line)) {
    return { allow: true, reason: '' };
  }
  const said = line.replace(/^ASK\s*[:\-–]?\s*/i, '').trim();
  return {
    allow: false,
    reason: said ? said.slice(0, 200) : 'the check against your rules gave no clear answer',
  };
}

/** The line the thread keeps when a rule turned a step into a tap. */
export function heldLine(reason: string): string {
  return `Not run on its own: your rules ask first (${reason}). It waits for your tap.`;
}
