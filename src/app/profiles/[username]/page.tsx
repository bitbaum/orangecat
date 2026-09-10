import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { notFound, redirect, permanentRedirect } from 'next/navigation';
import ProfilePageClient from '@/components/profile/ProfilePageClient';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import { fetchProfileListingCounts } from '@/services/profile/listingCounts';
import { getPublicEconomicProfile } from '@/services/cat/economic-profile-public';
import { listArticlesByAuthor } from '@/services/articles/get-article';
import { safeJsonLdString } from '@/lib/seo/structured-data';
import type { ScalableProfile } from '@/services/profile/types';
import { mapProjectRow } from '@/types/project';
import { enrichProjectsWithSettledFunding } from '@/services/wallets/project-funding';
import { countActiveProfileWallets } from '@/services/wallets/countPublicWallets';
import { ROUTES } from '@/config/routes';
import { APP_NAME, APP_KICKER, SITE_URL } from '@/config/brand';
import { applyProfilePrivacy } from '@/config/profile-privacy';
import { resolveHistoricalUsername } from '@/domain/lightning-address/username-history';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { ownedProjectsFilter } from '@/domain/projects/service';
import { getUnclaimedOwnerBySlug } from '@/domain/profileClaims/unclaimed';
import { UnclaimedProfileView } from '@/components/claim/UnclaimedProfileView';
import { looseClient } from '@/lib/supabase/untyped';

interface PageProps {
  params: Promise<{ username: string }>;
}

/**
 * Generate metadata for public profile pages
 * This enables SEO and social media preview cards
 *
 * Handles /profiles/me by resolving to the actual username
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createServerClient();

  // Handle /profiles/me → resolve to actual username
  let targetUsername = username;
  if (username === 'me') {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Get username for current user
      const { data: userProfileData } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('username')
        .eq('id', user.id)
        .single();
      const userProfile = userProfileData as { username: string | null } | null;

      targetUsername = userProfile?.username || user.id;
    } else {
      // Not authenticated - return generic metadata
      return {
        title: 'My Profile',
        description: `View your profile on ${APP_NAME}. Exchange, fund, lend, invest, and connect with others.`,
      };
    }
  }

  const { data: profileData } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('name, bio, avatar_url, username')
    .eq('username', targetUsername)
    .single();

  const profile = profileData as {
    name: string | null;
    bio: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
  if (!profile) {
    const unclaimed = await getUnclaimedOwnerBySlug(supabase, targetUsername);
    if (unclaimed) {
      return {
        title: `${unclaimed.name} · ${APP_NAME}`,
        description: `${unclaimed.name} has a page on ${APP_NAME} that hasn’t been claimed yet.`,
        // NOT indexed until its subject has accepted it (ADR-0005 D4). Public
        // on-platform and by link; invisible to search engines until she says
        // yes — that is the line between a growth mechanic and putting a real
        // person's name into Google without asking.
        robots: { index: false, follow: false },
      };
    }
    return {
      title: 'Profile Not Found',
      description: 'The profile you are looking for does not exist.',
    };
  }

  const displayName = profile.name || profile.username || targetUsername;
  const description =
    profile.bio ||
    `View ${displayName}'s profile on ${APP_NAME}. Explore their projects, services, and economic activity.`;
  // Dynamic share card with avatar + name + bio. See
  // src/app/api/og/profile/[username]/route.tsx.
  // encodeURIComponent: usernames containing '@' (we observed literal
  // webdev@example.com profiles live) need to be URL-escaped to produce
  // valid OG image / canonical URLs that crawlers and link unfurlers
  // accept. Without this the canonical URL contained a literal `@` and
  // some sitemap/canonical consumers tripped on it. AvatarLink and
  // messaging surfaces already use encodeURIComponent on the same field.
  const safeUsername = encodeURIComponent(profile.username || targetUsername);
  const ogImage = `${SITE_URL}/api/og/profile/${safeUsername}`;
  // Use actual username in URL, not "me" for better SEO
  const url = `${SITE_URL}/profiles/${safeUsername}`;

  return {
    title: displayName,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${displayName} on ${APP_NAME}`,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${displayName} on ${APP_NAME}` }],
      url,
      type: 'profile',
      siteName: APP_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} — ${APP_KICKER}`,
      description,
      images: [ogImage],
    },
  };
}

/**
 * Public Profile Page - Server Component
 *
 * This page is publicly accessible and server-side rendered for:
 * - SEO optimization
 * - Social media preview cards
 * - Fast initial page load
 * - Supports /profiles/me for current user's profile
 */
