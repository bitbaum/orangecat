/**
 * An investor room as the person it was sent to reads it (ADR-0012,
 * docs/features/investor-portal.md).
 *
 * In the order a reader judges: what it is → is it real and moving (generated
 * facts) → why it exists → the owner's story and numbers → how it ships → what
 * it promised → documents. Generated sections come from the product's own
 * records and say so; a source that is down is simply left out.
 *
 * Server-rendered and static: everything a visitor can follow inside the room
 * goes through `/room/<token>/open/...`, so the owner sees what was opened —
 * and the footer says so, because a reader is owed that.
 */

import { ArrowUpRight, FileText } from 'lucide-react';
import { roomParagraphs } from '@/config/project-room';
import { ROUTES } from '@/config/routes';
import { APP_LOCALE } from '@/utils/locale';
import { slugify } from '@/utils/string';
import { visibleSections } from '@/domain/projectRooms/content';
import type { RoomEvidence } from '@/domain/projectRooms/evidence';
import type { VisitorRoom } from '@/domain/projectRooms/types';
import { RoomHero } from './RoomHero';
import { RoomFacts } from './RoomFacts';
import { RoomIdentity, RoomRoadmap, RoomShipping } from './RoomEvidence';
import { RoomSection } from './RoomSection';
import { RoomFooter } from './RoomFooter';

interface RoomViewProps {
  token: string;
  room: VisitorRoom;
  evidence: RoomEvidence;
  ownerName: string;
  isShared: boolean;
  hasBuildRecord: boolean;
}

function formatAsOf(date: string): string {
  // Noon UTC, so a date-only value is the same day everywhere.
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(APP_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** A stable anchor for an owner-written section title. Exported for tests. */
export function sectionAnchor(title: string): string {
  return `s-${slugify(title)}`;
}

export function RoomView({
  token,
  room,
  evidence,
  ownerName,
  isShared,
  hasBuildRecord,
}: RoomViewProps) {
  const { content } = room;
  const { fleet, pace, facts } = evidence;
  const sections = visibleSections(content);
  const hasIdentity = !!fleet && Object.values(fleet.identity).some(Boolean);
  const hasShipping = !!pace || (fleet?.changelog.length ?? 0) > 0;
  const hasRoadmap = (fleet?.roadmap.length ?? 0) > 0;

  const index = [
    hasIdentity && { href: '#why', label: 'Why' },
    sections.length > 0 && { href: '#story', label: 'Story' },
    content.metrics.length > 0 && { href: '#numbers', label: 'Numbers' },
    hasShipping && { href: '#shipping', label: 'Shipping' },
    hasRoadmap && { href: '#roadmap', label: 'Roadmap' },
    content.documents.length > 0 && { href: '#documents', label: 'Documents' },
  ].filter(Boolean) as { href: string; label: string }[];

  const isEmpty =
    sections.length === 0 && content.metrics.length === 0 && !hasIdentity && !hasShipping;

  return (
    <div className="min-h-[calc(100svh-4rem)] bg-surface-page">
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <RoomHero token={token} room={room} isShared={isShared} hasBuildRecord={hasBuildRecord} />
        <RoomFacts facts={facts} />

        {index.length > 1 && (
          <nav aria-label="In this room" className="mt-6 flex flex-wrap gap-2">
            {index.map(item => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-9 items-center rounded-full border border-border-subtle px-3 text-sm text-fg-secondary hover:border-fg-muted hover:text-fg-primary"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}

        {isEmpty && (
          <p className="mt-12 rounded-lg border border-border-subtle bg-surface-raised p-5 text-sm text-fg-secondary">
            {ownerName} is still preparing this room. The link will keep working — come back to it
            later.
          </p>
        )}

        {fleet && <RoomIdentity fleet={fleet} />}

        {sections.length > 0 && (
          <div id="story" className="scroll-mt-20">
            {sections.map(section => (
              <RoomSection
                key={section.title}
                id={sectionAnchor(section.title)}
                title={section.title}
              >
                <div className="space-y-4">
                  {roomParagraphs(section.body).map(paragraph => (
                    <p
                      key={paragraph.slice(0, 48)}
                      className="whitespace-pre-line text-base leading-relaxed text-fg-secondary"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </RoomSection>
            ))}
          </div>
        )}

        {content.metrics.length > 0 && (
          <RoomSection
            id="numbers"
            title="The numbers"
            note={
              content.metrics_as_of ? `Counted ${formatAsOf(content.metrics_as_of)}` : undefined
            }
          >
            <ul className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-3">
              {content.metrics.map(metric => (
                <li key={metric.label} className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-caps text-fg-muted">
                    {metric.label}
                  </p>
                  <p className="mt-0.5 font-heading text-lg font-semibold tracking-display text-fg-primary">
                    {metric.value}
                  </p>
                  {metric.verify && (
                    <p className="break-words text-xs text-fg-muted">{metric.verify}</p>
                  )}
                </li>
              ))}
            </ul>
          </RoomSection>
        )}

        <RoomShipping fleet={fleet} pace={pace} />
        {fleet && <RoomRoadmap fleet={fleet} />}

        {content.documents.length > 0 && (
          <RoomSection id="documents" title="Documents">
            <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
              {content.documents.map((doc, i) => (
                <li key={`${doc.title}-${i}`}>
                  <a
                    href={ROUTES.ROOM_OPEN(token, 'document', i)}
                    className="flex min-h-11 items-center gap-3 px-4 py-3 text-sm text-fg-primary hover:bg-surface-raised"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
                    <span className="flex-1">{doc.title}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </RoomSection>
        )}

        <RoomFooter ownerName={ownerName} linkLabel={room.linkLabel} isShared={isShared} />
      </article>
    </div>
  );
}
