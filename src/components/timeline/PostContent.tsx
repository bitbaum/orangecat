'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { TimelineDisplayEvent, getPostImage } from '@/types/timeline';
import { renderMarkdownToReact } from '@/utils/markdown';
import { TIMELINE_SURFACE } from '@/config/timeline';
import { getExternalAttribution } from '@/config/external-publish';
import { ROUTES } from '@/config/routes';
import { optionalPublicProfilePath } from '@/config/public-profile-path';

interface PostContentProps {
  event: TimelineDisplayEvent;
}

interface RepostAuthorProps {
  author: {
    name: string;
    username: string;
    avatar: string;
  };
}

function RepostAuthor({ author }: RepostAuthorProps) {
  const profileHref = optionalPublicProfilePath(author.username);
  const avatar = (
    // eslint-disable-next-line @next/next/no-img-element -- avatar_url is a free-form user URL (any host); next/image would throw for hosts outside images.remotePatterns
    <img src={author.avatar} alt={author.name} className="w-9 h-9 rounded-full" />
  );

  return (
    <div className="flex items-start gap-3">
      {profileHref ? (
        <Link href={profileHref} className="flex-shrink-0">
          {avatar}
        </Link>
      ) : (
        <span className="flex-shrink-0">{avatar}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          {profileHref ? (
            <Link href={profileHref} className="font-semibold text-fg-primary hover:underline">
              {author.name}
            </Link>
          ) : (
            <span className="font-semibold text-fg-primary">{author.name}</span>
          )}
          {author.username && <span className="text-fg-secondary text-sm">@{author.username}</span>}
        </div>
      </div>
    </div>
  );
}

export function PostContent({ event }: PostContentProps) {
  // Handle repost display
  const isRepost = event.metadata?.is_repost;
  const isQuoteRepost = event.metadata?.is_quote_repost;

  // Original post details for reposts
  const originalAuthor = {
    name: event.metadata?.original_actor_name || event.actor.name || 'Original author',
    username: event.metadata?.original_actor_username || event.actor.username || '',
    avatar: event.metadata?.original_actor_avatar || event.actor.avatar || '/default-avatar.svg',
  };
  const originalDescription = event.metadata?.original_description || '';
  const originalEventId = event.metadata?.original_event_id;

  // Get the content to display
  const getDisplayContent = () => {
    if (isQuoteRepost) {
      return event.description || ''; // Quote text
    }
    if (isRepost && !isQuoteRepost) {
      return event.metadata?.original_description || '';
    }
    return event.description || '';
  };

  const displayContent = getDisplayContent();

  // Article posts carry their long-form body in metadata; the feed shows a
  // compact card linking to the full reader instead of the raw excerpt.
  const articleSlug =
    event.metadata?.is_article && typeof event.metadata?.article?.slug === 'string'
      ? (event.metadata.article.slug as string)
      : null;

  // Read-only surfacing of an externally-published build event (e.g. FleetCrown):
  // a status pill + a "via <source>" deep-link back to the originating surface.
  const attribution = getExternalAttribution(event.metadata);

  // Threads-like: never show separate titles; keep posts conversational
  const _shouldShowTitle = false;

  // Attached image (metadata.image, set via the composer's Openverse picker).
  const postImage = getPostImage(event.metadata);

  return (
    <div className="space-y-2">
      {/* Thread affordance: one-level parent preview + view conversation link */}
      {event.parentEventId && !isRepost && (
        <div className="-mt-1 mb-1 text-xs text-fg-secondary">
          Replying in a thread ·{' '}
          <button
            className="text-fg-primary hover:underline underline-offset-4"
            onClick={() => {
              try {
                const url = new URL(window.location.href);
                url.searchParams.set('focus', event.parentEventId!);
                window.history.replaceState({}, '', url.toString());
                const el = document.querySelector(`[data-event-id="${event.parentEventId}"]`);
                if (el) {
                  (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              } catch {}
            }}
          >
            View conversation
          </button>
        </div>
      )}
      {/* Titles removed for fluid, threads-like design */}

      {/* Article card: title + excerpt + link to the full reader */}
      {articleSlug && (
        <Link
          href={ROUTES.ARTICLE(articleSlug)}
          className={`group/article block overflow-hidden ${TIMELINE_SURFACE.panel} p-3 transition-colors hover:border-default sm:p-4`}
        >
          <span className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
            Article
          </span>
          {event.title && (
            <h3 className="mt-1 text-lg font-semibold leading-snug text-fg-primary group-hover/article:text-accent-warm">
              {event.title}
            </h3>
          )}
          {displayContent && (
            <p className="mt-1 line-clamp-2 text-sm text-fg-secondary">{displayContent}</p>
          )}
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-warm">
            Read article
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/article:translate-x-0.5" />
          </span>
        </Link>
      )}

      {/* Event Description/Content */}
      {!articleSlug && displayContent && (!isRepost || isQuoteRepost) && (
        <div className="text-fg-primary text-[15px] leading-relaxed whitespace-pre-line break-words">
          {renderMarkdownToReact(displayContent)}
        </div>
      )}

      {/* External-publish attribution: status pill + deep-link to the source. */}
      {attribution && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="inline-flex items-center rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-fg-secondary">
            {event.displayType}
          </span>
          {attribution.url ? (
            <a
              href={attribution.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary hover:underline underline-offset-4"
            >
              via {attribution.sourceLabel}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : (
            <span className="text-xs text-fg-secondary">via {attribution.sourceLabel}</span>
          )}
        </div>
      )}

      {/* Subject/Target Links */}
      {(event.subject || event.target) && event.metadata?.is_user_post !== true && (
        <div className="flex gap-2">
          {event.subject && event.subject.url && (
            <Link
              href={event.subject.url}
              className="text-fg-primary hover:underline underline-offset-4 text-sm font-medium"
            >
              {event.subject.name}
            </Link>
          )}
          {event.target && <span className="text-fg-tertiary">→</span>}
          {event.target && event.target.url && (
            <Link
              href={event.target.url}
              className="text-fg-primary hover:underline underline-offset-4 text-sm font-medium"
            >
              {event.target.name}
            </Link>
          )}
        </div>
      )}

      {/* Quoted Original Post (for quote reposts) */}
      {isQuoteRepost && originalEventId && (
        <div className={`mt-3 overflow-hidden ${TIMELINE_SURFACE.panel}`}>
          <div className="p-3 sm:p-4 space-y-2">
            <RepostAuthor author={originalAuthor} />
            {originalDescription ? (
              <div className="text-fg-primary text-sm leading-relaxed whitespace-pre-line break-words">
                {renderMarkdownToReact(originalDescription)}
              </div>
            ) : (
              <div className="text-sm text-fg-secondary">
                Original post
                <Link
                  href={`?focus=${originalEventId}`}
                  className="ml-2 text-fg-primary hover:underline underline-offset-4 font-medium"
                >
                  View
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Simple Repost: show original post inside a quoted card for consistency */}
      {isRepost && !isQuoteRepost && event.metadata?.original_event_id && (
        <div className={`mt-2 overflow-hidden ${TIMELINE_SURFACE.panel}`}>
          <div className="p-3 sm:p-4 space-y-2">
            <RepostAuthor author={originalAuthor} />
            {originalDescription && (
              <div className="text-fg-primary text-sm leading-relaxed whitespace-pre-line break-words">
                {renderMarkdownToReact(originalDescription)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attached image — plain <img>: Openverse hosts aren't in next/image remotePatterns */}
      {postImage && !isRepost && (
        <figure className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- external (Openverse) host, not in next/image remotePatterns */}
          <img
            src={postImage.url}
            alt={postImage.alt || ''}
            loading="lazy"
            className="max-h-[28rem] w-auto max-w-full rounded-lg border border-subtle object-contain"
          />
          {(postImage.credit || postImage.license) && (
            <figcaption className="mt-1 text-2xs text-fg-tertiary">
              {[postImage.credit, postImage.license?.toUpperCase()].filter(Boolean).join(' · ')}
            </figcaption>
          )}
        </figure>
      )}
    </div>
  );
}
