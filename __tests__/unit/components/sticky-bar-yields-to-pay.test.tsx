// @vitest-environment jsdom
/**
 * Measured on production at 390px (2026-11-12): on a cause and a product page
 * the sticky "Fund this cause" / "Buy now" bar stayed on screen while the
 * payment section (#pay) was in view — on 10 of 14 and 15 of 20 scroll
 * positions — and covered the open invoice's "Hide the code". The project
 * page's Fund bar already yielded (#1587); every entity's bar now does, with
 * the one hook both use.
 */
import { act, render, renderHook, screen } from '@testing-library/react';
import { StickyBar } from '@/components/public/PublicEntityStickyBar';
import { useMobileFundBar } from '@/components/project/ProjectMobileFundBar';

type Callback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;

const observers: Array<{ callback: Callback; targets: Element[] }> = [];

class FakeIntersectionObserver {
  private entry: { callback: Callback; targets: Element[] };
  constructor(callback: Callback) {
    this.entry = { callback, targets: [] };
    observers.push(this.entry);
  }
  observe(target: Element) {
    this.entry.targets.push(target);
  }
  disconnect() {
    this.entry.targets = [];
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}

/** The browser reports whether the element with this id is on screen. */
function setOnScreen(id: string, isIntersecting: boolean) {
  act(() => {
    for (const o of observers) {
      for (const target of o.targets) {
        if (target.id === id) {
          o.callback([{ isIntersecting, target }]);
        }
      }
    }
  });
}

const marked = () => document.documentElement.hasAttribute('data-mobile-action-bar');

let pay: HTMLElement;

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  pay = document.createElement('div');
  pay.id = 'pay';
  document.body.appendChild(pay);
});

afterEach(() => {
  pay.remove();
  vi.unstubAllGlobals();
});

describe('the sticky entity bar yields to the payment section', () => {
  it('shows while #pay is off screen and hides while it is on screen', () => {
    const { unmount } = render(<StickyBar href="#pay" label="Fund this cause" />);
    expect(screen.getByRole('link', { name: 'Fund this cause' })).toBeTruthy();
    expect(marked()).toBe(true);

    setOnScreen('pay', true);
    expect(screen.queryByRole('link', { name: 'Fund this cause' })).toBeNull();
    // The floating Cat button no longer has a bar to rise above.
    expect(marked()).toBe(false);

    setOnScreen('pay', false);
    expect(screen.getByRole('link', { name: 'Fund this cause' })).toBeTruthy();
    expect(marked()).toBe(true);
    unmount();
  });

  it('a bar that leads off the page (a loan\'s "Contact lister") is not tied to #pay', () => {
    const { unmount } = render(<StickyBar href="/auth?mode=login" label="Contact lister" />);
    setOnScreen('pay', true);
    expect(screen.getByRole('link', { name: 'Contact lister' })).toBeTruthy();
    unmount();
  });

  it("the project page's Fund bar still yields to #pay", () => {
    const { result, unmount } = renderHook(() => useMobileFundBar(true));
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 400, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(true);
    setOnScreen('pay', true);
    expect(result.current).toBe(false);
    unmount();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });
});
