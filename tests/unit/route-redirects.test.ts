import routeAliases from '@/config/route-aliases.json';
import {
  expectedAliasDestination,
  expectedAliasTerminalDestination,
  expectedAppPageDestination,
  matchesRedirectExpectation,
} from '@/config/route-redirects';

describe('route redirect contracts', () => {
  it.each([
    ['/projects', '/projects', '/discover?type=projects'],
    ['/donations', '/donations', '/discover?type=causes'],
    ['/profile/[username]', '/profile/alice%20cat', '/profiles/alice%20cat'],
    ['/project/[id]', '/project/id%2Fvalue', '/projects/id%2Fvalue'],
    ['/documents/[id]', '/documents/document-id', '/dashboard/documents/document-id'],
  ])('maps %s to its expected destination', (pattern, requested, expected) => {
    const contract = expectedAppPageDestination(pattern, requested);
    expect(contract).not.toBeNull();
    expect(matchesRedirectExpectation(expected, contract!)).toBe(true);
  });

  it('allows only the documented profile-resolution family', () => {
    const contract = expectedAppPageDestination('/profiles/me', '/profiles/me');
    expect(matchesRedirectExpectation('/profiles/alice', contract!)).toBe(true);
    expect(matchesRedirectExpectation('/dashboard/info/edit', contract!)).toBe(true);
    expect(matchesRedirectExpectation('/dashboard/projects', contract!)).toBe(false);
  });

  it.each([
    ['/login', '/auth?mode=login'],
    ['/fund-us/project-id', '/projects/project-id'],
    ['/fund-us/project-id/edit', '/dashboard/projects/create?edit=project-id'],
    ['/ai-chat/history', '/dashboard/cat'],
  ])('materializes alias %s', (requested, expected) => {
    expect(expectedAliasDestination(requested, routeAliases)).toEqual({
      exact: [expected],
    });
  });

  it.each([
    ['/cat', '/auth?mode=login&from=%2Fdashboard%2Fcat'],
    [
      '/fund-us/project-id/edit',
      '/auth?mode=login&from=%2Fdashboard%2Fprojects%2Fcreate%3Fedit%3Dproject-id',
    ],
  ])('models the protected terminal state for alias %s', (requested, expected) => {
    expect(expectedAliasTerminalDestination(requested, routeAliases)).toEqual({
      exact: [expected],
    });
  });
});
