/**
 * The door — one sentence in, the right thing out.
 *
 * Not a search box: this submits an intent to Cat, so searchkit does not apply.
 * Uses the shared field tokens and Button while retaining native GET submission.
 *
 * A plain GET form to the Cat: no JavaScript needed, works before sign-in
 * (the middleware sends the visitor through login and back to the Cat with
 * the sentence intact), and the Cat page already auto-sends `?q=` into an
 * empty conversation and answers with a draft card. Wherever a surface once
 * offered a grid of nouns, it now offers this first and the grid second.
 */
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { CAT_DOOR, CAT_QUERY_PARAM } from '@/config/cat-door';
import { cn } from '@/lib/utils';
import { COMPONENT_STYLES } from '@/config/design-system';
import Button from '@/components/ui/Button';

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
      aria-label="Tell your Cat what you want to do"
      className={cn('w-full', className)}
    >
      <label htmlFor="the-door" className="block font-heading text-lg text-fg-primary">
        {prompt ?? CAT_DOOR.prompt}
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="the-door"
          name={CAT_QUERY_PARAM}
          type="text"
          autoComplete="off"
          required
          minLength={CAT_DOOR.minLength}
          maxLength={CAT_DOOR.maxLength}
          placeholder={placeholder ?? CAT_DOOR.placeholder}
          className={cn(COMPONENT_STYLES.field.control, 'min-h-12 min-w-0 flex-1 px-3 text-base')}
        />
        <Button type="submit" className="min-h-12 gap-1.5">
          {CAT_DOOR.submit}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
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
