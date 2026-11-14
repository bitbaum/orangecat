/**
 * GET /api/og/profile/[username] — share card for a user profile.
 *
 * Returns 1200×630 PNG designed for WhatsApp / Slack / Telegram / X /
 * LinkedIn link previews. Shows the actor's avatar, name and bio snippet,
 * so the preview tells the reader who this is, not just "OrangeCat link."
 *
 * Public, unauthenticated — share cards must render for whoever opens
 * the link, including users not logged into OrangeCat.
 *
 * Cache 1h at the edge so the social previewer can hit us hard at
 * share-time without overloading the DB.
 *
 * A name with no profile gets the plain brand card. It used to get a card
 * built from the URL itself, so any made-up text ("Satoshi Nakamoto -
 * official") rendered as an OrangeCat profile on an orangecat.ch image.
 *
 * Created: 2026-06-03
 */

import { ImageResponse } from 'next/og';
import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { APP_NAME, APP_KICKER, SITE_URL } from '@/config/brand';
import { CAT_AVATAR_PATH, isCatUsername } from '@/config/cat-identity';
import { OG_SIZE, OG_COLOR, Avatar, BrandFooter } from '@/lib/og/branding';
import { brandOnlyCard } from '@/lib/og/project-card';
import { shareLine } from '@/lib/og/share-line';

// Must be a string literal — Next.js static-analyzes `runtime` at build
// time and cannot resolve imported identifiers.
export const runtime = 'edge';
export const contentType = 'image/png';

interface RouteContext {
  params: Promise<{ username: string }>;
}

interface ProfileRow {
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { username } = await params;
  const supabase = await createServerClient();

  const { data } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('name, username, bio, avatar_url')
    .eq('username', username)
    .maybeSingle();

  const profile = data as ProfileRow | null;
  if (!profile) {
    return brandOnlyCard();
  }

  const displayName = profile.name || profile.username || username;
  // The Cat's one face (config/cat-identity.ts), not the "C" a picture-less
  // profile gets.
  const catFace = isCatUsername(profile.username) ? `${SITE_URL}${CAT_AVATAR_PATH}` : null;
  const handle = profile.username ? `@${profile.username}` : '';
  const bio = shareLine(profile.bio);

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: 64,
        background: OG_COLOR.surface,
        fontFamily: 'system-ui, sans-serif',
        color: OG_COLOR.text,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 40, flex: 1 }}>
        <Avatar src={catFace ?? profile.avatar_url} fallback={displayName} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
          <span
            style={{
              display: 'flex',
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            {displayName}
          </span>
          {handle && (
            <span
              style={{
                display: 'flex',
                fontSize: 28,
                color: OG_COLOR.textMuted,
              }}
            >
              {handle}
            </span>
          )}
          {bio && (
            <span
              style={{
                display: 'flex',
                fontSize: 24,
                color: OG_COLOR.textMuted,
                lineHeight: 1.4,
                marginTop: 8,
              }}
            >
              {bio}
            </span>
          )}
        </div>
      </div>
      {/* A "public / Profile" pill sat here, telling the reader nothing. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <BrandFooter wordmark={APP_NAME} tagline={APP_KICKER} />
      </div>
    </div>,
    { ...OG_SIZE, headers: { 'cache-control': 'public, max-age=3600, s-maxage=3600' } }
  );
}
