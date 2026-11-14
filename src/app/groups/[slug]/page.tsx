import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { resolveSellerReceiveInfo } from '@/domain/payments';
import { DATABASE_TABLES } from '@/config/database-tables';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { safeJsonLdString } from '@/lib/seo/structured-data';
import { APP_NAME, SITE_URL } from '@/config/brand';
import { metaDescription } from '@/lib/og/share-line';
import { notFoundTitle } from '@/config/not-found';

const GroupDetailClient = dynamic(
  () => import('@/components/groups/GroupDetail').then(mod => ({ default: mod.GroupDetail })),
  {
    loading: () => (
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-2/3 bg-surface-raised rounded" />
          <div className="h-4 w-1/2 bg-surface-raised rounded" />
          <div className="h-72 w-full bg-surface-raised rounded" />
        </div>
      </div>
    ),
  }
);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerClient();

  const { data: group } = await supabase
    .from(DATABASE_TABLES.GROUPS)
    .select('name, description, visibility')
    .eq('slug', slug)
    .single();

  const g = group as {
    name: string;
    description: string | null;
    visibility: string;
  } | null;
  if (!g) {
    return {
      title: notFoundTitle('group'),
      description: 'The group you are looking for does not exist.',
    };
  }

  const title = g.name;
  const description = metaDescription(
    g.description || `Join ${g.name} on ${APP_NAME}. Bitcoin community group.`
  );
  // One title on every network: X used to say "<group> — AI economic agent".
  const shareTitle = `${g.name} — ${APP_NAME}`;
  const url = `${SITE_URL}/groups/${slug}`;
  // Dynamic share card — fills the gap audited 2026-06-03 (group OG
  // previously had no image; every WhatsApp/Slack share rendered text-only).
  const ogImage = `${SITE_URL}/api/og/group/${slug}`;

  return {
    title,
    description,
    // Only public groups are indexable — a private/unlisted group reachable by
    // direct URL must not be indexed (its name/description would leak into SERPs).
    robots: g.visibility === 'public' ? undefined : { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: {
      title: shareTitle,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${g.name} on ${APP_NAME}` }],
      url,
      type: 'website',
      siteName: APP_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description,
      images: [ogImage],
    },
  };
}

export default async function GroupDetailPage({ params }: PageProps) {
  const { slug } = await params;

  // Quick existence check server-side
  const supabase = await createServerClient();
  const { data: group } = await supabase
    .from(DATABASE_TABLES.GROUPS)
    .select('id, name, description')
    .eq('slug', slug)
    .single();

  const g = group as { id: string; name: string; description: string | null } | null;
  if (!g) {
    notFound();
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: g.name,
    description: g.description || `Community group on ${APP_NAME}`,
    url: `${SITE_URL}/groups/${slug}`,
  };

  // Whether a payment to this group can be made at all, by the same resolution
  // the payment itself runs. Only the yes/no reaches the browser: a group's
  // wallets are readable by its members alone.
  const canReceive = (await resolveSellerReceiveInfo('group', g.id)) !== null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(structuredData) }}
      />
      <GroupDetailClient groupSlug={slug} canReceive={canReceive} />
    </>
  );
}
