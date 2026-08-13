import { requiresAuthentication } from './route-access';

/**
 * App Router compatibility/adapter destinations.
 *
 * `route-aliases.json` owns Next-config redirects. These entries cover pages
 * that still exist in `src/app` only to forward old or guessed URLs to the
 * canonical surface. The route audit consumes the same table, so a redirect
 * can never pass merely because it happened to land on some 2xx HTML page.
 */
export const APP_PAGE_REDIRECTS = {
  '/ai-assistants': '/discover?type=ai_assistants',
  '/assets': '/discover?type=assets',
  '/assets/create': '/dashboard/assets/create',
  '/causes': '/discover?type=causes',
  '/circles': '/discover?type=circles',
  '/coming-soon': '/discover',
  '/create': '/dashboard/projects/create',
  '/documents': '/dashboard/documents',
  '/events/create': '/dashboard/events/create',
  '/groups': '/discover?type=groups',
  '/groups/create': '/dashboard/groups/create',
  '/investments': '/discover?type=investments',
  '/loans': '/discover?type=loans',
  '/onboarding': '/onboarding/intelligent',
  '/products': '/discover?type=products',
  '/projects': '/discover?type=projects',
  '/projects/create': '/dashboard/projects/create',
  '/research': '/discover?type=research',
  '/services': '/discover?type=services',
  '/wishlists': '/discover?type=wishlists',
} as const;

export const APP_PAGE_DYNAMIC_REDIRECTS = [
  {
    source: /^\/create\/[^/]+$/,
    /** Bundled audit fixture is `/create/project`. */
    destination: () => '/dashboard/projects/create',
  },
  {
    source: /^\/documents\/([^/]+)$/,
    destination: (match: RegExpMatchArray) => `/dashboard/documents/${match[1]}`,
  },
  {
    source: /^\/messages\/([^/]+)$/,
    destination: (match: RegExpMatchArray) => `/messages?id=${match[1]}`,
  },
  {
    source: /^\/profile\/([^/]+)$/,
    destination: (match: RegExpMatchArray) => canonicalProfilePath(match[1]),
  },
  {
    source: /^\/project\/([^/]+)$/,
    destination: (match: RegExpMatchArray) => `/projects/${match[1]}`,
  },
] as const;

function canonicalProfilePath(encodedUsername: string): string {
  return new URL(encodedUsername, 'https://orangecat.invalid/profiles/').pathname;
}

export interface RedirectExpectation {
  exact?: readonly string[];
  pathnamePrefixes?: readonly string[];
}

export interface RouteAliasLike {
  source: string;
  destination: string;
}

export function expectedAliasDestination(
  requestedPath: string,
  aliases: readonly RouteAliasLike[]
): RedirectExpectation | null {
  const requested = new URL(requestedPath, 'https://orangecat.invalid');

  for (const alias of aliases) {
    const sourceParts = alias.source.split('/');
    const requestedParts = requested.pathname.split('/');
    const values = new Map<string, string>();
    let matches = true;

    for (let index = 0; index < sourceParts.length; index += 1) {
      const sourcePart = sourceParts[index];
      const requestedPart = requestedParts[index];
      if (sourcePart === ':path*') {
        values.set(':path', requestedParts.slice(index).join('/'));
        break;
      }
      if (sourcePart.startsWith(':')) {
        if (!requestedPart) {
          matches = false;
          break;
        }
        values.set(sourcePart, requestedPart);
      } else if (sourcePart !== requestedPart) {
        matches = false;
        break;
      }
    }
    if (
      !matches ||
      (sourceParts.at(-1) !== ':path*' && sourceParts.length !== requestedParts.length)
    ) {
      continue;
    }

    let destination = alias.destination;
    for (const [parameter, value] of values) {
      destination = destination.replace(`${parameter}*`, value).replace(parameter, value);
    }
    return { exact: [destination] };
  }

  return null;
}

/** Expected browser terminal after Next redirects and the auth boundary. */
export function expectedAliasTerminalDestination(
  requestedPath: string,
  aliases: readonly RouteAliasLike[]
): RedirectExpectation | null {
  const direct = expectedAliasDestination(requestedPath, aliases);
  const directDestination = direct?.exact?.length === 1 ? direct.exact[0] : null;
  if (!directDestination) {
    return direct;
  }

  const destinationUrl = new URL(directDestination, 'https://orangecat.invalid');
  if (!requiresAuthentication(destinationUrl.pathname)) {
    return direct;
  }

  const search = new URLSearchParams({
    mode: 'login',
    from: `${destinationUrl.pathname}${destinationUrl.search}`,
  });
  return { exact: [`/auth?${search.toString()}`] };
}

const APP_PAGE_REDIRECT_FAMILIES: Partial<Record<string, readonly string[]>> = {
  '/dashboard': ['/dashboard/cat'],
  '/dashboard/info': ['/profiles/', '/dashboard/info/edit'],
  '/donations': ['/discover'],
  '/pages': ['/discover'],
  '/profile': ['/profiles/'],
  '/profile/setup': ['/profiles/', '/dashboard/info/edit'],
  '/profiles/me': ['/profiles/', '/dashboard/info/edit'],
};

export function expectedAppPageDestination(
  routePattern: string,
  requestedPath: string
): RedirectExpectation | null {
  const requested = new URL(requestedPath, 'https://orangecat.invalid');
  const redirectFamilies = APP_PAGE_REDIRECT_FAMILIES[routePattern];
  if (redirectFamilies) {
    return { pathnamePrefixes: redirectFamilies };
  }

  const staticDestination =
    APP_PAGE_REDIRECTS[requested.pathname as keyof typeof APP_PAGE_REDIRECTS];
  if (staticDestination) {
    return { exact: [staticDestination] };
  }

  for (const redirect of APP_PAGE_DYNAMIC_REDIRECTS) {
    const match = requested.pathname.match(redirect.source);
    if (match) {
      return { exact: [redirect.destination(match)] };
    }
  }

  if (routePattern === '/[username]') {
    return { exact: [canonicalProfilePath(requested.pathname.slice(1))] };
  }

  return null;
}

export function matchesRedirectExpectation(
  finalPathAndSearch: string,
  expectation: RedirectExpectation
): boolean {
  if (expectation.exact?.includes(finalPathAndSearch)) {
    return true;
  }

  const finalPathname = new URL(finalPathAndSearch, 'https://orangecat.invalid').pathname;
  return (
    expectation.pathnamePrefixes?.some(prefix =>
      prefix.endsWith('/')
        ? finalPathname.startsWith(prefix)
        : finalPathname === prefix || finalPathname.startsWith(`${prefix}/`)
    ) ?? false
  );
}
