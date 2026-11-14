// @vitest-environment jsdom
/**
 * One not-found page (system#9). There were three sets of words and buttons
 * ("Page Not Found", "Project Not Found", "Profile Not Found"), a fourth
 * layout for wallets, and every kind without its own file fell through to
 * "Page Not Found" under a tab title that named the kind. Every route that
 * can miss now renders components/ui/NotFound.tsx with its kind.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import NotFoundRoot from '@/app/not-found';
import { NotFound } from '@/components/ui/NotFound';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { notFoundBrowse, notFoundHeading, notFoundTitle } from '@/config/not-found';

const auth = { user: null as { id: string } | null, hydrated: true };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/settings/nope',
}));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('the site-wide 404', () => {
  it('has one h1, a search that goes to Discover, and the ways onward', () => {
    auth.user = null;
    render(<NotFoundRoot />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("This page isn't here");
    expect(screen.getByRole('search')).toHaveAttribute('action', '/discover');
    expect(screen.getByRole('searchbox')).toHaveAttribute('name', 'q');
    expect(screen.getByRole('link', { name: 'Discover' })).toHaveAttribute('href', '/discover');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
  });

  it('offers the dashboard to someone who can open it', () => {
    auth.user = { id: 'u1' };
    render(<NotFoundRoot />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    auth.user = null;
  });
});

describe('a missing thing names its kind and leads to that kind', () => {
  it.each([
    ['product', "This product isn't here", 'See all products', '/discover?type=products'],
    ['project', "This project isn't here", 'See all projects', '/discover?type=projects'],
    ['profile', "This profile isn't here", 'See all people', '/discover?type=people'],
    ['ai_assistant', "This bot isn't here", 'See all bots', '/discover?type=ai_assistants'],
    ['group', "This organization isn't here", 'See all organizations', '/discover?type=groups'],
  ] as const)('%s', (kind, heading, label, href) => {
    render(<NotFound kind={kind} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('sends a kind Discover does not list to Discover itself', () => {
    expect(notFoundBrowse('wallet')).toEqual({ href: '/discover', label: 'Discover' });
  });

  it('reads every name from the registry, in sentence case', () => {
    for (const type of Object.keys(ENTITY_REGISTRY) as EntityType[]) {
      const name = ENTITY_REGISTRY[type].name;
      expect(notFoundTitle(type)).toBe(`${name} not found`);
      expect(notFoundHeading(type)).toBe(`This ${name.toLowerCase()} isn't here`);
    }
    expect(notFoundTitle()).toBe('Page not found');
  });
});

describe('there is one design', () => {
  const files = walk(join(process.cwd(), 'src', 'app')).filter(f => f.endsWith('not-found.tsx'));

  it('every not-found file renders the shared page and draws nothing itself', () => {
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain("from '@/components/ui/NotFound'");
      expect(source, file).not.toMatch(/<(h1|div|Button)\b/);
    }
  });

  it('no page titles a miss in Title Case by hand', () => {
    const offenders = walk(join(process.cwd(), 'src', 'app'))
      .filter(f => /\.tsx?$/.test(f))
      .filter(f => /(['`])[^'`\n]* Not Found\1/.test(readFileSync(f, 'utf8')))
      // The blog is not a registry kind; its title is its own.
      .filter(f => !f.includes(join('blog', '[slug]')));
    expect(offenders).toEqual([]);
  });
});
