'use client';

/**
 * Integrations settings — two panels:
 *
 *   1. Integration keys (outbound API auth — FleetCrown, hirn.li, …)
 *   2. Webhook endpoints (inbound signed events to your URL)
 *
 * Both panels share the actor selector (personal + group actors), so
 * we resolve actors once here and pass them down.
 *
 * Lift history:
 *   Pre-2026-06-03 — single keys panel inline in this page.
 *   2026-06-03    — extracted IntegrationKeysCard + WebhookEndpointsCard
 *                   so the page stays under the 300-line cap with both
 *                   surfaces shown.
 */

import Link from 'next/link';
import { KeyRound, LogIn, Webhook } from 'lucide-react';
import { useRequireAuth } from '@/hooks/useAuth';
import { useMessagingActors } from '@/features/messaging/hooks/useMessagingActors';
import { PUBLIC_API_BASE, PUBLIC_API_OPENAPI_PATH } from '@/config/public-api';
import { ROUTES } from '@/config/routes';
import Loading from '@/components/Loading';
import Button from '@/components/ui/Button';
import IntegrationKeysCard from '@/components/settings/IntegrationKeysCard';
import WebhookEndpointsCard from '@/components/settings/WebhookEndpointsCard';
import { authLoginPath } from '@/lib/navigation/safe-return-path';

export default function IntegrationsPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const { personalActor, groupActors } = useMessagingActors();

  if (authLoading) {
    return <Loading fullScreen message="Loading integrations..." />;
  }

  if (!user) {
    const returnTo = authLoginPath(ROUTES.SETTINGS_INTEGRATIONS);
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-subtle bg-surface-raised/30">
          <KeyRound className="h-5 w-5 text-fg-secondary" />
        </div>
        <h1 className="text-xl font-semibold text-fg-primary">Sign in to manage integrations</h1>
        <p className="mt-2 text-sm text-fg-secondary">
          Integration keys and webhook endpoints both bind to a specific actor. Sign in to mint,
          view, or revoke them.
        </p>
        <Link href={returnTo} className="mt-6 inline-block">
          <Button>
            <LogIn className="mr-1.5 h-4 w-4" />
            Sign in
          </Button>
        </Link>
        <Link href={ROUTES.HOME} className="mt-3 text-xs text-fg-secondary hover:text-fg-primary">
          ← Back to home
        </Link>
      </div>
    );
  }

  const actors = [
    ...(personalActor
      ? [{ actor_id: personalActor.actor_id, label: `${personalActor.name} (Personal)` }]
      : []),
    ...groupActors.map(a => ({ actor_id: a.actor_id, label: a.name })),
  ];
  const defaultActorId = personalActor?.actor_id ?? actors[0]?.actor_id ?? null;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-fg-secondary">
          Let external services authenticate to OrangeCat and receive signed events.
        </p>
        <p className="mt-1 text-xs text-fg-tertiary">
          Looking for AI provider keys (Groq, OpenRouter, OpenAI…)? Those live in{' '}
          <Link href={ROUTES.SETTINGS_AI} className="underline hover:text-fg-primary">
            Settings → AI
          </Link>
          — this page is for OrangeCat platform access from outside.
        </p>
        <p className="mt-2 text-xs text-fg-secondary">
          API contract:{' '}
          <a
            href={PUBLIC_API_OPENAPI_PATH}
            className="underline hover:text-fg-primary"
            target="_blank"
            rel="noreferrer"
          >
            openapi.json
          </a>{' '}
          ·{' '}
          <a
            href={PUBLIC_API_BASE}
            className="underline hover:text-fg-primary"
            target="_blank"
            rel="noreferrer"
          >
            discovery
          </a>
        </p>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-fg-primary">
          <KeyRound className="h-5 w-5" />
          Integration keys
        </h2>
        <p className="mb-4 text-sm text-fg-secondary">
          Outbound API auth. Each key acts as one actor and can be revoked individually.
        </p>
        <IntegrationKeysCard actors={actors} defaultActorId={defaultActorId} />
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-fg-primary">
          <Webhook className="h-5 w-5" />
          Webhook endpoints
        </h2>
        <p className="mb-4 text-sm text-fg-secondary">
          Receive signed POST events when entities the bound actor owns are created. Verify
          deliveries with{' '}
          <code className="rounded bg-surface-raised px-1 text-xs">verifyWebhookSignature</code>{' '}
          from <code className="rounded bg-surface-raised px-1 text-xs">@orangecat/sdk</code>.
        </p>
        <WebhookEndpointsCard actors={actors} defaultActorId={defaultActorId} />
      </div>
    </div>
  );
}
