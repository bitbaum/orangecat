import { requiresAuthentication } from '@/config/route-access';

describe('route access policy', () => {
  it.each([
    '/dashboard',
    '/dashboard/projects/create',
    '/settings',
    '/messages/conversation-id',
    '/post/post-id',
    '/send',
    '/receive',
    '/requests',
    '/documents/document-id',
    '/create/project',
    '/profiles/me',
    '/articles/new',
    '/articles/example/edit',
    '/groups/example/settings',
  ])('protects personal or mutation route %s', pathname => {
    expect(requiresAuthentication(pathname)).toBe(true);
  });

  it.each([
    '/',
    '/auth',
    '/community',
    '/collaborate',
    '/discover',
    '/projects',
    '/projects/project-id',
    '/profiles/mao-nakamoto',
    '/pay/mao-nakamoto',
    '/groups/example',
  ])('keeps evaluation route %s visitor-accessible', pathname => {
    expect(requiresAuthentication(pathname)).toBe(false);
  });

  it('matches boundaries rather than similarly prefixed public paths', () => {
    expect(requiresAuthentication('/dashboarding')).toBe(false);
    expect(requiresAuthentication('/settings-guide')).toBe(false);
    expect(requiresAuthentication('/profile/example')).toBe(false);
  });
});
