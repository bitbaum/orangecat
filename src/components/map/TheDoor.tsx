/**
 * The door — one sentence in, the right thing out.
 *
 * A plain GET form to the Cat: no JavaScript needed, works before sign-in
 * (the middleware sends the visitor through login and back to the Cat with
 * the sentence intact), and the Cat page already auto-sends `?q=` into an
 * empty conversation and answers with a draft card. Wherever a surface once
 * offered a grid of nouns, it now offers this first and the grid second.
 */
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { CAT_QUERY_PARAM } from '@/config/cat-door';
import { cn } from '@/lib/utils';

interface TheDoorProps {
  /** The question above the box. Defaults to the platform's. */
  prompt?: string;
  placeholder?: string;
  className?: string;
  /** A short row of example sentences the visitor can tap. */
  examples?: readonly string[];
}

export function TheDoor({ prompt, placeholder, className, examples }: TheDoorProps) {
  return (
    <form
      action={ROUTES.DASHBOARD.CAT}
      method="get"
      role="search"
      aria-label="Tell your Cat what you want to do"
      className={cn('w-full', className)}
    >
      <label htmlFor="the-door" className="block font-heading text-lg text-fg-primary">
        {prompt ?? 'What do you want to do?'}
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="the-door"
          name={CAT_QUERY_PARAM}
          type="text"
          autoComplete="off"
          required
          minLength={3}
          maxLength={500}
          placeholder={placeholder ?? 'Describe what you want to do…'}
          className="min-h-12 min-w-0 flex-1 rounded-md border border-default bg-surface-base px-3 text-base text-fg-primary placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-md bg-fg-primary px-4 text-sm font-semibold text-fg-inverted hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ask Cat
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {examples && examples.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Examples">
          {examples.map(example => (
            <li key={example}>
              <a
                href={`${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(example)}`}
                className="inline-block rounded-full border border-default px-3 py-1.5 text-xs text-fg-secondary hover:border-interactive hover:text-fg-primary"
              >
                {example}
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export default TheDoor;
