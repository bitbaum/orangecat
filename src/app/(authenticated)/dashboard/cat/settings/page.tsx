'use client';

/**
 * CAT SETTINGS — everything about your Cat on one page.
 *
 * It used to be spread over seven places (the Context and Controls tabs,
 * /dashboard/cat/permissions, /settings/ai, /settings/memory, /settings/usage
 * and "How Cat runs"), each holding part of one topic, so nothing answered
 * "how is my Cat set up?" Now four questions, in order:
 *
 *   What Cat knows   — instructions, memories, notes, interests
 *   What Cat can see — connections (Loki, GitHub, Solon, wallet)
 *   What Cat can do  — autonomy, per-category permissions, spending caps, record
 *   How Cat runs     — free pool, credits, your key, your machine
 *
 * The sticky row at the top is both the summary and the menu. Each section is
 * one shared component also used by the older standalone pages.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useRequireAuth } from '@/hooks/useAuth';
import { useCatPermissions } from '@/hooks/useCatPermissions';
import { useCatMemoryCount } from '@/hooks/useCatMemoryCount';
import { useCatQuota } from '@/components/ai-chat/ModernChatPanel/hooks/useCatQuota';
import Loading from '@/components/Loading';
import { CatSettingsNav } from '@/components/cat-settings/CatSettingsNav';
import { KnowsSection } from '@/components/cat-settings/KnowsSection';
import { SeesSection } from '@/components/cat-settings/SeesSection';
import { CanDoSection } from '@/components/cat-settings/CanDoSection';
import { RunsOnSection } from '@/components/cat-settings/RunsOnSection';
import { useCatConnections } from '@/components/cat-settings/useCatConnections';

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-48 space-y-4 sm:scroll-mt-40"
    >
      <div>
        <h2 id={`${id}-title`} className="text-lg font-semibold text-fg-primary">
          {title}
        </h2>
        <p className="mt-1 text-sm text-fg-secondary">{lead}</p>
      </div>
      {children}
    </section>
  );
}

export default function CatSettingsPage() {
  const { user, isLoading } = useRequireAuth();
  const connections = useCatConnections();
  const { permissions } = useCatPermissions();
  const memoryCount = useCatMemoryCount();
  const { quota } = useCatQuota();

  if (isLoading) {
    return <Loading fullScreen message="Loading..." />;
  }
  if (!user) {
    return null;
  }

  const list = connections.connections;
  const live = list?.filter(c => c.state === 'connected' || c.state === 'everyone').length;
  const summary = permissions?.summary;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 pb-24 pt-4 sm:px-6 sm:pt-6">
      <header className="space-y-3">
        <Link
          href={ROUTES.DASHBOARD.CAT}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-fg-primary">Cat settings</h1>
      </header>

      <CatSettingsNav
        items={[
          {
            id: 'knows',
            label: 'Knows',
            value: `${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'}`,
          },
          {
            id: 'sees',
            label: 'Sees',
            value: list ? `${live} of ${list.length} connected` : null,
          },
          {
            id: 'can-do',
            label: 'Can do',
            value: summary ? `${summary.enabledActions} of ${summary.totalActions} actions` : null,
          },
          {
            id: 'runs-on',
            label: 'Runs on',
            value: !quota
              ? null
              : quota.tier === 'byok'
                ? (quota.activeByokProviderName ?? 'Your key')
                : `Free · ${quota.requestsRemaining}/${quota.dailyLimit} today`,
          },
        ]}
      />

      <Section
        id="knows"
        title="What Cat knows"
        lead="Private to you — read it, correct it, delete any of it."
      >
        <KnowsSection />
      </Section>

      <Section
        id="sees"
        title="What Cat can see"
        lead="The places Cat reads from. Tap one for what it sees and what it lets Cat do."
      >
        {/* SeesSection reads ?github= (the result of connecting GitHub). */}
        <Suspense fallback={null}>
          <SeesSection
            connections={list}
            failed={connections.failed}
            onChanged={() => void connections.reload()}
          />
        </Suspense>
      </Section>

      <Section
        id="can-do"
        title="What Cat can do"
        lead="What Cat may do on its own, what it must ask first, and what it has done."
      >
        <CanDoSection userId={user.id} />
      </Section>

      <Section
        id="runs-on"
        title="How Cat runs"
        lead="Free out of the box. Everything here is optional."
      >
        <RunsOnSection />
      </Section>
    </div>
  );
}
