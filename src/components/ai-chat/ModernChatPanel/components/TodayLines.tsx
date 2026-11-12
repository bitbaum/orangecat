/**
 * What needs the person today, over the Cat's empty chat: each line is an
 * action and IS the link that does it, so one tap acts on it. Nothing here is
 * a count — the owner's test is "read it and tap once" (2026-11-02). The last
 * row opens their day in Loki, which owns the day. Composed server-side in
 * services/cat/today-lines; this file only lays it out.
 */

import Link from 'next/link';
import { ArrowUpRight, Check, ChevronRight } from 'lucide-react';
import type { CatToday } from '@/config/cat-prompts';

/** An absolute URL leaves OrangeCat (Loki); a path stays in the app. */
const isExternal = (href: string): boolean => /^https?:\/\//i.test(href);

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  const Icon = isExternal(href) ? ArrowUpRight : ChevronRight;
  return (
    <Link href={href} className="oc-chat-today-row">
      <span className="min-w-0 flex-1">{children}</span>
      <Icon className="h-4 w-4 flex-shrink-0 text-fg-tertiary" aria-hidden="true" />
    </Link>
  );
}

export function TodayLines({ today }: { today: CatToday }) {
  return (
    <nav className="oc-chat-today" aria-label="What needs you today">
      {today.lines.length === 0 ? (
        <p className="oc-chat-today-row mb-0 text-fg-secondary">
          <Check className="h-4 w-4 flex-shrink-0 text-status-positive" aria-hidden="true" />
          <span className="min-w-0 flex-1">Nothing needs you right now.</span>
        </p>
      ) : (
        today.lines.map(line => (
          <Row key={line.key} href={line.href}>
            {line.urgent && <span className="sr-only">Urgent: </span>}
            {line.urgent && (
              <span
                className="mr-2 inline-block h-2 w-2 rounded-full bg-status-negative align-middle"
                aria-hidden="true"
              />
            )}
            {line.text}
          </Row>
        ))
      )}
      {today.day && (
        <Row href={today.day.href}>
          <span className="font-medium">{today.day.label}</span>
        </Row>
      )}
    </nav>
  );
}
