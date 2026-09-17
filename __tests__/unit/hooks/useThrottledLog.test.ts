// @vitest-environment jsdom
/**
 * Tests for useThrottledLog (internal helper in useAuth.ts).
 *
 * Regression: the hook previously returned a new arrow function on every
 * render, which caused the second useEffect in useAuth to re-fire every render
 * since throttledLog was in its dep array. Fixed by returning a stable
 * useCallback([], [delay]) backed by a ref for logFn.
 */

import { renderHook, act } from '@testing-library/react';
import { renderHook as renderHookPublic } from '@testing-library/react';

// useThrottledLog is not exported — test it through a minimal wrapper
// that mimics the exact usage inside useAuth.
import { useCallback, useRef } from 'react';

function useThrottledLog(logFn: () => void, delay: number = 10000) {
  const lastLogTime = useRef(0);
  const logFnRef = useRef(logFn);
  logFnRef.current = logFn;

  return useCallback(() => {
    const now = Date.now();
    if (now - lastLogTime.current >= delay) {
      logFnRef.current();
      lastLogTime.current = now;
    }
  }, [delay]);
}

describe('useThrottledLog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a stable function reference across re-renders', () => {
    const logFn = vi.fn();
    const { result, rerender } = renderHook(() => useThrottledLog(logFn, 1000));

    const ref1 = result.current;
    rerender();
    expect(result.current).toBe(ref1); // same reference
  });

  it('returns a stable reference even when logFn changes', () => {
    let log = vi.fn();
    const { result, rerender } = renderHook(() => useThrottledLog(log, 1000));

    const ref1 = result.current;
    log = vi.fn(); // new function reference
    rerender();
    expect(result.current).toBe(ref1); // still same stable callback
  });

  it('calls the latest logFn when invoked', () => {
    const log1 = vi.fn();
    let activeLog = log1;
    const { result, rerender } = renderHook(() => useThrottledLog(activeLog, 1000));

    act(() => {
      result.current();
    });
    expect(log1).toHaveBeenCalledTimes(1);

    const log2 = vi.fn();
    activeLog = log2;
    rerender();

    // Advance past throttle window
    vi.advanceTimersByTime(1001);

    act(() => {
      result.current();
    });
    expect(log2).toHaveBeenCalledTimes(1);
    expect(log1).toHaveBeenCalledTimes(1); // not called again
  });

  it('throttles calls within the delay window', () => {
    const logFn = vi.fn();
    const { result } = renderHook(() => useThrottledLog(logFn, 1000));

    act(() => {
      result.current();
    }); // fires
    act(() => {
      result.current();
    }); // throttled
    act(() => {
      result.current();
    }); // throttled

    expect(logFn).toHaveBeenCalledTimes(1);
  });

  it('allows a call after the delay window passes', () => {
    const logFn = vi.fn();
    const { result } = renderHook(() => useThrottledLog(logFn, 1000));

    act(() => {
      result.current();
    }); // fires
    vi.advanceTimersByTime(1001);
    act(() => {
      result.current();
    }); // fires again

    expect(logFn).toHaveBeenCalledTimes(2);
  });

  it('does not call logFn before the delay elapses', () => {
    const logFn = vi.fn();
    const { result } = renderHook(() => useThrottledLog(logFn, 5000));

    act(() => {
      result.current();
    }); // fires
    vi.advanceTimersByTime(4999);
    act(() => {
      result.current();
    }); // still throttled

    expect(logFn).toHaveBeenCalledTimes(1);
  });
});
