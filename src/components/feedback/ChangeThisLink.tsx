'use client';

/**
 * "Change this" — the product is shaped by the person using it.
 *
 * Any surface you do not like, you point at and say how you want it. Loki
 * (OrangeCat's sibling execution layer, embedded as a widget in
 * src/app/layout.tsx) takes it from there: it either builds the experience you
 * asked for, or — when what you want already exists and you could not find it
 * — shows you the way and makes that path findable for the next person. That
 * is the tailored-experience direction: bitbaum/loki
 * docs/architecture/tailored-experience.md (SSOT for it, fleet-wide).
 *
 * Put `data-loki-target` on the surface this control sits in; the control finds
 * it and hands it to the widget preselected, so nobody has to go looking for
 * the thing they were already looking at.
 *
 * Same no-dead-end shape as AiErrorNotice: ALWAYS a real link to the feedback
 * page, upgraded in place only when Loki's panel can actually open.
 */

import Link from 'next/link';
import { Wand2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import { ROUTES } from '@/config/routes';
import { reportToLoki } from '@/lib/feedback/report';
import { cn } from '@/lib/utils';

interface ChangeThisLinkProps {
  /** What the surface is, in the person's words ("this draft card"). */
  subject: string;
  /** Machine-readable name of the surface, for triage. */
  surface: string;
  className?: string;
}

export function ChangeThisLink({ subject, surface, className }: ChangeThisLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const target = e.currentTarget.closest('[data-loki-target]') ?? undefined;
    const opened = reportToLoki({
      message: `I'd like ${subject} to work differently: `,
      diagnostics: { surface, path: window.location.pathname },
      target,
    });
    if (opened) {
      e.preventDefault();
    }
  };

  return (
    <Link
      href={ROUTES.FEEDBACK}
      onClick={handleClick}
      title="Not how you want it? Point Loki at it — it changes it for you or shows you the way."
      className={cn(
        'inline-flex min-h-11 items-center gap-1 text-xs font-medium text-fg-tertiary transition-colors hover:text-fg-primary',
        className
      )}
    >
      <Wand2 className="h-3.5 w-3.5" />
      Change this
    </Link>
  );
}
