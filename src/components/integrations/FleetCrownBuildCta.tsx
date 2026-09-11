'use client';

import { useState } from 'react';
import { ArrowUpRight, Bot } from 'lucide-react';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import { ORANGECAT_FLEETCROWN_INTEGRATION } from '@/config/entity-registry';
import type { EntityType } from '@/config/entity-registry';

/**
 * FleetCrown cross-sell — "build this with an AI fleet".
 *
 * FleetCrown is the sibling execution product (OC = economic layer, FC =
 * production layer; one shared login via "Login with OrangeCat"). This CTA is
 * the single bridge component; the target URL derives from the integration
 * SSOT in the entity registry.
 *
 * - `banner`: slim horizontal strip for the projects dashboard.
 * - `card`: compact block for the project detail sidebar rail.
 */

// Deep link straight into FleetCrown's create-project dialog (?new=1 opens it,
// params survive the sign-in redirect — FC PR #56). Unauthenticated users pass
// through "Continue with OrangeCat" and land in the open dialog.
const FLEETCROWN_BUILD_URL = `${ORANGECAT_FLEETCROWN_INTEGRATION.fleetCrown.site}/projects?new=1`;

const COPY = {
  title: `Build it with ${ORANGECAT_FLEETCROWN_INTEGRATION.fleetCrown.title}`,
  body: 'One click: FleetCrown creates the project and puts an AI agent on it. One login: your OrangeCat account.',
  action: `Open ${ORANGECAT_FLEETCROWN_INTEGRATION.fleetCrown.title}`,
} as const;

interface FleetCrownBuildCtaProps {
  variant: 'banner' | 'card';
  entityType?: EntityType;
  entityId?: string;
  sourcePath?: string;
}

export default function FleetCrownBuildCta({
  variant,
  entityType,
  entityId,
  sourcePath,
}: FleetCrownBuildCtaProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openFleetCrown = async () => {
    // Open the tab NOW, inside the click. A window.open() after an await has
    // lost the user gesture and every popup blocker eats it — so the tab is
    // claimed synchronously and pointed at the handoff once it is minted.
    // `noopener` is set by clearing `opener` rather than passing the feature,
    // because that feature makes window.open return null and we need the handle.
    const tab = window.open('', '_blank');
    if (tab) {
      tab.opener = null;
    }
    const go = (url: string) => {
      // A blocked popup must not become a dead end: fall back to this tab.
      if (tab) {
        tab.location.replace(url);
      } else {
        window.location.assign(url);
      }
    };

    if (!entityType || !entityId) {
      go(FLEETCROWN_BUILD_URL);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API_ROUTES.INTEGRATIONS.FLEETCROWN_BUILD_INTENTS, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          source_path: sourcePath,
        }),
      });
      // 503 = the signed handoff isn't configured on this deploy. That's not a
      // failure the user should see — fall back to the plain FleetCrown link,
      // exactly as the banner (no entity id) variant already does.
      if (response.status === 503) {
        go(FLEETCROWN_BUILD_URL);
        return;
      }
      const body = (await response.json()) as {
        data?: { url?: string };
        error?: { message?: string };
      };
      if (!response.ok || !body.data?.url) {
        throw new Error(body.error?.message || 'Could not create the FleetCrown handoff.');
      }
      go(body.data.url);
      setLoading(false);
    } catch (cause) {
      // The handoff never arrived, so close the tab we speculatively opened
      // rather than stranding the reader on a blank page with no explanation.
      tab?.close();
      setError(cause instanceof Error ? cause.message : 'Could not open FleetCrown.');
      setLoading(false);
    }
  };

  if (variant === 'banner') {
    return (
      <div className="mb-4 rounded-md border border-subtle bg-surface-raised/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-md border border-subtle bg-surface-page p-2">
              <Bot className="h-5 w-5 text-accent-warm" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-medium text-fg-primary">{COPY.title}</h3>
              <p className="mt-1 text-sm text-fg-secondary">{COPY.body}</p>
            </div>
          </div>
          <Button
            onClick={openFleetCrown}
            isLoading={loading}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            {COPY.action}
            <ArrowUpRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-status-negative">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-subtle bg-surface-base p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-subtle bg-surface-page p-2">
          <Bot className="h-5 w-5 text-accent-warm" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-fg-primary">{COPY.title}</h3>
          <p className="mt-1 text-sm text-fg-secondary">{COPY.body}</p>
        </div>
      </div>
      <Button
        onClick={openFleetCrown}
        isLoading={loading}
        variant="outline"
        size="sm"
        className="mt-3 w-full"
      >
        {COPY.action}
        <ArrowUpRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
      </Button>
      {error && <p className="mt-2 text-xs text-status-negative">{error}</p>}
    </div>
  );
}
