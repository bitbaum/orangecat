import { callRpc } from '@/lib/supabase/untyped';
import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import ProfilePageClient from '@/components/profile/ProfilePageClient';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import { fetchProfileListingCounts } from '@/services/profile/listingCounts';
import { getEconomicProfile } from '@/services/cat/economic-profile';
import { listArticlesByAuthor } from '@/services/articles/get-article';
import { safeJsonLdString } from '@/lib/seo/structured-data';
import type { ScalableProfile } from '@/services/profile/types';
import { mapProjectRow } from '@/types/project';
import { enrichProjectsWithSettledFunding } from '@/services/wallets/project-funding';
import { ROUTES } from '@/config/routes';
import { APP_NAME, APP_KICKER, SITE_URL } from '@/config/brand';
import { applyProfilePrivacy } from '@/config/profile-privacy';
import { authLoginPath } from '@/lib/navigation/safe-return-path';
import { publicProfilePath } from '@/config/public-profile-path';

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

      if (!userProfile?.username) {
        return {
          title: 'Complete Your Profile',
          description: `Choose a username before sharing your ${APP_NAME} profile.`,
        };
      }
      targetUsername = userProfile.username;
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
  // The OG API segment is encoded here; canonical public profile paths go
  // through publicProfilePath, which owns its own single encoding pass.
  const canonicalUsername = profile.username || targetUsername;
  const safeUsername = encodeURIComponent(canonicalUsername);
  const ogImage = `${SITE_URL}/api/og/profile/${safeUsername}`;
  // Use actual username in URL, not "me" for better SEO
  const url = `${SITE_URL}${publicProfilePath(canonicalUsername)}`;

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
      redirect(authLoginPath(ROUTES.PROFILES.ME));
    }

    // Get username for current user
    const { data: userProfileData } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username')
      .eq('id', user.id)
      .single();
    const userProfile = userProfileData as { username: string | null } | null;

    if (!userProfile?.username) {
      redirect(ROUTES.DASHBOARD.INFO_EDIT);
    }
    targetUsername = userProfile.username;
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
    notFound();
  }

  // Fetch user's projects (exclude drafts, respect show_on_profile setting)
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
    .eq('user_id', profile.id)
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

  // Fetch wallet count using new wallet architecture
  let walletCount = 0;
  try {
    // Use the get_entity_wallets function to get active wallets for this profile
    // get_entity_wallets is not in generated DB types — cast the rpc reference to call it

    const { data: walletData } = (await callRpc(supabase, 'get_entity_wallets', {
      p_entity_type: 'profile',
      p_entity_id: profile.id,
    })) as { data: Array<{ is_active: boolean }> | null };
    walletCount = walletData ? walletData.filter(w => w.is_active).length : 0;
  } catch {
    // get_entity_wallets is the current wallet architecture; if it errs we just show
    // 0 (legacy receive addresses are still counted below). The old wallet_ownerships
    // fallback was removed — that table was never migrated onto the box and the
    // try/catch silently swallowed its absence, so it never contributed a count.
    walletCount = 0;
  }

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

  // The Cat's extracted "what I can offer" signals (skills/assets/asked-for).
  // Degrades to null if the store is empty/absent — the section then hides.
  const economicProfile = await getEconomicProfile(supabase, profile.id);

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
    url: `${SITE_URL}${ROUTES.PROFILES.VIEW(canonicalUsername)}`,
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
