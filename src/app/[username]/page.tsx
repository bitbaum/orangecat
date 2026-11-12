import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';

// This route only redirects or 404s, so the 404 is the one time its title is
// seen. Without it, a mistyped address (every unknown single segment lands
// here) hydrates back to the home page's title: the root not-found's metadata
// reaches the served HTML but not the payload the browser hydrates from.
export const metadata: Metadata = { title: 'Page not found' };

/**
 * Username shortlink: /<username> → /profiles/<username>.
 *
 * Profiles are the platform's identity primitive; a share-friendly
 * orangecat.ch/anja must reach them. This page only resolves + redirects —
 * /profiles/[username] stays the canonical URL (SSOT for rendering, SEO,
 * OG cards).
 *
 * Shadowing safety: Next.js matches static segments before dynamic ones, so
 * every existing top-level route (/about, /discover, /create, route-group
 * pages, …) wins over this catch-all — this only receives single segments
 * that would previously 404. A username that collides with a static route
 * simply isn't reachable via the shortlink (its /profiles/<username> URL
 * always works). Verified by `npm run audit:routes`.
 */
export default async function UsernameShortlinkPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  // Usernames may contain URL-encoded characters (e.g. %40 for '@').
  const decoded = decodeURIComponent(username);

  // Mirror the /profiles/me convention at the top level.
  if (decoded === 'me') {
    redirect(ROUTES.PROFILES.ME);
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('username')
    .eq('username', decoded)
    .maybeSingle();
  const match = data as { username: string | null } | null;

  if (!match?.username) {
    notFound();
  }

  redirect(ROUTES.PROFILES.VIEW(encodeURIComponent(match.username)));
}
