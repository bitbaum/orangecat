// @vitest-environment jsdom
/**
 * The ⌘K palette from the keyboard, as measured on orangecat.ch (2026-11-12):
 *
 * - Typing "heidi" and waiting, the first row was the project "Heidi" but the
 *   highlighted row was "Ask your Cat: “heidi”" — cmdk picks a first row only
 *   when the text changes, and the results land a moment later, above it.
 *   Enter went to /dashboard/cat?q=heidi, which sends the words as a message.
 * - Signed out, it offered Cat, Home, Money and Messages, which only bounce to
 *   sign-in, and could not find Docs, Blog, Pricing, Privacy or Roadmap.
 * - Escape (or ⌘K again) left focus on <body>, not on the search button;
 *   so did Discover's Clear button, which disappears as the field empties.
 * - The highlighted row was a 1.01:1 tint in light, 1.11:1 in dark.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoundHit } from '@/services/search/find';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}));

const search = vi.hoisted(() => ({
  state: { results: [] as unknown[], total: 0, loading: false },
}));
vi.mock('@/hooks/useGlobalSearch', () => ({
  useGlobalSearch: (_query: string, enabled: boolean) =>
    enabled ? search.state : { results: [], total: 0, loading: false },
}));

const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock('@/stores/auth', () => ({
  useAuthStore: (select: (s: typeof auth) => unknown) => select(auth),
}));

import { CommandPalette } from '@/components/search/CommandPalette';
import { CommandPaletteHost, SearchTrigger } from '@/components/search/SearchTrigger';
import { setPaletteOpen } from '@/components/search/palette-store';
import { DiscoverSearchBox } from '@/components/discover/DiscoverSearchBox';

const heidi: FoundHit = {
  type: 'project',
  id: 'p1',
  title: 'Heidi',
  snippet: 'Learn to understand and text in Zurich Swiss German',
  imageUrl: null,
  href: '/projects/heidi',
  amount: null,
  currency: null,
  startsAt: null,
  place: null,
  createdAt: null,
  handle: null,
  rank: 1,
  marks: { title: [[0, 5]], snippet: [] },
  typos: 0,
};

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  push.mockClear();
  auth.user = null;
  search.state = { results: [], total: 0, loading: false };
  global.fetch = vi.fn(async () => ({ ok: false, json: async () => null })) as never;
});

const input = () => document.querySelector<HTMLInputElement>('[cmdk-input]')!;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[cmdk-item]'));
const highlighted = () => rows().find(row => row.getAttribute('aria-selected') === 'true');

function typeQuery(text: string) {
  act(() => {
    fireEvent.change(input(), { target: { value: text } });
  });
}

describe('Enter takes the row on top, not the Cat', () => {
  it('moves the highlight to the result that lands after typing stops', () => {
    auth.user = { id: 'u1' };
    const { rerender } = render(<CommandPalette open onOpenChange={() => {}} />);

    search.state = { results: [], total: 0, loading: true };
    typeQuery('heidi');

    // The results land above the Cat row.
    search.state = { results: [heidi], total: 1, loading: false };
    act(() => {
      rerender(<CommandPalette open onOpenChange={() => {}} />);
    });

    expect(rows()[0].textContent).toContain('Heidi');
    expect(highlighted()).toBe(rows()[0]);

    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/projects/heidi');
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('/dashboard/cat'));
  });

  it('does not send a name typed and entered at once to the Cat', () => {
    auth.user = { id: 'u1' };
    render(<CommandPalette open onOpenChange={() => {}} />);

    search.state = { results: [], total: 0, loading: true };
    typeQuery('heidi');

    // Still searching: the Cat row is shown but cannot be taken yet.
    const cat = rows().find(row => row.textContent?.includes('Ask your Cat'));
    expect(cat?.getAttribute('aria-disabled')).toBe('true');
    expect(highlighted()).toBeUndefined();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
  });

  it('asks the Cat only when its row is the one on top', () => {
    auth.user = { id: 'u1' };
    const { rerender } = render(<CommandPalette open onOpenChange={() => {}} />);

    search.state = { results: [], total: 0, loading: true };
    typeQuery('zqxj wvvt');
    search.state = { results: [], total: 0, loading: false };
    act(() => {
      rerender(<CommandPalette open onOpenChange={() => {}} />);
    });

    expect(highlighted()?.textContent).toContain('Ask your Cat');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/dashboard/cat?q=zqxj%20wvvt');
  });

  it('keeps a row the person arrowed to while the results stay the same', () => {
    auth.user = { id: 'u1' };
    search.state = { results: [heidi], total: 1, loading: false };
    render(<CommandPalette open onOpenChange={() => {}} />);
    typeQuery('heidi');

    expect(highlighted()).toBe(rows()[0]);
    act(() => {
      fireEvent.keyDown(input(), { key: 'ArrowDown' });
    });
    expect(highlighted()).toBe(rows()[1]);
  });
});

describe('signed out', () => {
  it('offers no dashboard page, and says the Cat needs a sign-in', () => {
    render(<CommandPalette open onOpenChange={() => {}} />);
    const labels = rows().map(row => row.textContent ?? '');
    for (const page of ['Home', 'My things', 'Money', 'Messages']) {
      expect(labels.some(label => label.startsWith(page))).toBe(false);
    }

    typeQuery('privacy');
    expect(highlighted()?.textContent).toContain('Privacy');
    expect(rows().some(row => row.textContent?.includes('Sign in to ask the Cat'))).toBe(true);
    expect(rows().some(row => row.textContent?.includes('Ask your Cat'))).toBe(false);
  });
});

describe('closing hands focus back', () => {
  it('to the button that opened the palette, on Escape and on ⌘K', () => {
    render(
      <>
        <SearchTrigger />
        <CommandPaletteHost />
      </>
    );
    const opener = screen.getByRole('button', { name: 'Open search' });

    for (const close of ['Escape', 'k'] as const) {
      opener.focus();
      act(() => {
        fireEvent.click(opener);
      });
      expect(document.activeElement).toBe(input());

      act(() => {
        if (close === 'Escape') {
          fireEvent.keyDown(input(), { key: 'Escape' });
        } else {
          fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
        }
      });
      expect(input()).toBeNull();
      expect(document.activeElement).toBe(opener);
    }
    act(() => setPaletteOpen(false));
  });

  it("to Discover's field when its Clear button empties it (the button goes)", () => {
    render(<DiscoverSearchBox initialQuery="cato" type={null} />);
    const clear = screen.getByRole('button', { name: 'Clear search' });
    clear.focus();
    act(() => {
      fireEvent.click(clear);
    });
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  });
});

describe('the highlighted row can be seen', () => {
  // The palette is drawn on --surface-page (CommandPalette). A tint of the
  // raised surface on it measured 1.01:1 in light and 1.11:1 in dark.
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
  const themes = {
    light: css.slice(css.indexOf(':root {'), css.indexOf('.dark {')),
    dark: css.slice(css.indexOf('.dark {')),
  };
  const lightness = (block: string, token: string) =>
    Number(block.match(new RegExp(`${token}:\\s*0 0% (\\d+)%;`))![1]);
  const luminance = (l: number) => {
    const s = Math.round((l / 100) * 255) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const ratio = (a: number, b: number) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it('carries a mark of at least 3:1 against the palette and the row, light and dark', () => {
    search.state = { results: [heidi], total: 1, loading: false };
    render(<CommandPalette open onOpenChange={() => {}} />);
    typeQuery('heidi');
    const classes = highlighted()!.className;

    const mark = classes.match(/aria-selected:shadow-\[inset_\d+px_0_0_hsl\(var\((--[\w-]+)\)\)\]/);
    expect(mark, 'the selected row draws an inset bar in a token colour').toBeTruthy();
    const rowFill = classes.match(/aria-selected:bg-(surface-[\w-]+)(?:\s|$)/);
    expect(rowFill, 'the selected row fill is an opaque surface token').toBeTruthy();

    for (const block of Object.values(themes)) {
      const bar = lightness(block, mark![1]);
      expect(ratio(bar, lightness(block, '--surface-page'))).toBeGreaterThanOrEqual(3);
      expect(ratio(bar, lightness(block, `--${rowFill![1]}`))).toBeGreaterThanOrEqual(3);
    }
  });
});
