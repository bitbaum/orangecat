#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * audit-routes.mjs — deterministic route-integrity audit.
 *
 * Guards against the "internal link → 404" class of bug:
 *   1. Enumerates the ACTUAL route surface: every page.tsx / route.ts under
 *      src/app (route groups stripped, [param] → dynamic segment).
 *   2. Enumerates DECLARED routes: every path in src/config/routes.ts (ROUTES),
 *      src/config/api-routes.ts (API_ROUTES) and every basePath / createPath /
 *      publicBasePath / apiEndpoint in src/config/entity-registry.ts.
 *   3. Scans src/** for link emitters (href=, router.push/replace, redirect,
 *      detailPath/makeHref/editPath/successUrl config fields) and resolves
 *      ENTITY_REGISTRY / ROUTES references — including dynamic `meta.<field>`
 *      templates, which are expanded across ALL entity types.
 *   4. Fails on any declared or emitted link that matches no route file, and
 *      on links where a literal segment like "new" / "create" / "edit" would
 *      be swallowed by a [param] route (runtime-404 class, e.g.
 *      /dashboard/wishlists/items/new matching items/[itemId]).
 *
 * Run: npm run audit:routes            (exit 1 on any FAIL)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const APP_DIR = join(SRC, 'app');

// ---------------------------------------------------------------------------
// Allowlist — links the audit must NOT fail on. Every entry needs a reason.
// ---------------------------------------------------------------------------
const ALLOW = new Set([
  // Populated only with justified exceptions; keep empty if possible.
]);

// Literal segments that are almost certainly a sub-route, not an id. A link
// whose literal segment matches a [param] slot with one of these is a
// runtime 404 (the page will treat "new" as an id).
const SUSPICIOUS_LITERALS = new Set(['new', 'create', 'edit']);

// ---------------------------------------------------------------------------
// 1. Actual route surface
// ---------------------------------------------------------------------------

/** @typedef {{ segs: Array<{ kind: 'lit'|'dyn'|'catchall', name: string }>, file: string, kind: 'page'|'api' }} Route */

function walkAppRoutes(dir, parents = [], out = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Route groups "(name)" and parallel routes "@slot" do not create URL segments
      const isGroup = entry.startsWith('(') && entry.endsWith(')');
      const isSlot = entry.startsWith('@');
      walkAppRoutes(full, isGroup || isSlot ? parents : [...parents, entry], out);
    } else if (entry === 'page.tsx' || entry === 'page.ts' || entry === 'route.ts') {
      const segs = parents.map(seg => {
        if (/^\[\[\.\.\..+\]\]$/.test(seg) || /^\[\.\.\..+\]$/.test(seg)) {
          return { kind: 'catchall', name: seg };
        }
        if (/^\[.+\]$/.test(seg)) {
          return { kind: 'dyn', name: seg };
        }
        return { kind: 'lit', name: seg };
      });
      out.push({ segs, file: relative(ROOT, full), kind: entry === 'route.ts' ? 'api' : 'page' });
    }
  }
  return out;
}

const routes = walkAppRoutes(APP_DIR);

