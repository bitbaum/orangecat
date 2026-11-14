import { Home, LayoutDashboard, Search, SearchX } from 'lucide-react';
import Button from '@/components/ui/Button';
import {
  NOT_FOUND_MESSAGE,
  NOT_FOUND_SEARCH,
  notFoundBrowse,
  notFoundHeading,
} from '@/config/not-found';
import { ROUTES } from '@/config/routes';
import type { NotFoundKind } from '@/config/not-found';

/**
 * The one "not found" page. Every route that can miss renders this, with the
 * kind that was missing; nothing else draws a 404.
 *
 * Anatomy, the same for every kind: an icon tile, one heading ("This product
 * isn't here"), one sentence, a search field that hands the words to
 * Discover, then the kind's own shelf ("See all products") and Home. A
 * signed-in reader also gets their dashboard.
 *
 * The search is a plain GET form: it works before hydration and in an
 * unmatched route, and Discover (searchkit) does the finding.
 */
export function NotFound({
  kind = 'page',
  signedIn = false,
}: {
  kind?: NotFoundKind;
  /** Offer the dashboard too. Only the site-wide page knows; it defaults to off. */
  signedIn?: boolean;
}) {
  const browse = notFoundBrowse(kind);

  return (
    <div className="oc-page flex items-center justify-center px-4 py-8">
      <div className="oc-surface w-full max-w-lg space-y-8 p-6">
        <div className="oc-icon-tile mx-auto h-16 w-16">
          <SearchX className="h-8 w-8" aria-hidden />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-semibold text-fg-primary">{notFoundHeading(kind)}</h1>
          <p className="mb-0 mt-3 text-base text-fg-secondary">{NOT_FOUND_MESSAGE}</p>
        </div>

        <form action={NOT_FOUND_SEARCH.action} role="search" className="oc-discover-search !mt-0">
          <Search className="h-5 w-5 flex-shrink-0 text-fg-tertiary" aria-hidden />
          <input
            type="search"
            name="q"
            placeholder={NOT_FOUND_SEARCH.placeholder}
            aria-label={NOT_FOUND_SEARCH.label}
            autoComplete="off"
            enterKeyHint="search"
            className="oc-discover-search-input"
          />
        </form>

        <div className="flex flex-col gap-3">
          <Button href={browse.href} variant="primary" size="lg" className="w-full">
            {browse.label}
          </Button>
          {signedIn && (
            <Button href={ROUTES.DASHBOARD.HOME} variant="outline" size="lg" className="w-full">
              <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden />
              Dashboard
            </Button>
          )}
          <Button href={ROUTES.HOME} variant="outline" size="lg" className="w-full">
            <Home className="mr-2 h-4 w-4" aria-hidden />
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
