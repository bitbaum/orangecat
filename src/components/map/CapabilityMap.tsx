/**
 * The map, rendered: one section per intent, one card per capability. Reads
 * buildCapabilityMap() and nothing else, so a new registry type appears here
 * by declaring `plain` and an intent.
 *
 * `compact` drops the steps and the example — the how-it-works page wants the
 * shape of the offer, the map page wants the whole thing.
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buildCapabilityMap, type Capability } from '@/config/capability-map';
import { cn } from '@/lib/utils';

function CapabilityCard({ capability, compact }: { capability: Capability; compact: boolean }) {
  const Icon = capability.icon;
  return (
    <li className="flex flex-col rounded-lg border border-default bg-surface-base p-5">
      <div className="flex items-start gap-3">
        <span className="oc-icon-tile h-10 w-10 shrink-0">
          <Icon className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="font-heading text-lg text-fg-primary">{capability.verb}</h3>
          <p className="mt-1 text-sm leading-relaxed text-fg-secondary">{capability.what}</p>
        </div>
      </div>
      {!compact && (
        <>
          <p className="mt-3 text-sm text-fg-tertiary">
            <span className="text-fg-muted">For example: </span>
            {capability.example}
          </p>
          <ol className="mt-3 space-y-1 text-sm text-fg-secondary">
            {capability.steps.map((step, i) => (
              <li key={step} className="flex gap-2">
                <span className="w-4 shrink-0 font-heading tabular-nums text-fg-muted">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <Link
          href={capability.startHref}
          className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-fg-primary hover:underline"
        >
          Start
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        {capability.mineHref && (
          <Link
            href={capability.mineHref}
            className="inline-flex min-h-9 items-center text-sm text-fg-secondary hover:text-fg-primary hover:underline"
          >
            See yours
          </Link>
        )}
      </div>
    </li>
  );
}

export function CapabilityMap({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-12', className)}>
      {buildCapabilityMap().map(section => (
        <section
          key={section.intent.id}
          id={`do-${section.intent.id}`}
          aria-labelledby={`do-${section.intent.id}-title`}
        >
          <div className="mb-5 max-w-3xl">
            <h2
              id={`do-${section.intent.id}-title`}
              className="font-heading text-2xl text-fg-primary"
            >
              {section.intent.title}
            </h2>
            <p className="mt-1 text-base leading-relaxed text-fg-secondary">{section.intent.how}</p>
          </div>
          <ul
            className={cn(
              'grid gap-4',
              compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2'
            )}
          >
            {section.capabilities.map(capability => (
              <CapabilityCard key={capability.id} capability={capability} compact={compact} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default CapabilityMap;
