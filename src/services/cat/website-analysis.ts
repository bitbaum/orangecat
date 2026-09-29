/**
 * Website analysis — safe server-side fetcher behind the Cat's analyze_website tool.
 *
 * A user pastes their business site URL into the chat ("here's my site — set me
 * up"); the Cat fetches it here, strips it to readable text, and grounds its
 * entity proposals STRICTLY in that text (no invented entities — see the
 * offer-engine grounding rules this mirrors).
 *
 * Safety model (SSRF):
 * - only http(s) URLs, only default ports (80/443)
 * - DNS is resolved and EVERY address must be public — loopback, private
 *   (RFC 1918), link-local, CGNAT, ULA, and v4-mapped ranges are rejected
 * - redirects are followed manually (max 3) and every hop is re-validated
 * - 8s timeout, 1.5 MB response cap, text/html only
 *
 * Known TOCTOU caveat: after validating the DNS answer we fetch by hostname, so
 * a malicious authoritative server could re-answer with a private IP between
 * lookup and connect. Accepted for now — pinning the connection to the resolved
 * IP breaks TLS SNI/cert validation without an undici custom dialer.
 *
 * No heavy deps by design: cheerio is not in package.json, so extraction is a
 * small regex stripper (title + meta description + headings + visible text).
 * Limitation: JS-rendered (SPA) sites yield little or no text.
 */

import { isPrivateAddress } from '@/lib/security/private-address';

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1.5 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 8_000;
const USER_AGENT = 'OrangeCat/1.0 (+https://orangecat.ch; website-analysis)';

// ── URL extraction from a chat message ──────────────────────────────────────

/**
 * Matches http(s) URLs, bare `www.` hosts, AND schemeless domain-like tokens
 * (e.g. `revampit.orangecat.ch`, `foo.bar/path`) in free text.
 *
 * The bare-domain branch requires: not preceded by `@`/word chars/`.`/`-`
 * (so email addresses and mid-domain starts never match), one or more
 * dot-separated labels, and a final alphabetic label of 2+ chars (so version
 * numbers like "3.5" and abbreviations like "e.g." never match).
 */
const MESSAGE_URL_REGEX =
  /\b(?:https?:\/\/|www\.)[^\s<>"'`]+|(?<![@\w.-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b(?:\/[^\s<>"'`]*)?/gi;

/** Trailing punctuation that belongs to the sentence, not the URL. */
const TRAILING_PUNCTUATION_REGEX = /[.,;:!?)\]}»”"']+$/;

/** Prepend `https://` to a schemeless URL/domain token. Already-schemed input passes through. */
export function normalizeToHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Extract every URL the user actually typed. Schemeless hosts (`www.` or bare
 * domains like `foo.bar.ch`) are normalized to `https://`. Non-parseable
 * candidates are dropped.
 */
export function extractHttpUrls(message: string): string[] {
  const matches = message.match(MESSAGE_URL_REGEX) ?? [];
  const urls: string[] = [];
  for (const raw of matches) {
    const cleaned = raw.replace(TRAILING_PUNCTUATION_REGEX, '');
    const candidate = normalizeToHttpUrl(cleaned);
    try {
      urls.push(new URL(candidate).href);
    } catch {
      // Not a real URL (e.g. "www." mid-sentence) — skip.
    }
  }
  return urls;
}

/**
 * True when the message is NOTHING BUT a single URL/domain (plus punctuation).
 * A user who sends only "revampit.orangecat.ch" means "analyze this site and
 * set me up" — there is no other plausible chat intent in a bare address.
 */
export function isUrlOnlyMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) {
    return false;
  }
  const matches = trimmed.match(MESSAGE_URL_REGEX) ?? [];
  if (matches.length !== 1) {
    return false;
  }
  const remainder = trimmed.replace(matches[0], '').replace(TRAILING_PUNCTUATION_REGEX, '').trim();
  if (remainder) {
    return false;
  }
  return extractHttpUrls(trimmed).length === 1;
}

