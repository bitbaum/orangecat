/**
 * An investor room as the person it was sent to reads it (ADR-0012).
 *
 * Server-rendered and static: everything a visitor can follow goes through
 * `/room/<token>/open/...`, so the owner sees what was opened. The page names
 * who it was shared with, because a link that says "for Anna" is one Anna does
 * not forward.
 */

import { ArrowUpRight, FileText, Hammer, Mail, Presentation } from 'lucide-react';
import { COMPONENT_STYLES } from '@/config/design-system';
import { cn } from '@/lib/utils';
import { roomParagraphs } from '@/config/project-room';
import { ROUTES } from '@/config/routes';
import { APP_NAME } from '@/config/brand';
import { APP_LOCALE } from '@/utils/locale';
import { visibleSections } from '@/domain/projectRooms/content';
import type { VisitorRoom } from '@/domain/projectRooms/types';

interface RoomViewProps {
  token: string;
  room: VisitorRoom;
  ownerName: string;
  isShared: boolean;
  hasBuildRecord: boolean;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * A plain <a> styled as a button — deliberately not the ui Button with an
 * href, which renders a Next Link and PREFETCHES: every room view would fetch
 * /open/deck and /open/build and record opens nobody clicked.
 */
function RoomAction({
  href,
  variant,
  children,
}: {
  href: string;
  variant: 'accent' | 'outline' | 'ghost';
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={cn(
        COMPONENT_STYLES.button.base,
        COMPONENT_STYLES.button.variants[variant],
        COMPONENT_STYLES.button.sizes.lg
      )}
    >
      {children}
    </a>
  );
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

export function RoomView({ token, room, ownerName, isShared, hasBuildRecord }: RoomViewProps) {
  const { project, content, linkLabel } = room;
  const sections = visibleSections(content);
  const isEmpty =
    sections.length === 0 &&
    content.metrics.length === 0 &&
    !content.deck_url &&
    content.documents.length === 0;

  return (
    <div className="min-h-[calc(100svh-4rem)] bg-surface-page">
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <p className="text-xs font-medium uppercase tracking-caps text-fg-muted">
          Investor room · {isShared ? 'Private' : `Private, for ${linkLabel}`}
        </p>

        <header className="mt-4">
          {project.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- owner-supplied URL on any host
            <img
              src={project.cover_image_url}
              alt=""
              className="mb-6 aspect-[3/1] w-full rounded-xl border border-border-subtle object-cover"
            />
          )}
          <h1 className="font-heading text-3xl font-semibold tracking-display text-fg-primary sm:text-4xl">
            {project.title}
          </h1>
          {(content.headline || project.description) && (
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-fg-secondary">
              {content.headline || project.description}
            </p>
          )}
          {project.website_url && (
            <a
              href={project.website_url}
              rel="noreferrer"
              target="_blank"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-fg-primary underline underline-offset-4"
            >
              {hostOf(project.website_url)}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          )}
        </header>

        {(content.deck_url || hasBuildRecord || content.contact_email) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {content.deck_url && (
              <RoomAction variant="accent" href={ROUTES.ROOM_OPEN(token, 'deck')}>
                <Presentation className="h-4 w-4" aria-hidden />
                Open the deck
              </RoomAction>
            )}
            {hasBuildRecord && (
              <RoomAction variant="outline" href={ROUTES.ROOM_OPEN(token, 'build')}>
                <Hammer className="h-4 w-4" aria-hidden />
                Build record
              </RoomAction>
            )}
            {content.contact_email && (
              <RoomAction variant="ghost" href={`mailto:${content.contact_email}`}>
                <Mail className="h-4 w-4" aria-hidden />
                {content.contact_email}
              </RoomAction>
            )}
          </div>
        )}

        {content.metrics.length > 0 && (
          <section className="mt-12 border-t border-border-subtle pt-8" aria-label="The numbers">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-3">
              {content.metrics.map(metric => (
                <li key={metric.label}>
                  <p className="text-xs font-medium uppercase tracking-caps text-fg-muted">
                    {metric.label}
                  </p>
                  <p className="mt-0.5 font-heading text-lg font-semibold tracking-display text-fg-primary">
                    {metric.value}
                  </p>
                  {metric.verify && <p className="text-xs text-fg-muted">{metric.verify}</p>}
                </li>
              ))}
            </ul>
            {content.metrics_as_of && (
              <p className="mt-5 text-xs font-medium uppercase tracking-caps text-fg-muted">
                Counted {formatAsOf(content.metrics_as_of)}
              </p>
            )}
          </section>
        )}

        {isEmpty && (
          <p className="mt-12 rounded-lg border border-border-subtle bg-surface-raised p-5 text-sm text-fg-secondary">
            {ownerName} is still preparing this room. The link will keep working — come back to it
            later.
          </p>
        )}

        {sections.map(section => (
          <section key={section.title} className="mt-12 border-t border-border-subtle pt-8">
            <h2 className="font-heading text-xl font-semibold tracking-display text-fg-primary">
              {section.title}
            </h2>
            <div className="mt-3 space-y-4">
              {roomParagraphs(section.body).map(paragraph => (
                <p
                  key={paragraph.slice(0, 48)}
                  className="whitespace-pre-line text-base leading-relaxed text-fg-secondary"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}

        {content.documents.length > 0 && (
          <section className="mt-12 border-t border-border-subtle pt-8">
            <h2 className="font-heading text-xl font-semibold tracking-display text-fg-primary">
              Documents
            </h2>
            <ul className="mt-4 divide-y divide-border-subtle rounded-lg border border-border-subtle">
              {content.documents.map((doc, index) => (
                <li key={`${doc.title}-${index}`}>
                  <a
                    href={ROUTES.ROOM_OPEN(token, 'document', index)}
                    className="flex min-h-11 items-center gap-3 px-4 py-3 text-sm text-fg-primary hover:bg-surface-raised"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
                    <span className="flex-1">{doc.title}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-16 border-t border-border-subtle pt-6 text-xs leading-5 text-fg-muted">
          {isShared
            ? `Shared privately by ${ownerName}.`
            : `Shared privately by ${ownerName} with ${linkLabel}. This link is yours — if someone else should see the room, ask ${ownerName} for a link of their own.`}{' '}
          Hosted on {APP_NAME}.
        </footer>
      </article>
    </div>
  );
}