/** Match a concrete-ish path (segments; ':param' = must hit a dynamic slot). */
function matchRoute(path) {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const segs = clean === '/' ? [] : clean.slice(1).split('/');
  let best = null; // 'exact' > 'dynamic' > 'suspicious'
  for (const route of routes) {
    let i = 0;
    let usedDynForSuspicious = false;
    let usedDyn = false;
    let ok = true;
    for (let r = 0; r < route.segs.length; r++) {
      const rs = route.segs[r];
      if (rs.kind === 'catchall') {
        i = segs.length;
        usedDyn = true;
        break;
      }
      if (i >= segs.length) {
        ok = false;
        break;
      }
      const seg = segs[i];
      if (rs.kind === 'dyn') {
        usedDyn = true;
        if (SUSPICIOUS_LITERALS.has(seg)) {
          usedDynForSuspicious = true;
        }
        i++;
      } else if (rs.kind === 'lit') {
        if (seg === rs.name) {
          i++;
        } else if (seg.startsWith(':')) {
          // A ':param' placeholder can be anything — a literal route segment
          // cannot guarantee a match.
          ok = false;
          break;
        } else {
          ok = false;
          break;
        }
      }
    }
    if (!ok || i !== segs.length) {
      continue;
    }
    const quality = usedDynForSuspicious ? 'suspicious' : usedDyn ? 'dynamic' : 'exact';
    if (
      !best ||
      (best.quality === 'suspicious' && quality !== 'suspicious') ||
      (best.quality === 'dynamic' && quality === 'exact')
    ) {
      best = { route, quality };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 2. Declared config paths
// ---------------------------------------------------------------------------

const registrySrc = readFileSync(join(SRC, 'config/entity-registry.ts'), 'utf8');

/** entityType → { basePath, createPath, publicBasePath, apiEndpoint } */
const registry = {};
{
  const blockRe =
    /type:\s*'(\w+)',[\s\S]*?basePath:\s*'([^']+)',\s*createPath:\s*'([^']+)',\s*publicBasePath:\s*'([^']+)',\s*apiEndpoint:\s*'([^']+)'/g;
  let m;
  while ((m = blockRe.exec(registrySrc))) {
    registry[m[1]] = {
      basePath: m[2],
      createPath: m[3],
      publicBasePath: m[4],
      apiEndpoint: m[5],
    };
  }
}
if (Object.keys(registry).length < 10) {
  console.error('audit-routes: failed to parse ENTITY_REGISTRY — regex drift?');
  process.exit(2);
}

/** Parse a `export const NAME = { ... } as const;`-style block into flat "NAME.A.B" → raw value strings. */
function parseConstMap(src, constName) {
  const start = src.indexOf(`export const ${constName} = {`);
  if (start === -1) {
    return {};
  }
  // Find the matching closing brace of the object literal.
  let depth = 0;
  let i = src.indexOf('{', start);
  const open = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') {
      depth++;
    } else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        break;
      }
    }
  }
  const body = src.slice(open + 1, i);
  const flat = {};
  const stack = [constName];
  const lines = body.split('\n');
  for (const line of lines) {
    const t = line.trim();
    const nested = t.match(/^(\w+):\s*\{\s*$/);
    if (nested) {
      stack.push(nested[1]);
      continue;
    }
    if (/^\},?$/.test(t)) {
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }
    // KEY: 'literal'
    let m = t.match(/^(\w+):\s*'([^']*)'/);
    if (m) {
      flat[[...stack, m[1]].join('.')] = { kind: 'lit', value: m[2] };
      continue;
    }
    // KEY: `template`  or  KEY: (args) => `template`
    m = t.match(/^(\w+):\s*(?:\([^)]*\)|\w+)?\s*(?:=>)?\s*`([^`]*)`/);
    if (m && t.includes('`')) {
      flat[[...stack, m[1]].join('.')] = { kind: 'tpl', value: m[2] };
      continue;
    }
    // KEY: ENTITY_REGISTRY['x'].field
    m = t.match(/^(\w+):\s*ENTITY_REGISTRY\['(\w+)'\]\.(\w+)/);
    if (m) {
      const val = registry[m[2]]?.[m[3]];
      if (val) {
        flat[[...stack, m[1]].join('.')] = { kind: 'lit', value: val };
      }
      continue;
    }
  }
  return flat;
}

const routesSrc = readFileSync(join(SRC, 'config/routes.ts'), 'utf8');
const apiRoutesSrc = readFileSync(join(SRC, 'config/api-routes.ts'), 'utf8');
const ROUTES_MAP = parseConstMap(routesSrc, 'ROUTES');
const API_ROUTES_MAP = parseConstMap(apiRoutesSrc, 'API_ROUTES');

