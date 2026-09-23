'use client';

import { ArrowRight, MessageCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { CatStatusNote } from '@/components/ai-chat/CatStatusNote';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { ProposedOffer } from '@/services/cat/offer-engine';
import type { CatHealthReport } from '@/services/cat/health-probes';

interface OnboardingOffersProps {
  offers: ProposedOffer[];
  health: CatHealthReport | null;
  isRedirecting: boolean;
  onChat: () => void;
}

/** The offerings Cat proposed from the bio. One click creates each one. */
export function OnboardingOffers({ offers, health, isRedirecting, onChat }: OnboardingOffersProps) {
  if (offers.length === 0) {
    return (
      <div className="rounded-md border border-subtle bg-surface-page p-6 text-center">
        {health && !health.catCanAnswer ? (
          <CatStatusNote health={health} />
        ) : (
          <>
            <p className="mb-4 text-fg-secondary">
              Cat needs a little more to go on. Tell it more in a chat and it&apos;ll suggest
              offerings as you talk.
            </p>
            <Button
              onClick={onChat}
              disabled={isRedirecting}
              className="bg-fg-primary text-fg-inverted hover:bg-fg-primary/90"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Chat with Cat
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {offers.map((offer, i) => {
        const meta = ENTITY_REGISTRY[offer.entityType];
        if (!meta) {
          return null;
        }
        const href = `${meta.createPath}?description=${encodeURIComponent(offer.description)}`;
        return (
          <div
            key={`${offer.entityType}-${i}`}
            data-testid="offer-card"
            className="rounded-md border border-subtle bg-surface-page p-5"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-default bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-fg-primary">
                {meta.name}
              </span>
            </div>
            <p className="mb-2 text-sm text-fg-primary">{offer.description}</p>
            {offer.rationale && <p className="mb-4 text-xs text-fg-tertiary">{offer.rationale}</p>}
            <Link href={href}>
              <Button
                variant="accent"
                size="sm"
                className="w-full sm:w-auto"
                data-testid="offer-create"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create this
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onChat}
        className="w-full py-2 text-center text-sm text-fg-secondary transition-colors hover:text-fg-primary"
      >
        Or refine these with your Cat in a chat →
      </button>
    </>
  );
}