export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createServerClient();

  // Handle /profiles/me → load current user
  let targetUsername = username;
  if (username === 'me') {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // Not authenticated, redirect to login
      redirect(`${ROUTES.AUTH}?redirect=${ROUTES.PROFILES.ME}`);
    }

    // Get username for current user
    const { data: userProfileData } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username')
      .eq('id', user.id)
      .single();
    const userProfile = userProfileData as { username: string | null } | null;

    targetUsername = userProfile?.username || user.id;
  }

  // Fetch profile data server-side
  const { data: profileData, error: profileError } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('*')
    .eq('username', targetUsername)
    .single();
  // Supabase Row type and ScalableProfile diverge on narrow union fields (e.g. status);
  // both derive from the same table so the shape is compatible at runtime.
  const profile = profileData as unknown as ScalableProfile;

  if (profileError || !profile) {
    // Before 404ing, check whether this handle is one an account used to have.
    // Renaming the profiles that published their email local part would
    // otherwise dead-link every inbound URL pointing at the old handle — and
    // the person who lost the traffic would never find out. A permanent
    // redirect also tells search engines to move their index entry rather than
    // record a 404 against the account.
    const movedTo = await resolveHistoricalUsername(supabase, targetUsername);
    if (movedTo) {
      const { data: currentData } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('username')
        .eq('id', movedTo)
        .single();
      const current = currentData as { username: string | null } | null;
      if (current?.username) {
        permanentRedirect(ROUTES.PROFILES.VIEW(current.username));
      }
    }

    // ADR-0005 D7 — the slug of a person who has not accepted yet. Her studio
    // was shared under this address before she had an account, and the link
    // has to keep working: on claim the slug becomes her username, so this
    // same URL resolves to a real profile afterwards.
    const unclaimed = await getUnclaimedOwnerBySlug(supabase, targetUsername);
    if (unclaimed) {
      const { data: ownedProjects } = await looseClient(supabase)
        .from(getTableName('project'))
        .select('id, title, description')
        .eq('actor_id', unclaimed.actorId)
        .order('created_at', { ascending: false });

      return (
        <UnclaimedProfileView
          name={unclaimed.name}
          avatarUrl={unclaimed.avatarUrl}
          stewardUsername={unclaimed.stewardUsername}
          projects={
            (ownedProjects ?? []) as Array<{
              id: string;
              title: string;
              description: string | null;
            }>
          }
        />
      );
    }

    notFound();
  }

  // Fetch the projects this profile OWNS (by actor — a claimed page is owned
  // by its owner, created by the steward), excluding drafts and respecting
  // the show_on_profile setting.
  const ownerActor = await getOrCreateUserActor(profile.id);
  const { data: projectsData } = await supabase
    .from(getTableName('project'))
    .select(
      `
      id,
      title,
      description,
      category,
      tags,
      status,
      bitcoin_address,
      lightning_address,
      goal_amount,
      currency,
      raised_amount,
      cover_image_url,
      created_at,
      updated_at
    `
    )
    .or(ownedProjectsFilter(ownerActor.id, profile.id))
    .neq('status', 'draft') // Exclude drafts from public profile
    .neq('show_on_profile', false) // Respect user's visibility preference (null = true by default)
    .order('created_at', { ascending: false });
  // Honest funding figures from the settled ledger — the raised_amount column
  // is dead (never written), so profile stats would otherwise always read 0.
  const enrichedProjects = await enrichProjectsWithSettledFunding(
    supabase,
    (projectsData || []) as unknown as Array<
      Parameters<typeof mapProjectRow>[0] & { id: string; currency?: string | null }
    >
  );
  const projects = enrichedProjects.map(mapProjectRow);

  // Fetch follower count
  const { count: followerCount } = await supabase
    .from(DATABASE_TABLES.FOLLOWS)
    .select('*', { count: 'exact', head: true })
    .eq('following_id', profile.id);

  // Fetch following count
  const { count: followingCount } = await supabase
    .from(DATABASE_TABLES.FOLLOWS)
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', profile.id);

  // Was an RPC to `get_entity_wallets`, a function that exists in no migration
  // and returns PGRST202 in production — so this count was always 0 and the
  // Wallets tab was hidden from visitors for every profile without a legacy
  // address. See services/wallets/countPublicWallets.ts for the full note.
  const walletCount = await countActiveProfileWallets(profile.id);

  // A profile's legacy single bitcoin_address / lightning_address is a real way to
  // receive Bitcoin (the public donation card sends to exactly these), even though
  // they predate the multi-wallet table. Count them so the Wallets tab badge never
  // reads "0" for a profile that can actually receive. (SSOT note: legacy fields +
  // the wallets table are two representations of "ways to receive"; both feed the
  // badge until the legacy address is migrated into the wallets table.)
  const receiveMethodCount =
    walletCount + (profile.bitcoin_address ? 1 : 0) + (profile.lightning_address ? 1 : 0);

  // Fetch entity counts for profile tab badges (shared SSOT with the
  // entity-detail trust block — see listingCounts.ts).
  const { counts: entityCounts } = await fetchProfileListingCounts(supabase, profile.id);

  // Calculate statistics
  const projectCount = projects?.length || 0;
  // Sum in BTC (the canonical unit) — the overview tab formats this figure with
  // formatAmountBtc. Summing per-project raised_amount would mix currencies.
  const totalRaised = enrichedProjects.reduce((sum, p) => sum + (p.settled_raised_btc || 0), 0);

  // Check if viewing own profile (server-side, avoids hydration flash)
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const isOwnProfile = !!currentUser && currentUser.id === profile.id;

  // The Cat's extracted "what I can offer" signals (skills/assets/asked-for/
  // not-available-for). Public slice only — getPublicEconomicProfile reads
  // user_economic_profile_public, which is visible to any visitor, not just
  // the owner (the base table's RLS is owner-only). Degrades to null if the
  // store is empty/absent — the section then hides.
  const economicProfile = await getPublicEconomicProfile(supabase, profile.id);

  // Redact before anything derives from the row, so hidden data never leaves the
  // server — not in the client payload, not in the JSON-LD below.
  // 1. `email` is the private account login email; `select('*')` pulls it in.
  // 2. Owner-hidden public fields (website, phone, contact_email, social_links)
  //    per profiles.privacy_settings. See config/profile-privacy.ts.
  const emailSafeProfile = isOwnProfile ? profile : { ...profile, email: null };
  const safeProfile = applyProfilePrivacy(emailSafeProfile, { isOwner: isOwnProfile });

  // Author's long-form articles for the Articles tab. The owner also sees their
  // non-public (followers/private) articles; visitors see only public ones.
  const articles = await listArticlesByAuthor(profile.id, { includeNonPublic: isOwnProfile });

  // Generate JSON-LD structured data for SEO
  // Use actual username in URL, not "me" for better SEO
  const canonicalUsername = safeProfile.username || targetUsername;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: safeProfile.name || safeProfile.username || canonicalUsername,
    alternateName: safeProfile.username || undefined,
    description: safeProfile.bio || undefined,
    image: safeProfile.avatar_url || undefined,
    url: `${SITE_URL}/profiles/${canonicalUsername}`,
    sameAs: safeProfile.website ? [safeProfile.website] : undefined,
    ...(safeProfile.bitcoin_address && {
      paymentAccepted: 'Bitcoin',
      bitcoinAddress: safeProfile.bitcoin_address,
    }),
  };

  // Pass data to client component for interactivity
  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(structuredData) }}
      />
      <ProfilePageClient
        profile={safeProfile}
        projects={projects || []}
        articles={articles}
        isOwnProfile={isOwnProfile}
        economicProfile={economicProfile}
        stats={{
          projectCount,
          totalRaised,
          followerCount: followerCount || 0,
          followingCount: followingCount || 0,
          walletCount: receiveMethodCount,
          entityCounts,
        }}
      />
    </>
  );
}
