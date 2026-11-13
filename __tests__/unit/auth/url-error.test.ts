/**
 * The sign-in page shows fixed copy for a `?error=` value and never the value.
 * It used to print the parameter as it arrived, so a link could put any words
 * on OrangeCat's sign-in card.
 */
import { AUTH_URL_ERROR, authUrlErrorMessage } from '@/app/auth/url-error';

describe('authUrlErrorMessage', () => {
  it('says nothing when there is no error', () => {
    expect(authUrlErrorMessage(null)).toBeNull();
    expect(authUrlErrorMessage('')).toBeNull();
  });

  it('maps the codes the routes send', () => {
    expect(authUrlErrorMessage('failed')).toBe(AUTH_URL_ERROR.failed);
    expect(authUrlErrorMessage('link_expired')).toBe(AUTH_URL_ERROR.link_expired);
    expect(authUrlErrorMessage('AccessDenied')).toBe(AUTH_URL_ERROR.denied);
  });

  it('never repeats words a link carried', () => {
    const planted = 'Your account is locked. Call +41 00 000 00 00 to unlock it.';
    const shown = authUrlErrorMessage(planted);
    expect(shown).toBe(AUTH_URL_ERROR.failed);
    expect(shown).not.toContain('Call');
  });
});
