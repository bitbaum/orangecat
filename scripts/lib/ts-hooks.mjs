/**
 * Module resolve hooks that let a plain `node` script import the app's
 * TypeScript the way the app writes it: `@/…` for src/, and imports without
 * a file extension. Node strips the types itself; this only finds the file.
 *
 * Registered by scripts/lib/register-ts.mjs. No dependency, on purpose: the
 * brand scripts run where the repo's node_modules may not be installed.
 */

import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../../src/', import.meta.url);
const CANDIDATES = ['.ts', '.tsx', '/index.ts'];

const isFile = url => {
  try {
    const path = fileURLToPath(url);
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
};

export async function resolve(specifier, context, nextResolve) {
  const mapped = specifier.startsWith('@/') ? new URL(specifier.slice(2), SRC).href : specifier;
  const isPathLike =
    mapped.startsWith('file:') || mapped.startsWith('./') || mapped.startsWith('../');
  if (isPathLike) {
    const base = mapped.startsWith('file:') ? mapped : new URL(mapped, context.parentURL).href;
    if (!isFile(base)) {
      for (const ext of CANDIDATES) {
        if (isFile(base + ext)) return nextResolve(base + ext, context);
      }
    }
    return nextResolve(base, context);
  }
  return nextResolve(mapped, context);
}
