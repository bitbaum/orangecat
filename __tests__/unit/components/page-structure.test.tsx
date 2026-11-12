// @vitest-environment jsdom
/**
 * One h1 and one <main> per page, and no heading level skipped by a shared
 * piece.
 *
 * Measured on 2026-11-12: no h1 on the phone sign-in, the Cat chat, the 404
 * and the error state; a second <main> inside AppShell's on twelve lines in
 * nine files; and axe `heading-order` on 121 captures, because EmptyState and
 * the footer columns wrote an h3 straight under a page's h1. Each of those is
 * a shared piece, so each is pinned here.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, hydrated: true }) }));
vi.mock('@/lib/errors/report-client-error', () => ({ reportClientError: vi.fn() }));

import EmptyState from '@/components/ui/EmptyState';
import Footer from '@/components/layout/Footer';
import { RouteError } from '@/components/ui/RouteError';

function sourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, files);
    } else if (entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

describe('page structure', () => {
  it('an empty state is an h2: it sits straight under the page h1', () => {
    render(<EmptyState title="No products yet" />);
    expect(screen.getByRole('heading', { level: 2, name: 'No products yet' })).toBeTruthy();
  });

  it('the footer columns are h2s, so a page with only an h1 skips no level', () => {
    render(<Footer />);
    const headings = screen.getAllByRole('heading');
    expect(headings.map(h => h.textContent)).toEqual([
      'Product',
      'Learn',
      'Support',
      'Ecosystem',
      'Legal',
    ]);
    expect(headings.every(h => h.tagName === 'H2')).toBe(true);
  });

  // A `behavior` passed to scrollTo wins over the stylesheet, so the
  // reduced-motion media query never reached this button.
  it('Back to top does not animate for someone who asked for reduced motion', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('matchMedia', () => ({ matches: true }) as MediaQueryList);
    render(<Footer />);
    const backToTop = screen.getByRole('button', { name: 'Back to top' });

    fireEvent.click(backToTop);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });

    vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList);
    fireEvent.click(backToTop);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });

    vi.unstubAllGlobals();
  });

  it('a route error has an h1', () => {
    render(<RouteError error={new Error('boom')} reset={() => {}} context="Dashboard" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeTruthy();
  });

  // AppShell wraps every route in <main id="main-content">, so a page that
  // writes its own <main> nests a second one (axe landmark-no-duplicate-main).
  it('only AppShell renders a <main>', () => {
    const root = join(process.cwd(), 'src');
    const offenders = sourceFiles(root)
      .filter(file => /<main[\s>]/.test(readFileSync(file, 'utf8')))
      .map(file => relative(root, file));
    expect(offenders).toEqual(['components/layout/AppShell.tsx']);
  });
});
