/**
 * Page → Cat context: turns the URL the user is currently on into a small,
 * safe descriptor Cat can reason about ("they're looking at project abc123").
 * This is what makes the global Cat launcher page-AWARE instead of generic —
 * open it on a project and Cat knows the project, open it on an article and it
 * knows the article. Client- and server-safe (no imports beyond types).
 *
 * Deliberately conservative: we only claim an entity for routes we recognise,
 * and never treat create/edit sub-routes as an entity ref.
 */

export interface CatPageEntity {
  /** Entity kind, e.g. 'project', 'article', 'profile'. */
  type: string;
  /** The id or slug from the URL. */
  ref: string;
}

export interface CatPageDescriptor {
  /** The absolute in-app path (same-origin). */
  path: string;
  /** Human phrase for UI ("a project", "your dashboard"). */
  label?: string;
  /** Recognised entity when the path is an entity view. */
  entity?: CatPageEntity;
}

/** Sub-route segments that are actions, not entity refs. */
const RESERVED_REFS = new Set(['new', 'create', 'edit', 'settings']);

interface Pattern {
  re: RegExp;
  type: string;
  label: string;
}

// Ordered most-specific first. `([^/]+)` captures the id/slug.
const ENTITY_PATTERNS: Pattern[] = [
  { re: /^\/projects\/([^/]+)/, type: 'project', label: 'a project' },
  { re: /^\/profiles\/([^/]+)/, type: 'profile', label: "a member's profile" },
  { re: /^\/(?:articles|blog)\/([^/]+)/, type: 'article', label: 'an article' },
  { re: /^\/groups\/([^/]+)/, type: 'group', label: 'a group' },
  { re: /^\/events\/([^/]+)/, type: 'event', label: 'an event' },
  { re: /^\/causes\/([^/]+)/, type: 'cause', label: 'a cause' },
  { re: /^\/assets\/([^/]+)/, type: 'asset', label: 'an asset' },
];

// Non-entity areas worth naming so Cat knows the surface the user is on.
const AREA_LABELS: Array<{ re: RegExp; label: string }> = [
  {
    re: /^\/dashboard\/info\/edit/,
    label: 'your profile editor (offer to fill it in with update_profile)',
  },
  { re: /^\/dashboard\/store/, label: 'your store' },
  { re: /^\/dashboard\/wallet/, label: 'your wallet' },
  { re: /^\/dashboard(\/|$)/, label: 'your dashboard' },
  { re: /^\/discover/, label: 'the discover feed' },
  { re: /^\/timeline/, label: 'the timeline' },
  { re: /^\/search/, label: 'search' },
  { re: /^\/settings/, label: 'your settings' },
  { re: /^\/pricing/, label: 'the pricing page' },
];

/**
 * Character cap for the visible-page excerpt sent alongside currentPath.
 * ~450 tokens: enough for a settings page's headings and copy, small enough
 * to never crowd out the rest of the context budget. Client trims to this;
 * the server schema enforces it again.
 */
export const PAGE_EXCERPT_MAX_CHARS = 1800;

/**
 * Capture what the user can actually SEE on the current page, so Cat helps
 * with the real page instead of hallucinating a plausible one. Path labels
 * alone ("your settings") tell Cat WHERE the user is but not WHAT is there —
 * and app surfaces (unlike entities) have no lookup tool, so without this
 * excerpt the model invents sections that don't exist.
 *
 * Reads `<main>` only — the Cat overlay and navigation mount outside it, so
 * the excerpt never captures the chat conversation itself. Client-only;
 * returns undefined during SSR or when there's nothing readable.
 */
export function readPageExcerptForCat(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const root = document.querySelector<HTMLElement>('main');
  if (!root) {
    return undefined;
  }
  const clean = (root.innerText ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  if (!clean) {
    return undefined;
  }
  return clean.length > PAGE_EXCERPT_MAX_CHARS
    ? `${clean.slice(0, PAGE_EXCERPT_MAX_CHARS)}…`
    : clean;
}

/**
 * Describe the current page for Cat. Returns undefined for anything that isn't a
 * safe same-origin path (so callers can simply skip sending page context).
 */
export function describePageForCat(pathname: string | null | undefined): CatPageDescriptor | null {
  if (!pathname || !pathname.startsWith('/')) {
    return null;
  }
  const path = pathname.slice(0, 200);

  for (const p of ENTITY_PATTERNS) {
    const m = path.match(p.re);
    if (m) {
      const ref = decodeURIComponent(m[1]);
      const isEntity = !RESERVED_REFS.has(ref.toLowerCase());
      return {
        path,
        label: isEntity ? p.label : `creating ${p.label}`,
        entity: isEntity ? { type: p.type, ref } : undefined,
      };
    }
  }

  for (const a of AREA_LABELS) {
    if (a.re.test(path)) {
      return { path, label: a.label };
    }
  }

  return { path };
}
