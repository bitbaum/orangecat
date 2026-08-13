import { ECOSYSTEM } from '@/config/ecosystem';
import { ROUTES } from '@/config/routes';
import { optionalPublicProfilePath, publicProfilePath } from '@/config/public-profile-path';

describe('configuration import graph', () => {
  it('initializes ecosystem identities and route registry without a cycle', () => {
    expect(new URL(ECOSYSTEM.orangeCat.profileUrl).pathname).toBe('/profiles/mao-nakamoto');
    expect(ROUTES.PROFILES.VIEW('mao-nakamoto')).toBe('/profiles/mao-nakamoto');
    expect(ROUTES.PROJECTS.VIEW('project-id')).toBe('/projects/project-id');
  });

  it('builds public identity paths from usernames only', () => {
    expect(optionalPublicProfilePath(' mao nakamoto ')).toBe('/profiles/mao%20nakamoto');
    expect(ROUTES.PROFILES.VIEW('grüezi 100%')).toBe('/profiles/gr%C3%BCezi%20100%25');
    expect(publicProfilePath('webdev@example.com')).toBe('/profiles/webdev%40example.com');
    expect(optionalPublicProfilePath(null)).toBeNull();
    expect(optionalPublicProfilePath('  ')).toBeNull();
    expect(() => publicProfilePath('')).toThrow('non-empty username');
  });
});