/** Normalized comparison key so "https://X.com/" and "https://x.com" match. */
function urlKey(href: string): string {
  try {
    const u = new URL(href);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.port ? `:${u.port}` : ''}${u.pathname.replace(/\/$/, '')}${u.search}`;
  } catch {
    return href;
  }
}

/**
 * The tool only fetches URLs actually present in the user's message. Given the
 * model-provided url and the message, return the message URL it refers to —
 * or null if the message contains no matching URL.
 */
export function resolveRequestedUrl(modelUrl: string, userMessage: string): string | null {
  const inMessage = extractHttpUrls(userMessage);
  if (inMessage.length === 0) {
    return null;
  }
  // Models often echo the user's schemeless input verbatim — normalize before comparing.
  const wanted = urlKey(normalizeToHttpUrl(modelUrl));
  const match = inMessage.find(u => urlKey(u) === wanted);
  if (match) {
    return match;
  }
  // Model paraphrased/normalized the URL: if the message has exactly one, it
  // can only mean that one. With several and no match, refuse (never fetch a
  // URL the user didn't paste).
  return inMessage.length === 1 ? inMessage[0] : null;
}

// ── SSRF guards ──────────────────────────────────────────────────────────────
// SSOT: @/lib/security/ssrfGuard. This module once carried its own copy of
// isPrivateAddress — a forked guard is a hole waiting to happen (a range added
// to one and not the other). Re-exported so callers/tests keep one import path.
export { isPrivateAddress } from '@/lib/security/private-address';

function looksLikeIpLiteral(hostname: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':');
}

export interface UrlValidationOk {
  ok: true;
  url: URL;
}
export interface UrlValidationError {
  ok: false;
  error: string;
}

/** Static (pre-DNS) validation: scheme, port, obvious local hosts, IP literals. */
export function validateTargetUrl(rawUrl: string): UrlValidationOk | UrlValidationError {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'Not a valid URL.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Only http(s) URLs can be analyzed.' };
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    return { ok: false, error: 'Only standard web ports (80/443) are allowed.' };
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return {
      ok: false,
      error: 'This address points to a local/private network and cannot be fetched.',
    };
  }
  if (looksLikeIpLiteral(hostname) && isPrivateAddress(hostname)) {
    return {
      ok: false,
      error: 'This address points to a local/private network and cannot be fetched.',
    };
  }
  return { ok: true, url };
}

// ── Injectable deps (tests mock these; prod uses global fetch + node DNS) ────

/** Minimal structural view of a fetch Response — lets tests pass plain objects. */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body?: {
    getReader(): {
      read(): Promise<{ done: boolean; value?: Uint8Array }>;
      cancel(): Promise<void> | void;
    };
  } | null;
  text(): Promise<string>;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<FetchResponseLike>;
export type LookupLike = (hostname: string) => Promise<Array<{ address: string }>>;

export interface WebsiteFetchDeps {
  fetchFn?: FetchLike;
  lookupFn?: LookupLike;
}

/** Default DNS lookup — imported lazily so this module stays client-bundle-safe. */
const defaultLookup: LookupLike = async hostname => {
  const dns = await import('node:dns/promises');
  return dns.lookup(hostname, { all: true, verbatim: true });
};

/** Resolve DNS and reject if ANY answer is a private/non-public address. */
async function assertPublicHost(hostname: string, lookupFn: LookupLike): Promise<string | null> {
  const bare = hostname.replace(/^\[|\]$/g, '');
  if (looksLikeIpLiteral(bare)) {
    return isPrivateAddress(bare) ? 'private address' : null;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookupFn(bare);
  } catch {
    return 'DNS lookup failed';
  }
  if (!addresses.length) {
    return 'DNS lookup returned no addresses';
  }
  if (addresses.some(a => isPrivateAddress(a.address))) {
    return 'private address';
  }
  return null;
}

// ── Fetch with redirects re-validated per hop + size cap ─────────────────────

export type WebsiteFetchResult =
  | { ok: true; url: string; title: string | null; text: string }
  | { ok: false; error: string };

/**
 * Fetch a website's readable text with the full SSRF guard rail. Never throws —
 * failures come back as { ok: false, error } so the tool can relay them.
 */
export async function fetchWebsiteText(
  rawUrl: string,
  deps: WebsiteFetchDeps = {}
): Promise<WebsiteFetchResult> {
  const fetchFn = deps.fetchFn ?? (fetch as unknown as FetchLike);
  const lookupFn = deps.lookupFn ?? defaultLookup;

  // Schemeless input ("revampit.orangecat.ch") is normalized to https:// FIRST,
  // then runs through every SSRF guard exactly like a schemed URL.
  let current = validateTargetUrl(normalizeToHttpUrl(rawUrl));
  if (!current.ok) {
    return { ok: false, error: current.error };
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const target = current.url;
    const hostError = await assertPublicHost(target.hostname, lookupFn);
    if (hostError) {
      return {
        ok: false,
        error: `Cannot fetch ${target.hostname}: ${hostError === 'private address' ? 'it resolves to a local/private network' : hostError}.`,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: FetchResponseLike;
    try {
      res = await fetchFn(target.href, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error && err.name === 'AbortError'
            ? 'The site took too long to respond (8s timeout).'
            : 'Could not reach the site.',
      };
    } finally {
      clearTimeout(timer);
    }

    // Manual redirect handling: re-validate EVERY hop (a public host may 302
    // to an internal address — classic SSRF bounce).
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        return { ok: false, error: 'The site redirected without a destination.' };
      }
      if (hop === MAX_REDIRECTS) {
        return { ok: false, error: `Too many redirects (max ${MAX_REDIRECTS}).` };
      }
      let next: string;
      try {
        next = new URL(location, target).href;
      } catch {
        return { ok: false, error: 'The site redirected to an invalid URL.' };
      }
      current = validateTargetUrl(next);
      if (!current.ok) {
        return { ok: false, error: `Blocked redirect: ${current.error}` };
      }
      continue;
    }

    if (!res.ok) {
      return { ok: false, error: `The site returned HTTP ${res.status}.` };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return {
        ok: false,
        error: `The URL is not an HTML page (content-type: ${contentType || 'unknown'}).`,
      };
    }

    const html = await readBodyCapped(res);
    const extracted = extractReadableText(html);
    if (!extracted.text && !extracted.title) {
      return {
        ok: false,
        error: 'The page had no readable text (it may be fully JavaScript-rendered).',
      };
    }
    return { ok: true, url: target.href, title: extracted.title, text: composeSiteText(extracted) };
  }

  // Loop always returns; this satisfies the compiler.
  return { ok: false, error: `Too many redirects (max ${MAX_REDIRECTS}).` };
}

/** Read the body, stopping at MAX_RESPONSE_BYTES (streamed when possible). */
async function readBodyCapped(res: FetchResponseLike): Promise<string> {
  const reader = res.body?.getReader?.();
  if (!reader) {
    // No stream (some runtimes/tests) — read and cap by length as a fallback.
    const text = await res.text();
    return text.length > MAX_RESPONSE_BYTES ? text.slice(0, MAX_RESPONSE_BYTES) : text;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      if (received >= MAX_RESPONSE_BYTES) {
        await reader.cancel();
        break;
      }
    }
  }
  // Buffer (not TextDecoder) — this is server-only code and Buffer.concat's
  // totalLength arg truncates at the cap in one step.
  return Buffer.concat(
    chunks.map(c => Buffer.from(c.buffer, c.byteOffset, c.byteLength)),
    Math.min(received, MAX_RESPONSE_BYTES)
  ).toString('utf8');
}

// ── HTML → readable text (regex stripper, no deps) ───────────────────────────

export interface ExtractedSiteText {
  title: string | null;
  description: string | null;
  text: string;
}

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, m => ENTITY_MAP[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return n > 31 && n < 65536 ? String.fromCharCode(n) : ' ';
    });
}

/**
 * Strip an HTML document down to what a human would read: title, meta
 * description, headings, visible body text. Scripts, styles, and chrome
 * (nav/footer/aside) are dropped; output is capped at ~8k chars.
 */
export function extractReadableText(html: string): ExtractedSiteText {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() || null
    : null;

  // Meta description — attribute order varies, so find the tag then the content attr.
  let description: string | null = null;
  const metaTag = html.match(/<meta\b[^>]*name\s*=\s*["']description["'][^>]*>/i)?.[0];
  const content = metaTag?.match(/content\s*=\s*["']([\s\S]*?)["']/i);
  if (content) {
    description = decodeEntities(content[1]).replace(/\s+/g, ' ').trim() || null;
  }

  let body = html
    // Non-content + chrome containers go entirely.
    .replace(/<(script|style|noscript|template|svg|iframe|nav|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')
    // Block boundaries become newlines so text doesn't run together.
    .replace(/<\/(p|div|li|tr|section|article|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    // Headings get a marker so structure survives stripping.
    .replace(/<h[1-6][^>]*>/gi, '\n\n## ')
    // Everything else: drop the tags, keep the text.
    .replace(/<[^>]+>/g, ' ');

  body = decodeEntities(body)
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (body.length > MAX_EXTRACTED_CHARS) {
    body = `${body.slice(0, MAX_EXTRACTED_CHARS)}\n[…truncated]`;
  }

  return { title, description, text: body };
}

/** Compose the tool-result text block the model reads. */
function composeSiteText(extracted: ExtractedSiteText): string {
  const parts: string[] = [];
  if (extracted.title) {
    parts.push(`TITLE: ${extracted.title}`);
  }
  if (extracted.description) {
    parts.push(`META DESCRIPTION: ${extracted.description}`);
  }
  if (extracted.text) {
    parts.push('', extracted.text);
  }
  return parts.join('\n').slice(0, MAX_EXTRACTED_CHARS + 400);
}
