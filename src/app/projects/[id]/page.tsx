import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { ROUTES } from '@/config/routes';
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

// Mirrors ProjectPageClient's Project interface — all required fields plus known optionals
type ProjectFull = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  raised_amount: number | null;
  currency: string | null;
  category: string | null;
  status: string;
  bitcoin_address: string | null;
  lightning_address: string | null;
  funding_purpose: string | null;
  website_url: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  bitcoin_balance_btc?: number | null;
  bitcoin_balance_updated_at?: string | null;
  supporters_count?: number | null;
  last_support_at?: string | null;
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

  // Fetch profile separately (more reliable than JOIN)
  let profile: (ProfileSnippet & { id: string }) | null = null;
  if (project.user_id) {
    const { data: profileData } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('id, username, name, avatar_url')
      .eq('id', project.user_id)
      .maybeSingle();

    if (profileData) {
      profile = profileData as ProfileSnippet & { id: string };
    }
  }

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
  const sellerReceive = await resolveSellerReceiveInfo(supabase, 'project', id);

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
    url: `${SITE_URL}${ROUTES.PROJECTS.VIEW(id)}`,
    creator: {
      '@type': 'Person',
      name: creatorName,
      ...(profile?.username && {
        url: `${SITE_URL}${ROUTES.PROFILES.VIEW(profile.username)}`,
      }),
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
      <ProjectPageClient project={projectWithProfile} sellerReceive={sellerReceive} />
    </>
  );
}
