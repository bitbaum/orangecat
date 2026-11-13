import { ArrowRight } from 'lucide-react';
import { CAT_QUERY_PARAM } from '@/config/cat-door';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

interface DoorExamplesProps {
  examples?: readonly string[];
  className?: string;
}

/**
 * The example sentences under a Cat door ("What do you want to do?"), shared
 * by the signed-in door (DashboardIntent) and the public one (TheDoor).
 *
 * A suggestion must not look like the field above it: no outline, a quiet
 * fill and an arrow, because tapping one goes to the Cat with the sentence
 * already asked. On a phone they are one row that scrolls sideways, so five
 * sentences do not push the page a quarter of a screen down; from `sm` they
 * are an even grid, and an odd one out takes the whole last row.
 */
export function DoorExamples({ examples, className }: DoorExamplesProps) {
  if (!examples || examples.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="Examples"
      className={cn(
        'no-scrollbar flex gap-2 overflow-x-auto sm:grid sm:max-w-2xl sm:grid-cols-2 sm:overflow-visible',
        className
      )}
    >
      {examples.map(example => (
        <li key={example} className="shrink-0 sm:last:odd:col-span-2">
          <a
            href={`${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(example)}`}
            className="flex min-h-11 items-center justify-between gap-3 whitespace-nowrap rounded-md bg-surface-raised px-3 py-2 text-sm text-fg-secondary hover:bg-surface-overlay hover:text-fg-primary sm:whitespace-normal"
          >
            {example}
            <ArrowRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
