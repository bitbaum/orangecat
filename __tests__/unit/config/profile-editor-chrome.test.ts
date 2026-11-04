import { getRouteChrome } from '@/config/routes';
import { describePageForCat } from '@/config/cat-page-context';

describe('profile editor keeps the floating Cat', () => {
  it('shows the global Cat on /dashboard/info/edit (fill your profile by chat)', () => {
    expect(getRouteChrome('/dashboard/info/edit').hideGlobalCat).toBe(false);
  });
  it('still hides it on entity forms that carry their own Fill-with-AI bar', () => {
    expect(getRouteChrome('/dashboard/projects/create').hideGlobalCat).toBe(true);
    expect(getRouteChrome('/dashboard/projects/abc/edit').hideGlobalCat).toBe(true);
  });
  it('tells Cat it is on the profile editor', () => {
    expect(describePageForCat('/dashboard/info/edit')?.label).toMatch(/profile editor/);
  });
});
