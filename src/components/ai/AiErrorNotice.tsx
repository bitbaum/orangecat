'use client';

/**
 * The one way an AI failure is shown to a user.
 *
 * Every AI surface renders failures through this component so the guarantee
 * holds everywhere at once: a failure never dead-ends. It always says what
 * happened in plain language, links to the fix when the fix is a page we own,
 * and always offers a one-click bug report carrying the context a triager needs.
 *
 * Copy and fix links come from @/config/ai-errors (SSOT) — this file decides
 * only how they LOOK, never what they say.
 */

import Link from 'next/link';
import { X, ArrowRight, MessageSquareWarning } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { describeAiError, type AiErrorCode, type AiErrorContext } from '@/config/ai-errors';
import { reportToLoki } from '@/lib/feedback/report';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

interface AiErrorNoticeProps {
  code: AiErrorCode | string | undefined;
  context: AiErrorContext;
  /** Prefix naming what failed, e.g. "Product". Kept short — the title carries the meaning. */
  subject?: string;
  className?: string;
}

export function AiErrorNotice({ code, context, subject, className }: AiErrorNoticeProps) {
  const error = describeAiError(code, context);

  const [reported, setReported] = useState(false);

  // "Report this" is ALWAYS a real link to the feedback page, upgraded in place
  // when Loki's panel can actually open. Deciding it up front — "is the
  // widget there?" — cannot be answered honestly: it loads async behind a
  // server-side kill switch, so any answer at render time may be wrong by the
  // time it is clicked, and a control that might do nothing is the dead end
  // this component exists to remove.
  const handleReport = (e: MouseEvent<HTMLAnchorElement>) => {
    if (reportToLoki({ message: error.reportMessage, diagnostics: error.diagnostics })) {
      e.preventDefault();
      setReported(true);
    }
  };

  return (
    <div
      className={cn(
        'rounded-sm border border-status-negative/20 bg-status-negative/10 px-2 py-1.5 text-xs',
        className
      )}
      role="status"
    >
      <div className="flex items-start gap-1.5 text-status-negative">
        <X className="mt-0.5 h-3 w-3 flex-shrink-0" />
        <span>
          {subject ? <span className="font-medium">{subject}: </span> : null}
          {error.title}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[18px]">
        {error.fix ? (
          <Link
            href={error.fix.href}
            className="inline-flex items-center gap-1 font-medium text-status-negative underline underline-offset-2 hover:no-underline"
          >
            {error.fix.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}

        {reported ? (
          <span className="text-muted-foreground">Thanks — reported.</span>
        ) : (
          <Link
            href={ROUTES.FEEDBACK}
            onClick={handleReport}
            className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:no-underline"
          >
            <MessageSquareWarning className="h-3 w-3" />
            Report this
          </Link>
        )}
      </div>
    </div>
  );
}
