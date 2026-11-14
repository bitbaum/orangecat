import { ArrowRight } from 'lucide-react';
import { CAT_QUERY_PARAM } from '@/config/cat-door';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

interface DoorExamplesProps {
  examples?: readonly string[];
  className?: string;
  /**
   * Ask the sentence here instead of opening the Cat with it: the home page's
   * door answers a visitor in place. Without it each example is a link.
   */
  onPick?: (example: string) => void;
}

/**
 * The example sentences under a Cat door ("What do you want to do?"), shared
 * by every Cat door (TheDoor), signed in or not.
 *
 * A suggestion must not look like the field above it: no outline, a quiet
 * fill and an arrow, because tapping one goes to the Cat with the sentence
 * already asked. On a phone they are one row that scrolls sideways, so five
 * sentences do not push the page a quarter of a screen down; from `sm` they
 * are an even grid, and an odd one out takes the whole last row.
 */
const EXAMPLE_CLASS =
  'flex min-h-11 w-full items-center justify-between gap-3 whitespace-nowrap rounded-md bg-surface-raised px-3 py-2 text-left text-sm text-fg-secondary hover:bg-surface-overlay hover:text-fg-primary sm:whitespace-normal';

export function DoorExamples({ examples, className, onPick }: DoorExamplesProps) {
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
          {onPick ? (
            <button type="button" className={EXAMPLE_CLASS} onClick={() => onPick(example)}>
              {example}
              <ArrowRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden />
            </button>
          ) : (
            <a
              href={`${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(example)}`}
              className={EXAMPLE_CLASS}
            >
              {example}
              <ArrowRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
