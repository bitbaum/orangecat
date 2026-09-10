import type { ProjectFull } from './projectFull';
import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { UnclaimedBand } from '@/components/claim/UnclaimedBand';
import {
  getUnclaimedOwner,
  resolveActorUserId,
  usernameOf,
} from '@/domain/profileClaims/unclaimed';
import { getEntityStewardUserId } from '@/domain/profileClaims/stewardship';
import { SetUpBy } from '@/components/claim/SetUpBy';
import { ROUTES } from '@/config/routes';
import { PublicEntityOwnerBar } from '@/components/public/PublicEntityOwnerBar';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { isProjectPubliclyVisible } from '@/config/project-statuses';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import { safeJsonLdString } from '@/lib/seo/structured-data';
import { APP_NAME, SITE_URL } from '@/config/brand';
import { resolveSellerReceiveInfo } from '@/domain/payments';
import { getEntityFundingStats } from '@/services/wallets/funding-stats';
import { computeAmountRaised } from '@/lib/projectGoal';

const ProjectPageClient = dynamic(() => import('@/components/project/ProjectPageClient'), {
  loading: () => (
    <div className="max-w-5xl mx-auto p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-2/3 bg-surface-raised rounded" />
        <div className="h-4 w-1/2 bg-surface-raised rounded" />
        <div className="h-72 w-full bg-surface-raised rounded" />
      </div>
    </div>
  ),
});

interface PageProps {
  params: Promise<{ id: string }>;
}

// Narrow types matching the actual DB schema (generated types in database.ts are stale for projects)
type ProjectMeta = {
  title: string;
  description: string | null;
  goal_amount: number | null;
  raised_amount: number | null;
  currency: string | null;
  category: string | null;
  status: string;
  user_id: string;
};

type ProfileSnippet = {
  username: string | null;
  name: string | null;
  avatar_url: string | null;
} | null;

/**
 * Generate metadata for project pages
 * This enables SEO and social media preview cards (Twitter, Facebook, LinkedIn, etc.)
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: projectData } = await supabase
    .from(getTableName('project'))
    .select('title, description, goal_amount, raised_amount, currency, category, status, user_id')
    .eq('id', id)
    .single();

  const project = projectData as ProjectMeta | null;
  if (!project) {
    return {
      title: 'Project Not Found',
      description: 'The project you are looking for does not exist.',
    };
  }

  // Fetch creator profile separately for metadata
  let creatorProfile: ProfileSnippet = null;
  if (project.user_id) {
    const { data: profileData } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username, name, avatar_url')
      .eq('id', project.user_id)
      .maybeSingle();

    if (profileData) {
      creatorProfile = profileData as ProfileSnippet;
    }
  }

  // Calculate progress for description
  const progress = project.goal_amount
    ? Math.round((Number(project.raised_amount || 0) / Number(project.goal_amount)) * 100)
    : 0;

  const creatorName = creatorProfile?.name || creatorProfile?.username || 'Creator';
  const title = project.title;
  const description =
    project.description ||
    `Support ${project.title} on ${APP_NAME}. ${progress > 0 ? `${progress}% funded. ` : ''}Community-funded project by ${creatorName}.`;
  const image = creatorProfile?.avatar_url || '/images/og-default.png';
  const url = `${SITE_URL}${ROUTES.PROJECTS.VIEW(id)}`;

  return {
    title,
    description,
    // Only published (active) projects are indexable — a draft/paused/archived
    // project reachable by direct URL must not be indexed.
    robots: project.status === 'active' ? undefined : { index: false, follow: false },
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: project.title,
      description,
      images: [image],
      url,
      type: 'website',
      siteName: APP_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title: project.title,
      description,
      images: [image],
    },
  };
}

/**
 * Public Project Page - Server Component
 *
 * This page is publicly accessible and server-side rendered for:
 * - SEO optimization
 * - Social media preview cards (no more "Loading..." on Twitter/Facebook)
 * - Fast initial page load
 * - Proper metadata for search engines
 */
