/**
 * The evidence sections a room generates from the product's own records
 * (docs/features/investor-portal.md, phase 1): why it exists, how it ships,
 * and what it promised.
 */

import { ArrowUpRight } from 'lucide-react';
import type { FleetProject, RepoPace, RoadmapStatus } from '@/domain/projectRooms/evidence';
import { APP_LOCALE } from '@/utils/locale';
import { RoomPaceChart } from './RoomPaceChart';
import { RoomSection } from './RoomSection';

const RECENT_CHANGES = 6;

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(APP_LOCALE, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function SourceLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return null;
  }
  return (
    <a
      href={href}
      rel="noreferrer"
      target="_blank"
      className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm text-fg-secondary underline underline-offset-4 hover:text-fg-primary"
    >
      {children}
      <ArrowUpRight className="h-4 w-4" aria-hidden />
    </a>
  );
}

const IDENTITY: { key: keyof FleetProject['identity']; label: string }[] = [
  { key: 'problem', label: 'The problem' },
  { key: 'solution', label: 'The solution' },
  { key: 'mission', label: 'Mission' },
  { key: 'vision', label: 'Vision' },
];

export function RoomIdentity({ fleet }: { fleet: FleetProject }) {
  const parts = IDENTITY.filter(p => fleet.identity[p.key]);
  if (parts.length === 0) {
    return null;
  }
  return (
    <RoomSection id="why" title="Why it exists" note="From the product’s own record">
      <dl className="grid gap-5 sm:grid-cols-2">
        {parts.map(part => (
          <div key={part.key}>
            <dt className="text-xs font-medium uppercase tracking-caps text-fg-muted">
              {part.label}
            </dt>
            <dd className="mt-1 text-base leading-relaxed text-fg-secondary">
              {fleet.identity[part.key]}
            </dd>
          </div>
        ))}
      </dl>
    </RoomSection>
  );
}

export function RoomShipping({
  fleet,
  pace,
}: {
  fleet: FleetProject | null;
  pace: RepoPace | null;
}) {
  const recent = (fleet?.changelog ?? []).slice(0, RECENT_CHANGES);
  if (!pace && recent.length === 0) {
    return null;
  }
  return (
    <RoomSection
      id="shipping"
      title="How it ships"
      note="Generated from the repository and the changelog"
    >
      {pace && <RoomPaceChart pace={pace} />}
      {recent.length > 0 && (
        <>
          <h3 className="mt-8 text-sm font-semibold text-fg-primary">Recently shipped</h3>
          <ol className="mt-3 space-y-3">
            {recent.map(change => (
              <li key={`${change.date}-${change.done.slice(0, 32)}`} className="flex gap-4">
                <time dateTime={change.date} className="w-14 shrink-0 pt-0.5 text-xs text-fg-muted">
                  {shortDate(change.date)}
                </time>
                <p className="line-clamp-3 min-w-0 text-sm leading-6 text-fg-secondary">
                  {change.done}
                </p>
              </li>
            ))}
          </ol>
          <SourceLink href={fleet?.sources.changelog ?? null}>The full changelog</SourceLink>
        </>
      )}
    </RoomSection>
  );
}

const STATUS_ORDER: { status: RoadmapStatus; label: string }[] = [
  { status: 'in progress', label: 'Now' },
  { status: 'planned', label: 'Next' },
  { status: 'later', label: 'Later' },
  { status: 'done', label: 'Done' },
];

export function RoomRoadmap({ fleet }: { fleet: FleetProject }) {
  if (fleet.roadmap.length === 0) {
    return null;
  }
  return (
    <RoomSection id="roadmap" title="Roadmap" note="What it promised, and what is done">
      <div className="space-y-6">
        {STATUS_ORDER.map(({ status, label }) => {
          const items = fleet.roadmap.filter(r => r.status === status);
          if (items.length === 0) {
            return null;
          }
          return (
            <div key={status}>
              <h3 className="text-xs font-medium uppercase tracking-caps text-fg-muted">
                {label} · {items.length}
              </h3>
              <ul className="mt-2 space-y-2">
                {items.map(item => (
                  <li key={item.title} className="text-sm leading-6">
                    <span className="font-medium text-fg-primary">{item.title}</span>
                    {item.line && <span className="text-fg-secondary"> — {item.line}</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <SourceLink href={fleet.sources.roadmap}>The roadmap, with its reasoning</SourceLink>
    </RoomSection>
  );
}
