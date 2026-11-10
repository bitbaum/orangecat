/**
 * Cross-posting from a sister product. The link contract, stated once:
 *
 *   https://orangecat.ch/articles/new?import=<encoded JSON url>&project=<id or slug>
 *
 * Both parameters are optional and survive sign-in (the `from` round trip).
 *
 * - `import`: an https URL on orangecat.ch or a subdomain of it (Solon, BiasLens,
 *   …), URL-encoded, answering JSON of the shape
 *   `{ article: { title, body (markdown), excerpt?, canonical?, author? } }`
 *   (a bare `{ title, body, … }` is accepted too). It seeds the editor; the
 *   writer reviews and publishes. Only fleet hosts may be imported, over HTTPS,
 *   and the payload shape is checked here — the one place that knows it.
 * - `project`: one of the writer's own projects, by id or by the slug of its
 *   title (`project=solon` for "Solon"). It is preselected under "Also post on";
 *   a project that is not theirs is not chosen and the composer says so
 *   (`src/services/articles/project-walls.ts`).
 *
 * Example: `/articles/new?import=https%3A%2F%2Fbiaslens.orangecat.ch%2Fapi%2Fwriting%2F<id>&project=solon`
 */

/** Hosts whose article JSON the composer will read. */
export const IMPORT_HOST_SUFFIXES = ['orangecat.ch'] as const;

export const IMPORT_MAX_BYTES = 400_000;

export interface ImportedArticle {
  title: string;
  excerpt?: string;
  body: string;
  /** Where the article was first published; appended to the body as attribution. */
  canonical?: string;
  author?: string;
  /** The site it came from, for the composer's notice. */
  host: string;
}

/** Accept only an https URL on a fleet host; never a bare IP, never a credential. */
export function importSourceAllowed(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const allowed = IMPORT_HOST_SUFFIXES.some(
    suffix => host === suffix || host.endsWith('.' + suffix)
  );
  return allowed ? url : null;
}

/** The article inside a sister product's JSON answer, or null when it is not one. */
export function parseImportedArticle(payload: unknown, host: string): ImportedArticle | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const root = payload as { article?: unknown } & Record<string, unknown>;
  const article = (root.article ?? root) as Record<string, unknown>;
  if (typeof article.title !== 'string' || typeof article.body !== 'string') {
    return null;
  }
  const title = article.title.trim();
  const body = article.body.trim();
  if (!title || !body) {
    return null;
  }
  const text = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;
  const canonical = text(article.canonical);
  return {
    title,
    body,
    excerpt: text(article.excerpt),
    canonical: canonical && importSourceAllowed(canonical) ? canonical : undefined,
    author: text(article.author),
    host,
  };
}

/** The body as the composer receives it: the text, then where it first appeared. */
export function bodyWithAttribution(article: ImportedArticle): string {
  if (!article.canonical) {
    return article.body;
  }
  return `${article.body}\n\n---\n\n*First published on [${article.host}](${article.canonical}).*`;
}
