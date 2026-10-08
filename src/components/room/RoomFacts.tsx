import type { RoomFact } from '@/domain/projectRooms/evidence';

/**
 * The first thing a reader judges: is it real, is it moving. Generated, never
 * typed — each fact names its source and links there.
 */
export function RoomFacts({ facts }: { facts: RoomFact[] }) {
  if (facts.length === 0) {
    return null;
  }
  return (
    <section aria-label="Key facts" className="mt-8">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle lg:grid-cols-4">
        {facts.map(fact => (
          <div key={fact.label} className="min-w-0 bg-surface-base p-4">
            <dt className="text-xs font-medium uppercase tracking-caps text-fg-muted">
              {fact.label}
            </dt>
            <dd className="mt-1 font-heading text-lg font-semibold tracking-display text-fg-primary">
              {fact.value}
            </dd>
            <dd className="mt-0.5 break-words text-xs text-fg-muted">
              {fact.href ? (
                <a
                  href={fact.href}
                  rel="noreferrer"
                  target="_blank"
                  className="underline underline-offset-2 hover:text-fg-primary"
                >
                  {fact.source}
                </a>
              ) : (
                fact.source
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
