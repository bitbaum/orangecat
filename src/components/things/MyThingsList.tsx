/**
 * One list, grouped the way the map is grouped, each row opening where its
 * owner works on it. Rows render through ThingRow, which reads the registry
 * and getStatusInfo, so a new type or a status recolour lands here unchanged.
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TheDoor } from '@/components/map/TheDoor';
import { ThingRow } from '@/components/things/ThingRow';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import { THINGS_PAGE } from '@/config/things';
import { groupThingsByIntent, type Thing } from '@/domain/things/service';

function EmptyThings() {
  return (
    <div className="rounded-lg border border-default bg-surface-base p-6 sm:p-8">
      <h2 className="font-heading text-xl text-fg-primary">{THINGS_PAGE.empty.title}</h2>
      <p className="mt-1 text-sm text-fg-secondary">{THINGS_PAGE.empty.body}</p>
      <TheDoor className="mt-5" />
      <Link
        href={ROUTES.WHAT_YOU_CAN_DO}
        className="mt-4 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-fg-primary hover:underline"
      >
        {THINGS_PAGE.empty.mapLink}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function MyThingsList({ things }: { things: Thing[] }) {
  const sections = groupThingsByIntent(things);
  if (sections.length === 0) {
    return <EmptyThings />;
  }
  return (
    <div className="space-y-8">
      {sections.map(section => {
        const types = [...new Set(section.things.map(t => t.type))];
        return (
          <section key={section.intent.id} aria-labelledby={`things-${section.intent.id}`}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id={`things-${section.intent.id}`}
                className="text-xs font-semibold uppercase tracking-wider text-fg-secondary"
              >
                {section.intent.title}
              </h2>
              <span className="flex flex-wrap gap-x-3 text-xs">
                {types.map(type => (
                  <Link
                    key={type}
                    href={ENTITY_REGISTRY[type].basePath}
                    className="text-fg-tertiary hover:text-fg-primary hover:underline"
                  >
                    {THINGS_PAGE.seeAll(ENTITY_REGISTRY[type].namePlural)}
                  </Link>
                ))}
              </span>
            </div>
            <ul className="divide-y divide-subtle rounded-lg border border-default bg-surface-base">
              {section.things.map(thing => (
                <ThingRow
                  key={`${thing.type}:${thing.id}`}
                  type={thing.type}
                  title={thing.title}
                  href={thing.href}
                  status={thing.status}
                  subtitle={
                    thing.joined
                      ? `${ENTITY_REGISTRY[thing.type].name} · ${THINGS_PAGE.joinedLabel}`
                      : undefined
                  }
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default MyThingsList;
