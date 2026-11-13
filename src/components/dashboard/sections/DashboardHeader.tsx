'use client';

import { isMintedHandle } from '@/config/usernames';

// Usernames are stored lowercase; display names from `profile.name` may already
// be properly cased. Capitalize the first character so the greeting reads
// "Welcome back, Mao" rather than "Welcome back, mao".
function capitalizeName(name: string): string {
  if (!name) {
    return name;
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Anonymous Supabase signups land in profiles with name='User' and
// username='user_<8chars>' (the handle_new_user trigger's last-resort
// fallback when there's no email and no OAuth metadata). Treating those
// as a real name produces "Welcome back, User" — impersonal and a tell
// that the platform doesn't actually know who you are. Detect the
// placeholder pattern and skip the comma+name instead.
export function isPlaceholderName(name?: string | null, username?: string | null): boolean {
  if (name?.trim() && name !== 'User') {
    return false;
  }
  if (name === 'User') {
    return true;
  }
  if (isMintedHandle(username)) {
    return true;
  }
  return false;
}

/** What the line says to someone the platform does not know yet, with nothing waiting. */
export const FIRST_RUN_LINE =
  'Say what you want to do. Your Cat drafts it and asks before anything goes live.';

/**
 * The one line under the greeting: what is waiting on the person, if anything.
 * With nothing waiting it says nothing to a named account — "No pending Cat
 * approvals." spoke to someone who already had things — and, to a person who
 * has not even told us their name, it says what to do first.
 */
export function dashboardStatusLine(
  waiting: number | undefined,
  drafts: number,
  isNamed = true
): string | null {
  const parts: string[] = [];
  if (waiting === undefined) {
    parts.push('Checking Cat approvals…');
  } else if (waiting > 0) {
    parts.push(`${waiting} pending Cat ${waiting === 1 ? 'approval' : 'approvals'}`);
  }
  if (drafts > 0) {
    parts.push(`${drafts} unpublished ${drafts === 1 ? 'draft' : 'drafts'}`);
  }
  if (parts.length > 0) {
    return parts.join(' · ');
  }
  return isNamed ? null : FIRST_RUN_LINE;
}

interface DashboardHeaderProps {
  profile: {
    name?: string | null;
    username?: string | null;
  } | null;
  /** Actions the Cat proposed that wait for a yes or no. */
  waiting: number | undefined;
  totalDrafts: number;
}

/**
 * The greeting and one line that answers "does anything need me?". No card,
 * no icon tile, no project count: the count said nothing a person could act
 * on, and the box around two lines of text cost a third of a phone screen.
 */
export function DashboardHeader({ profile, waiting, totalDrafts }: DashboardHeaderProps) {
  const name =
    profile &&
    (profile.name || profile.username) &&
    !isPlaceholderName(profile.name, profile.username)
      ? capitalizeName(profile.name || profile.username || '')
      : null;
  const status = dashboardStatusLine(waiting, totalDrafts, !!name);
  return (
    <header className="min-w-0">
      <h1 className="font-heading text-2xl leading-tight text-fg-primary sm:text-3xl">
        {/* No name yet means we do not know this person: "back" would be a
            claim about someone who may have arrived ten seconds ago. */}
        {name ? `Welcome back, ${name}` : 'Welcome'}
      </h1>
      {status && <p className="mb-0 mt-1 text-sm text-fg-secondary">{status}</p>}
    </header>
  );
}

export default DashboardHeader;
