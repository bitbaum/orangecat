import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import { getProfileClaimForCreator } from '@/domain/profileClaims/creator';
import { getTableName } from '@/config/entity-registry';
import { looseClient } from '@/lib/supabase/untyped';
import { ShareClaim } from '@/components/claim/ShareClaim';
import { ROUTES } from '@/config/routes';
import { SITE_URL } from '@/config/brand';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Send the link',
  robots: { index: false, follow: false },
};

/**
 * Where creating something for someone else lands (ADR-0005 D8).
 *
 * The output of that path is a LINK, not a page — so this screen is the link,
 * a message already written, and one tap to the app the creator uses. It is
 * the whole difference between a link created today and a link sent today.
 */
export default async function ShareClaimPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(ROUTES.AUTH_LOGIN);
  }

  // Creator-only: 404s for anyone else's claim, since whether a given id
  // exists is not a stranger's business.
  const result = await getProfileClaimForCreator(id, user.id);
  if (!result.ok) {
    notFound();
  }
  const claim = result.data;

  // Already handed over — there is nothing left to send.
  if (claim.status !== 'pending') {
    redirect(ROUTES.DASHBOARD.PROFILE_CLAIMS);
  }

  // What was set up for them, looked up here rather than in the claims service:
  // `projects` is an entity table addressed through `getTableName()`, and a
  // dynamic table name inside that service would confuse the schema-drift
  // scanner into attributing `title` to `actors`.
  let thingName: string | null = null;
  if (claim.actorId) {
    const { data: project } = await looseClient(supabase)
      .from(getTableName('project'))
      .select('title')
      .eq('actor_id', claim.actorId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    thingName = (project?.title as string | undefined) ?? null;
  }

  return (
    <ShareClaim
      recipientName={claim.name}
      claimUrl={`${SITE_URL}${ROUTES.CLAIM(claim.token)}`}
      pageUrl={claim.slug ? ROUTES.PROFILES.VIEW(claim.slug) : null}
      thingName={thingName}
    />
  );
}