// ---------------------------------------------------------------------------
// 3. Template resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a template string with ${...} placeholders into one or more
 * checkable paths. Returns { paths: string[], note?: string } or null when
 * the template cannot be resolved to a root-relative path.
 */
function resolveTemplate(tpl) {
  // Literal [id] / [slug] segments in config templates are declared params.
  // \w only — must not eat index expressions like ['group'].
  let work = tpl.replace(/\[\w+\]/g, ':param');

  // Resolve fully-qualified references first.
  work = work.replace(/\$\{ENTITY_REGISTRY\['(\w+)'\]\.(\w+)\}/g, (all, type, field) => {
    return registry[type]?.[field] ?? all;
  });
  work = work.replace(/\$\{(ROUTES(?:\.\w+)+)\}/g, (all, ref) => {
    const hit = ROUTES_MAP[ref];
    return hit && hit.kind === 'lit' ? hit.value : all;
  });
  work = work.replace(/\$\{(API_ROUTES(?:\.\w+)+)\}/g, (all, ref) => {
    const hit = API_ROUTES_MAP[ref];
    return hit && hit.kind === 'lit' ? hit.value : all;
  });
  // ROUTES.X.Y(args) / API_ROUTES.X.Y(args) call syntax → the map's template
  // with its own placeholders parameterized.
  work = work.replace(/\$\{((?:ROUTES|API_ROUTES)(?:\.\w+)+)\([^)]*\)\}/g, (all, ref) => {
    const hit = ROUTES_MAP[ref] ?? API_ROUTES_MAP[ref];
    if (!hit) {
      return all;
    }
    return hit.value.replace(/\$\{[^}]*\}/g, ':param');
  });

  // Dynamic registry-metadata templates (e.g. `${meta.basePath}/${id}`) —
  // expand across every entity type: the code path can serve any of them.
  const dynField = work.match(/^\$\{[^}]*\.(basePath|createPath|publicBasePath|apiEndpoint)\}/);
  if (dynField) {
    const field = dynField[1];
    const suffixTpl = work.slice(dynField[0].length);
    const suffix = suffixTpl.replace(/\$\{[^}]*\}/g, ':param');
    return {
      paths: Object.entries(registry).map(([type, meta]) => ({
        path: meta[field] + suffix,
        label: `[${type}]`,
      })),
      expanded: true,
    };
  }

  // Any remaining mid-path placeholder is a parameter.
  work = work.replace(/\$\{[^}]*\}/g, ':param');

  if (!work.startsWith('/')) {
    return null;
  }
  return { paths: [{ path: work, label: '' }], expanded: false };
}

// ---------------------------------------------------------------------------
// 4. Source scan for link emitters
// ---------------------------------------------------------------------------

