// @vitest-environment jsdom
/**
 * A page opened fresh has nothing of ours behind it; an in-page Back that
 * calls history.back() there leaves the site (on a phone, to about:blank).
 */

import { backStaysInApp } from '@/lib/navigation/backStaysInApp';

function setReferrer(value: string) {
  Object.defineProperty(document, 'referrer', { value, configurable: true });
}

beforeEach(() => {
  delete (window as { navigation?: unknown }).navigation;
  setReferrer('');
});

describe('backStaysInApp', () => {
  it('trusts the Navigation API where the browser has it', () => {
    window.history.pushState({}, '', '/a');
    setReferrer(`${window.location.origin}/dashboard`);
    (window as { navigation?: unknown }).navigation = { canGoBack: false };
    expect(backStaysInApp()).toBe(false);

    (window as { navigation?: unknown }).navigation = { canGoBack: true };
    expect(backStaysInApp()).toBe(true);
  });

  it('without it, needs a page behind this one and a referrer from this site', () => {
    window.history.pushState({}, '', '/b');

    setReferrer('');
    expect(backStaysInApp()).toBe(false);

    setReferrer('https://www.example.com/search');
    expect(backStaysInApp()).toBe(false);

    setReferrer(`${window.location.origin}/dashboard`);
    expect(backStaysInApp()).toBe(true);
  });
});
