import { getContextualCreateAction } from '@/lib/navigation/contextual-create';
import { CREATE_OPTIONS } from '@/config/create-options';
import { ROUTES } from '@/config/routes';

it.each([ROUTES.DASHBOARD.HOME, ROUTES.TIMELINE])(
  '%s offers Article and Post instead of forcing the short-post composer',
  pathname => {
    expect(getContextualCreateAction(pathname)).toMatchObject({ type: 'menu', label: 'Create' });
    expect(CREATE_OPTIONS.map(option => option.href)).toEqual(
      expect.arrayContaining([ROUTES.ARTICLES_NEW, `${ROUTES.TIMELINE}?compose=true`])
    );
  }
);
