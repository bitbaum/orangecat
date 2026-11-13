import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { PageHeading } from './PageHeading';

/**
 * The two content widths a public page may use. A page picks one for its
 * whole body, so moving between sibling pages does not move the column.
 *
 * - `reading`: a document read top to bottom (legal, whitepaper, changelog).
 * - `wide`: a page of cards, grids or tables.
 */
export const PUBLIC_PAGE_WIDTH = {
  reading: 'mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8',
  wide: 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8',
} as const;

interface PublicPageHeaderProps {
  title: ReactNode;
  /** One or two sentences that say what the page is for. */
  lede?: ReactNode;
  /** A short label above the title naming the kind of page ("Building in public"). */
  eyebrow?: ReactNode;
  /** Small print under the lede: a date, a version. */
  meta?: ReactNode;
  /**
   * `center` for a page about OrangeCat (About, Pricing, FAQ). `start` for a
   * document that is read top to bottom, where the title starts the column.
   */
  align?: 'center' | 'start';
  /** Buttons or a short form that belong to the title, under the lede. */
  children?: ReactNode;
  className?: string;
}

/**
 * The one header every public page opens with (fleet rule "One shape per
 * kind": siblings share one frame). It owns the title scale, the lede, the
 * space above and below, and the alignment. It has no icon, pill or raised
 * band on purpose: the title is the first thing on the page.
 *
 * It sets no horizontal padding or outer width. Put it inside the page's
 * container (`PUBLIC_PAGE_WIDTH`), and give that container no top padding:
 * the space above the title belongs to this component.
 */
export function PublicPageHeader({
  title,
  lede,
  eyebrow,
  meta,
  align = 'center',
  children,
  className,
}: PublicPageHeaderProps) {
  const centered = align === 'center';

  return (
    <header
      className={cn(
        'pb-10 pt-12 sm:pb-12 sm:pt-16',
        centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl',
        className
      )}
    >
      {eyebrow ? (
        <p className="mb-3 text-xs font-medium uppercase tracking-caps text-fg-secondary">
          {eyebrow}
        </p>
      ) : null}
      <PageHeading size="display">{title}</PageHeading>
      {lede ? (
        <p
          className={cn(
            'mb-0 mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-fg-secondary',
            centered && 'mx-auto'
          )}
        >
          {lede}
        </p>
      ) : null}
      {meta ? <p className="mb-0 mt-3 text-sm text-fg-tertiary">{meta}</p> : null}
      {children ? <div className="mt-8">{children}</div> : null}
    </header>
  );
}
