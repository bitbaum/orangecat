/**
 * Which pages stream away the 404 their notFound() should set.
 *
 * notFound() can only set a status while the response is still uncommitted. A
 * loading.tsx on the page's segment, or on any segment above it, wraps the page
 * in Suspense: the skeleton streams first, Next.js commits 200, and the
 * not-found UI arrives inline under that 200. audit-routes.mjs fails on every
 * page this returns; its comment block has the history.
 *
 * Its own module so the rule can be tested against a fixture tree, not only
 * against whatever src/app holds today.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { blankComments } from './blank-non-code.mjs';

const NOT_FOUND_CALL = /\bnotFound\(\)/;
const IMPORT_FROM = /^\s*(?:import|export)\s+(type\s+)?[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/gm;

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** An '@/…' or relative import → the file it names; null for a package. */
function resolveLocalImport(spec, fromFile, srcDir) {
  let base;
  if (spec.startsWith('@/')) {
    base = join(srcDir, spec.slice(2));
  } else if (spec.startsWith('.')) {
    base = join(fromFile, '..', spec);
  } else {
    return null;
  }
  const hit = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'].find(ext => isFile(base + ext));
  return hit === undefined ? null : base + hit;
}

/**
 * The file that makes this page's notFound() call: the page itself, or a
 * module it imports. Most entity detail pages are thin wrappers around
 * PublicEntityDetailPage, which makes the existence check for them. Reading
 * only the page's own source missed all of those, and six answered 200 on
 * production (2026-11-12) while the audit reported clean. One import deep
 * covers that shape; type-only imports render nothing, so they are skipped.
 */
export function notFoundSource(page, srcDir) {
  const src = blankComments(readFileSync(page, 'utf8'));
  if (NOT_FOUND_CALL.test(src)) {
    return page;
  }
  for (const [, typeOnly, spec] of src.matchAll(IMPORT_FROM)) {
    const file = typeOnly ? null : resolveLocalImport(spec, page, srcDir);
    if (file && NOT_FOUND_CALL.test(blankComments(readFileSync(file, 'utf8')))) {
      return file;
    }
  }
  return null;
}

/** Every loading.tsx from the page's own segment up to the app root. */
export function loadingBoundariesAbove(page, appDir) {
  const boundaries = [];
  for (let dir = join(page, '..'); ; dir = join(dir, '..')) {
    if (isFile(join(dir, 'loading.tsx'))) {
      boundaries.push(join(dir, 'loading.tsx'));
    }
    if (dir === appDir || !dir.startsWith(appDir + sep)) {
      return boundaries;
    }
  }
}

function pageFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      pageFiles(full, out);
    } else if (entry === 'page.tsx') {
      out.push(full);
    }
  }
  return out;
}

/**
 * Pages under appDir whose notFound() streams behind a loading.tsx.
 * `allow` holds segments (page directory relative to appDir) to skip.
 */
export function findSoftNotFoundPages({ appDir, srcDir, allow = new Map() }) {
  const found = [];
  for (const page of pageFiles(appDir)) {
    const segment = relative(appDir, join(page, '..'));
    if (allow.has(segment)) {
      continue;
    }
    const checkedIn = notFoundSource(page, srcDir);
    const boundaries = checkedIn ? loadingBoundariesAbove(page, appDir) : [];
    if (boundaries.length > 0) {
      found.push({ segment, page, checkedIn, boundaries });
    }
  }
  return found;
}
