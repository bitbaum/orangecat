// @vitest-environment jsdom
/**
 * The auto-hiding header: it hides on scroll-down where space is scarce, never
 * on a wide screen (the sidebar is pinned under it), and keyboard focus that
 * lands in it brings it back.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
  // one animation frame, then the hide delay
  vi.advanceTimersByTime(20);
  vi.advanceTimersByTime(150);
}

describe('useHeaderScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      return setTimeout(() => cb(performance.now()), 0) as unknown as number;
    });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('hides on scroll-down by default', () => {
    const { result } = renderHook(() => useHeaderScroll());
    act(() => scrollTo(400));
    expect(result.current.isHidden).toBe(true);
  });

  it('stays put when hiding is turned off (desktop)', () => {
    const { result } = renderHook(() => useHeaderScroll({ hideOnScrollDown: false }));
    act(() => scrollTo(400));
    expect(result.current.isHidden).toBe(false);
  });

  it('comes back when keyboard focus moves into the header', () => {
    const header = document.createElement('header');
    header.className = 'app-header';
    const button = document.createElement('button');
    header.appendChild(button);
    document.body.appendChild(header);

    const { result } = renderHook(() => useHeaderScroll());
    act(() => scrollTo(400));
    expect(result.current.isHidden).toBe(true);

    act(() => button.focus());
    expect(result.current.isHidden).toBe(false);
  });

  it('ignores focus elsewhere on the page', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    const { result } = renderHook(() => useHeaderScroll());
    act(() => scrollTo(400));
    act(() => outside.focus());
    expect(result.current.isHidden).toBe(true);
  });
});
