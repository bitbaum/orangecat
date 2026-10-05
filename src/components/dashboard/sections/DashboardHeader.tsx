'use client';

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
function isPlaceholderName(name?: string | null, username?: string | null): boolean {
  if (name === 'User') {
    return true;
  }
  if (username && /^user_[0-9a-f]{8}$/.test(username)) {
    return true;
  }
  return false;
}

/** The one line under the greeting: what is waiting on the person, if anything. */
export function dashboardStatusLine(waiting: number, drafts: number): string {
  const parts: string[] = [];
  if (waiting > 0) {
    parts.push(`${waiting} ${waiting === 1 ? 'thing needs' : 'things need'} you`);
  }
  if (drafts > 0) {
    parts.push(`${drafts} unpublished ${drafts === 1 ? 'draft' : 'drafts'}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Nothing is waiting on you.';
}

interface DashboardHeaderProps {
  profile: {
    name?: string | null;
    username?: string | null;
  } | null;
  /** Actions the Cat proposed that wait for a yes or no. */
  waiting: number;
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
  return (
    <header className="min-w-0">
      <h1 className="font-heading text-2xl leading-tight text-fg-primary sm:text-3xl">
        Welcome back{name ? `, ${name}` : ''}
      </h1>
      <p className="mt-1 text-sm text-fg-secondary">{dashboardStatusLine(waiting, totalDrafts)}</p>
    </header>
  );
}

export default DashboardHeader;