function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) {
        continue;
      }
      walkFiles(full, out);
    } else if (/\.(tsx?|mjs)$/.test(entry) && !/\.(test|spec|d)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const LINK_PATTERNS = [
  // href="/..."  href={'/...'}  href={"/..."}
  { re: /\bhref=\{?["'](\/[^"']*)["']\}?/g, tpl: false },
  // href={`...`}
  { re: /\bhref=\{`([^`]+)`\}/g, tpl: true },
  // router.push('/...') / router.replace / redirect('/...')
  { re: /(?:router\.push|router\.replace|redirect)\(\s*["'](\/[^"']*)["']/g, tpl: false },
  { re: /(?:router\.push|router\.replace|redirect)\(\s*`([^`]+)`/g, tpl: true },
  // window.location.href = '...'
  { re: /window\.location\.(?:href|assign)\s*=?\(?\s*["'](\/[^"']*)["']/g, tpl: false },
  // Config-driven link builders (entity list/detail configs)
  {
    re: /\b(?:detailPath|makeHref|editPath|successUrl|backHref|viewRoute|createHref)\s*:\s*(?:\([^)]*\)|\w+)?\s*(?:=>)?\s*["'](\/[^"']*)["']/g,
    tpl: false,
  },
  {
    re: /\b(?:detailPath|makeHref|editPath|successUrl|backHref|viewRoute|createHref)\s*:\s*(?:\([^)]*\)|\w+)?\s*(?:=>)?\s*`([^`]+)`/g,
    tpl: true,
  },
  // Path-named const/variable assignments: const editHref = `...`
  {
    re: /\b(?:const|let|var)\s+\w*(?:Href|Path|Route|Url)\w*\s*=\s*`([^`]+)`/gi,
    tpl: true,
  },
  {
    re: /\b(?:const|let|var)\s+\w*(?:Href|Path|Route|Url)\w*\s*=\s*["'](\/[^"']*)["']/gi,
    tpl: false,
  },
];

/**
 * Resolve a leading `${identifier}` placeholder by finding what values the
 * identifier is bound to anywhere in src (prop callsites `name={...}`,
 * assignments `name = ...`, object fields `name: ...`). Single level deep.
 */
function resolveIdentifier(name, allSources) {
  const values = new Set();
  const re = new RegExp(
    `\\b${name}\\s*[:=]\\s*\\{?\\s*(?:ENTITY_REGISTRY\\['(\\w+)'\\]\\.(\\w+)|((?:ROUTES|API_ROUTES)(?:\\.\\w+)+)|['"\`](\\/[^'"\`]*)['"\`])`,
    'g'
  );
  for (const src of allSources) {
    let m;
    while ((m = re.exec(src))) {
      if (m[1] && m[2]) {
        const v = registry[m[1]]?.[m[2]];
        if (v) {
          values.add(v);
        }
      } else if (m[3]) {
        const hit = ROUTES_MAP[m[3]] ?? API_ROUTES_MAP[m[3]];
        if (hit?.kind === 'lit') {
          values.add(hit.value);
        }
      } else if (m[4]) {
        values.add(m[4]);
      }
    }
  }
  return [...values];
}

/** @type {Array<{ path: string, source: string, note: string }>} */
const emittedLinks = [];
/** @type {Array<{ raw: string, source: string }>} */
const unresolved = [];

const files = walkFiles(SRC).map(file => ({
  rel: relative(ROOT, file),
  src: readFileSync(file, 'utf8'),
}));
const allSources = files.map(f => f.src);

for (const { rel, src } of files) {
  for (const { re, tpl } of LINK_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const raw = m[1];
      const line = src.slice(0, m.index).split('\n').length;
      const source = `${rel}:${line}`;
      if (!tpl) {
        if (raw.startsWith('//')) {
          continue;
        }
        emittedLinks.push({ path: raw, source, note: '' });
        continue;
      }
      const resolved = resolveTemplate(raw);
      if (!resolved) {
        // Leading `${identifier}` — resolve the identifier's bindings across
        // the codebase (props, consts, config fields). Single level.
        const ident = raw.match(/^\$\{(\w+)\}/);
        if (ident) {
          const values = resolveIdentifier(ident[1], allSources);
          if (values.length > 0) {
            const rest = raw.slice(ident[0].length);
            for (const v of values) {
              const sub = resolveTemplate(v + rest);
              if (sub) {
                for (const { path, label } of sub.paths) {
                  emittedLinks.push({ path, source, note: label || `(${ident[1]})` });
                }
              }
            }
            continue;
          }
        }
        // Templates starting with an unresolvable placeholder: only worth
        // flagging when the variable name looks like a path.
        if (/^\$\{[^}]*(?:path|href|route|url)[^}]*\}/i.test(raw)) {
          unresolved.push({ raw, source });
        }
        continue;
      }
      for (const { path, label } of resolved.paths) {
        emittedLinks.push({ path, source, note: label });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Declared-route checks (registry + ROUTES + API_ROUTES)
// ---------------------------------------------------------------------------

/** @type {Array<{ category: string, path: string, source: string, note: string }>} */
const declared = [];

for (const [type, meta] of Object.entries(registry)) {
  declared.push(
    { category: 'registry', path: meta.basePath, source: `entity-registry:${type}.basePath`, note: '' },
    { category: 'registry', path: meta.createPath, source: `entity-registry:${type}.createPath`, note: '' },
    { category: 'registry', path: meta.publicBasePath, source: `entity-registry:${type}.publicBasePath`, note: '' },
    { category: 'registry', path: meta.apiEndpoint, source: `entity-registry:${type}.apiEndpoint`, note: '' }
  );
}

for (const [mapName, map] of [
  ['ROUTES', ROUTES_MAP],
  ['API_ROUTES', API_ROUTES_MAP],
]) {
  for (const [key, entry] of Object.entries(map)) {
    let paths;
    if (entry.kind === 'lit') {
      paths = entry.value.startsWith('/') ? [{ path: entry.value, label: '' }] : null;
    } else {
      const resolved = resolveTemplate(entry.value);
      paths = resolved?.paths ?? null;
    }
    if (!paths) {
      continue;
    }
    for (const { path, label } of paths) {
      declared.push({ category: mapName, path, source: key, note: label });
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Evaluate + report
// ---------------------------------------------------------------------------

const failures = [];
const suspects = [];

function check(category, path, source, note) {
  const clean = path.split(/[?#]/)[0];
  if (!clean.startsWith('/') || clean.startsWith('//')) {
    return;
  }
  const key = `${clean}`;
  if (ALLOW.has(key)) {
    return;
  }
  const hit = matchRoute(clean);
  if (!hit) {
    failures.push({ category, path: clean, source, note });
  } else if (hit.quality === 'suspicious') {
    suspects.push({ category, path: clean, source, note: `matches ${hit.route.file} via [param]` });
  }
}

for (const d of declared) {
  check(d.category, d.path, d.source, d.note);
}
for (const l of emittedLinks) {
  check('link', l.path, l.source, l.note);
}

// ---------------------------------------------------------------------------
// 5. Streaming boundaries vs. HTTP status (the soft-404 / soft-redirect class)
// ---------------------------------------------------------------------------
// notFound() and redirect() can only set a status code while the response is
// still uncommitted. A Suspense boundary ABOVE the page — a segment
// loading.tsx, or a <Suspense> wrapping {children} in a layout — starts the
// stream immediately, so Next.js commits 200 and then renders the not-found UI
// inline or does the redirect client-side. Next's own docs: not-found.js
// "returns a 404 HTTP status code for non-streamed responses and a 200 status
// code for streamed responses".
//
// Observed on prod 2026-08-06: orangecat.ch/<unknown-username> answered 200,
// and /profiles/me answered 200 + a client-side redirect instead of a 307.
// Nobody chose that — a bare <Suspense>{children}</Suspense> in the root
// layout had put every page in the app behind a boundary. A 200 that means
// "not found" is invisible to link checkers, uptime monitors, CDN caches and
// share-link validators, all of which read the status and not the HTML.
//
// The fix Next.js recommends is to run the existence check BEFORE any
// boundary, i.e. no loading.tsx on that segment; put <Suspense> inside the
// page around the slow part instead, so the check still commits the status.
const STREAMING_ALLOW = new Map([
  // Behind auth: no crawler, monitor or share-link validator ever reads these
  // status codes, so the loading skeleton is worth more than the 404.
  ['(authenticated)/dashboard/documents/[id]', 'auth-gated; skeleton kept deliberately'],
  ['(authenticated)/dashboard/wishlists/items/[itemId]', 'auth-gated; skeleton kept deliberately'],
  // Same reasoning, plus: this page's notFound() fires for a claim that is not
  // YOURS, which is a privacy answer rather than a routing one — it exists so
  // the creator of a claim cannot be enumerated, and nothing outside the
  // session ever sees the status.
  ['(authenticated)/dashboard/profile-claims/[id]/share', 'auth-gated; 404 hides another user’s claim'],
]);

const streamingFailures = [];

// A layout must never wrap {children} in a Suspense boundary — that applies to
// every page beneath it, which is how this class got introduced.
const appFiles = walkFiles(APP_DIR);
for (const layout of appFiles.filter(f => f.endsWith('/layout.tsx'))) {
  const src = readFileSync(layout, 'utf8');
  if (/<Suspense[^>]*>\s*\{\s*children\s*\}/.test(src)) {
    streamingFailures.push({
      category: 'layout-suspense',
      path: relative(ROOT, layout),
      source: 'layout wraps {children} in <Suspense>',
      note: 'every page beneath it streams, so notFound()/redirect() lose their status code',
    });
  }
}

// A page that calls notFound() must not sit under a loading.tsx.
for (const page of appFiles.filter(f => f.endsWith('/page.tsx'))) {
  const src = readFileSync(page, 'utf8');
  if (!/\bnotFound\(\)/.test(src)) {
    continue;
  }
  const segment = relative(APP_DIR, page).replace(/\/page\.tsx$/, '');
  if (STREAMING_ALLOW.has(segment)) {
    continue;
  }
  // Walk up from the page's own directory to src/app looking for loading.tsx.
  let dir = join(APP_DIR, segment);
  const boundaries = [];
  for (;;) {
    try {
      statSync(join(dir, 'loading.tsx'));
      boundaries.push(relative(ROOT, join(dir, 'loading.tsx')));
    } catch {
      /* no boundary at this level */
    }
    if (dir === APP_DIR) {
      break;
    }
    dir = join(dir, '..');
  }
  if (boundaries.length > 0) {
    streamingFailures.push({
      category: 'soft-404',
      path: `/${segment}`,
      source: relative(ROOT, page),
      note: `streams behind ${boundaries.join(', ')} — notFound() will answer 200`,
    });
  }
}

function printTable(title, rows) {
  if (rows.length === 0) {
    return;
  }
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  const w1 = Math.max(...rows.map(r => r.path.length), 4) + 2;
  const w2 = Math.max(...rows.map(r => r.category.length), 8) + 2;
  for (const r of rows.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(
      `${r.path.padEnd(w1)}${r.category.padEnd(w2)}${r.source}${r.note ? `  ${r.note}` : ''}`
    );
  }
}

const pageCount = routes.filter(r => r.kind === 'page').length;
const apiCount = routes.filter(r => r.kind === 'api').length;
console.log(
  `audit:routes — ${pageCount} pages, ${apiCount} API routes, ` +
    `${declared.length} declared paths, ${emittedLinks.length} emitted links checked`
);

printTable(`❌ BROKEN — target route does not exist (${failures.length})`, failures);
printTable(
  `⚠️  SUSPICIOUS — literal sub-route swallowed by [param] (runtime 404) (${suspects.length})`,
  suspects
);
if (unresolved.length > 0) {
  console.log(`\nℹ️  Unresolved path-like templates (manual check, non-failing):`);
  for (const u of [...new Map(unresolved.map(x => [x.raw, x])).values()]) {
    console.log(`  ${u.raw}  ← ${u.source}`);
  }
}

printTable(
  `❌ SOFT STATUS — streams before notFound()/redirect(), so the status is 200 (${streamingFailures.length})`,
  streamingFailures
);

if (failures.length + suspects.length + streamingFailures.length > 0) {
  console.error(
    `\naudit:routes FAILED — ${failures.length} broken, ${suspects.length} suspicious, ` +
      `${streamingFailures.length} soft status.`
  );
  process.exit(1);
}
console.log(
  '\n✅ audit:routes clean — every declared and emitted link resolves to a route, ' +
    'and no notFound() page streams away its 404.'
);
