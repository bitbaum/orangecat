import { ArrowUpRight, Hammer, Mail, Presentation } from 'lucide-react';
import { COMPONENT_STYLES } from '@/config/design-system';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import type { VisitorRoom } from '@/domain/projectRooms/types';

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

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

interface RoomHeroProps {
  token: string;
  room: VisitorRoom;
  isShared: boolean;
  hasBuildRecord: boolean;
}

/** What it is, whose link this is, and the three things a reader can do first. */
export function RoomHero({ token, room, isShared, hasBuildRecord }: RoomHeroProps) {
  const { project, content, linkLabel } = room;
  return (
    <header>
      <p className="text-xs font-medium uppercase tracking-caps text-fg-muted">
        Investor room · {isShared ? 'Private' : `Private, for ${linkLabel}`}
      </p>
      {project.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- owner-supplied URL on any host
        <img
          src={project.cover_image_url}
          alt=""
          className="mt-4 aspect-[3/1] w-full rounded-xl border border-border-subtle object-cover"
        />
      )}
      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-display text-fg-primary sm:text-4xl">
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
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-fg-primary underline underline-offset-4"
        >
          Try it: {hostOf(project.website_url)}
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      )}

      {(content.deck_url || hasBuildRecord || content.contact_email) && (
        <div className="mt-6 flex flex-wrap gap-3">
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
    </header>
  );
}
