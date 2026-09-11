/**
 * A deploy under an open tab must not read as a broken page.
 *
 * Eight "Failed to find Server Action" errors landed in one minute on
 * 2026-09-11, each shown to someone as "Something went wrong. There was a
 * problem loading this page." with a "Try again" button that re-rendered the
 * same stale tab and failed the same way. The classifier below is what tells
 * that class apart; these tests are the reason to trust it — including the
 * part that matters most, that a REAL error is never mistaken for skew and
 * silently reloaded away.
 */
import { describe, it, expect } from 'vitest';
import {
  DEPLOY_SKEW_RELOAD_WINDOW_MS,
  isDeploySkewError,
  shouldReloadForSkew,
} from '@/lib/errors/deploy-skew';

describe('recognising a stale build', () => {
  it.each([
    'Failed to find Server Action "7f3a". This request might be from an older or newer deployment.',
    'ChunkLoadError: Loading chunk 4821 failed.',
    'Loading CSS chunk 12 failed. (/_next/static/css/abc.css)',
    'Failed to fetch dynamically imported module: https://orangecat.ch/_next/static/chunks/x.js',
    'error loading dynamically imported module',
    'importing a module script failed.',
  ])('recognises %s', message => {
    expect(isDeploySkewError(new Error(message))).toBe(true);
  });

  it('recognises it by error name too', () => {
    const err = new Error('Loading failed');
    err.name = 'ChunkLoadError';
    expect(isDeploySkewError(err)).toBe(true);
  });

  it.each([
    'Cannot read properties of undefined (reading "id")',
    'Entity not found',
    'Network request failed',
    'Rate limit exceeded',
    'Supabase: JWT expired',
  ])('does NOT mistake a real failure for skew: %s', message => {
    expect(isDeploySkewError(new Error(message))).toBe(false);
  });

  it('handles non-errors without throwing', () => {
    expect(isDeploySkewError(null)).toBe(false);
    expect(isDeploySkewError(undefined)).toBe(false);
    expect(isDeploySkewError('')).toBe(false);
    expect(isDeploySkewError({})).toBe(false);
    expect(isDeploySkewError('Failed to find Server Action')).toBe(true);
  });
});

describe('reloading at most once', () => {
  const skew = new Error('Failed to find Server Action');

  it('reloads when this tab has not tried yet', () => {
    expect(shouldReloadForSkew(skew, null)).toBe(true);
  });

  it('does NOT reload again inside the window — a reload that did not fix it means it was not skew', () => {
    const now = 1_000_000;
    expect(shouldReloadForSkew(skew, now - 1_000, now)).toBe(false);
  });

  it('allows another attempt after the window, for a later deploy in the same session', () => {
    const now = 1_000_000;
    expect(shouldReloadForSkew(skew, now - DEPLOY_SKEW_RELOAD_WINDOW_MS - 1, now)).toBe(true);
  });

  it('never reloads for a real error, however long ago the last reload was', () => {
    expect(shouldReloadForSkew(new Error('Cannot read properties of undefined'), null)).toBe(false);
  });
});