export default async function PublicProjectPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Fetch project data server-side
  const { data: projectData, error: projectError } = await supabase
    .from(getTableName('project'))
    .select('*')
    .eq('id', id)
    .single();

  const project = projectData as unknown as ProjectFull;
  if (projectError || !project) {
    notFound();
  }

  // ADR-0005: the project may be owned by a placeholder — a person who has not
  // accepted it yet. That owner has no profile, so the lookup below finds
  // nothing; the band says whose it is instead of the page rendering ownerless.
  const unclaimedOwner = await getUnclaimedOwner(supabase, project.actor_id);

  // Whose page this is: the OWNING actor's account, falling back to the
  // creating account for legacy rows with no actor. `user_id` is who created
  // the row; after a claim (ADR-0005) that is the steward, not the owner.
  const ownerUserId = (await resolveActorUserId(supabase, project.actor_id)) ?? project.user_id;

  // Fetch profile separately (more reliable than JOIN)
  let profile: (ProfileSnippet & { id: string }) | null = null;
  if (ownerUserId) {
    const { data: profileData } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('id, username, name, avatar_url')
      .eq('id', ownerUserId)
      .maybeSingle();

    if (profileData) {
      profile = profileData as ProfileSnippet & { id: string };
    }
  }

  // Set up on someone's behalf and since taken over: the creator is not the
  // owner any more, but that it was set up for her stays visible.
  const setUpByUsername =
    !unclaimedOwner && project.user_id && ownerUserId && project.user_id !== ownerUserId
      ? await usernameOf(supabase, project.user_id)
      : null;

  // Honest funding total: the settled `contributions` ledger via
  // get_entity_funding_stats — NOT the `raised_amount` column, which no code
  // ever writes. Converted to the goal currency so the figure and progress bar
  // are real. Returns 0 for a private fundraise or one with no verified
  // contributions (better than showing a fabricated number).
  const fundingStats = await getEntityFundingStats(supabase, 'project', id);
  const settledRaisedBtc = fundingStats?.totalBtc ?? 0;
  const settledRaised = await computeAmountRaised(settledRaisedBtc, project.currency ?? 'BTC');

  // Ensure non-nullable fields match ProjectPageClient's Project interface
  const projectWithProfile = {
    ...project,
    description: project.description ?? '',
    currency: project.currency ?? 'BTC',
    raised_amount: settledRaised,
    settled_raised_btc: settledRaisedBtc,
    // Honest supporters figure: settled contributions only — never emoji
    // reactions, comments, or self-reported support rows.
    supporters_count: fundingStats?.contributorCount ?? 0,
    profiles: profile ?? undefined,
  };
  const sellerReceive = await resolveSellerReceiveInfo('project', id);

  // A draft project is invisible to everyone but its owner (the projects_public_read
  // RLS policy), and nothing on the page used to say so — projects were the one
  // entity type without the owner bar every other type already shows. Without it a
  // project can sit unpublished for weeks while its owner assumes it is live.
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const isOwner = !!viewer && !!ownerUserId && viewer.id === ownerUserId;
  // The steward of an unclaimed page manages it until the claim (ADR-0005 D5).
  const isSteward =
    !!viewer && !!unclaimedOwner && (await getEntityStewardUserId('project', id)) === viewer.id;
  const canManage = isOwner || isSteward;
  const isOwnerPreview = !isProjectPubliclyVisible(project.status);

  // Generate JSON-LD structured data for SEO
  const creatorName = profile?.name || profile?.username || 'Creator';
  const _progress = project.goal_amount
    ? Math.round((Number(settledRaised) / Number(project.goal_amount)) * 100)
    : 0;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title,
    description: project.description || `Support ${project.title} on ${APP_NAME}`,
    url: `${SITE_URL}/projects/${id}`,
    creator: {
      '@type': 'Person',
      name: creatorName,
      ...(profile?.username && { url: `${SITE_URL}/profiles/${profile.username}` }),
    },
    ...(project.goal_amount && {
      funding: {
        '@type': 'MonetaryGrant',
        amount: {
          '@type': 'MonetaryAmount',
          value: project.goal_amount,
          currency: project.currency || 'BTC',
        },
        ...(settledRaised !== null &&
          settledRaised > 0 && {
            amountRaised: {
              '@type': 'MonetaryAmount',
              value: settledRaised,
              currency: project.currency || 'BTC',
            },
          }),
      },
    }),
    ...(project.bitcoin_address && {
      paymentAccepted: 'Bitcoin',
      bitcoinAddress: project.bitcoin_address,
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
      {unclaimedOwner && (
        <UnclaimedBand
          ownerName={unclaimedOwner.name}
          stewardUsername={unclaimedOwner.stewardUsername}
        />
      )}
      {setUpByUsername && <SetUpBy stewardUsername={setUpByUsername} />}
      {canManage && (
        <PublicEntityOwnerBar
          isOwnerPreview={isOwnerPreview}
          entityName={ENTITY_REGISTRY.project.name}
          entityStatus={project.status}
          editHref={ROUTES.PROJECTS.EDIT(id)}
          fundingLink={null}
          entityType="project"
          entityId={id}
        />
      )}
      <ProjectPageClient
        project={projectWithProfile}
        sellerReceive={sellerReceive}
        canManage={canManage}
      />
    </>
  );
}
