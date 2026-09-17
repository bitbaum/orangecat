// @vitest-environment jsdom
/**
 * Haptics are feedback, not a feature — so the guards that matter are the ones
 * that stop them from being a nuisance: never buzz someone who asked not to be
 * moved at, and never throw on a platform that has no vibration motor.
 */

import { haptic } from '@/lib/haptics';

const originalVibrate = navigator.vibrate;

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: reduced }),
  });
}

afterEach(() => {
  Object.defineProperty(navigator, 'vibrate', {
    writable: true,
    configurable: true,
    value: originalVibrate,
  });
});

describe('haptic', () => {
  it('vibrates for a completed payment', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: vibrate,
    });
    mockMatchMedia(false);

    haptic('success');

    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(Array.isArray(vibrate.mock.calls[0][0])).toBe(true);
  });

  it('stays silent when the user prefers reduced motion', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: vibrate,
    });
    mockMatchMedia(true);

    haptic('success');
    haptic('error');

    expect(vibrate).not.toHaveBeenCalled();
  });

  it('is a no-op where vibration does not exist, rather than throwing', () => {
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: undefined,
    });
    mockMatchMedia(false);

    expect(() => haptic('tap')).not.toThrow();
  });

  it('swallows a throwing vibrate — feedback must never break the payment', () => {
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: () => {
        throw new Error('document not focused');
      },
    });
    mockMatchMedia(false);

    expect(() => haptic('success')).not.toThrow();
  });

  it('uses distinct patterns so success and failure do not feel the same', () => {
    const calls: unknown[] = [];
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: (p: unknown) => calls.push(p),
    });
    mockMatchMedia(false);

    haptic('success');
    haptic('error');

    expect(calls[0]).not.toEqual(calls[1]);
  });
});
