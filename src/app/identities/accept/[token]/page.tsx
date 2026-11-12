/**
 * /identities/accept/<token> — the page a hand-over link opens (ADR-0014 D9).
 *
 * Reading it changes nothing: a messenger drawing a preview card, or a person
 * looking before deciding, spends nothing. Only the form's submit accepts.
 */
import type { Metadata } from 'next';
import { IDENTITIES_COPY } from '@/config/identities';
import { previewHandover } from '@/domain/identities/handover';
import { getAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { AcceptHandoverForm } from './AcceptHandoverForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Take over an identity',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AcceptHandoverPage({ params }: PageProps) {
  const { token } = await params;
  const offer = await previewHandover(getAdminClient(), token);

  if (!offer) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
        <h1 className="text-xl font-semibold text-fg-primary">{IDENTITIES_COPY.acceptGoneTitle}</h1>
        <p className="mt-3 text-fg-secondary">{IDENTITIES_COPY.acceptGone}</p>
      </main>
    );
  }

  const {
    data: { user },
  } = await (await createServerClient()).auth.getUser();
  const name = offer.name || (offer.username ? `@${offer.username}` : 'this identity');

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold text-fg-primary">{IDENTITIES_COPY.acceptTitle(name)}</h1>
      {offer.name && offer.username && (
        <p className="mb-0 mt-1 text-sm text-fg-secondary">@{offer.username}</p>
      )}
      <p className="mt-4 text-fg-secondary">{IDENTITIES_COPY.acceptIntro}</p>
      <AcceptHandoverForm token={token} signedInElsewhere={Boolean(user)} />
    </main>
  );
}
