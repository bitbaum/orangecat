import { getRouteChrome } from '@/config/routes';

describe('messages has no floating Cat over the composer', () => {
  it('hides the global Cat on /messages and a conversation', () => {
    expect(getRouteChrome('/messages').hideGlobalCat).toBe(true);
    expect(getRouteChrome('/messages/abc').hideGlobalCat).toBe(true);
  });
  it('keeps it on ordinary app pages', () => {
    expect(getRouteChrome('/dashboard').hideGlobalCat).toBe(false);
    expect(getRouteChrome('/messagesx').hideGlobalCat).toBe(false);
  });
});
