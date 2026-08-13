import { authLoginPath, safeReturnPath } from '@/lib/navigation/safe-return-path';

describe('safe auth return paths', () => {
  it('preserves an exact relative path, query, and fragment', () => {
    expect(safeReturnPath('/dashboard/projects/create?edit=project-id#details')).toBe(
      '/dashboard/projects/create?edit=project-id#details'
    );
    expect(authLoginPath('/dashboard/projects/create?edit=project-id')).toBe(
      '/auth?mode=login&from=%2Fdashboard%2Fprojects%2Fcreate%3Fedit%3Dproject-id'
    );
  });

  it.each([
    'https://attacker.example/steal',
    '//attacker.example/steal',
    '/\\attacker.example/steal',
    'javascript:alert(1)',
    '/auth?from=/dashboard',
    '/auth/callback?next=/dashboard',
  ])('rejects unsafe or recursive callback %s', candidate => {
    expect(safeReturnPath(candidate, '/dashboard/cat')).toBe('/dashboard/cat');
  });
});
