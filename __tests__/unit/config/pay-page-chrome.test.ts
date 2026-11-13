import { getRouteChrome, isPayPagePath } from '@/config/routes';

// A pay page has one orange action, "Pay CHF 20". The header's sign-up beside
// it was a second, brighter one, so on that page it steps down to outline.
describe('the header sign-up on a pay page', () => {
  it('is quiet on one person’s pay page', () => {
    expect(isPayPagePath('/pay/mao')).toBe(true);
    expect(getRouteChrome('/pay/mao').quietHeaderSignup).toBe(true);
  });
  it('stays the funnel action on the /pay landing and elsewhere', () => {
    expect(getRouteChrome('/pay').quietHeaderSignup).toBe(false);
    expect(getRouteChrome('/').quietHeaderSignup).toBe(false);
    expect(getRouteChrome('/pay/mao/extra').quietHeaderSignup).toBe(false);
  });
});
