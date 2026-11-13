// @vitest-environment jsdom
/**
 * The pay page named the payee by display name alone, so "Anna" could be any
 * Anna. One block now draws face, name and @handle on both ends of the link.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { PayeeIdentity } from '@/components/money/PayeeIdentity';
import { ROUTES } from '@/config/routes';

afterEach(cleanup);

describe('PayeeIdentity', () => {
  it('on the pay page: the name is the heading and the handle links to the profile', () => {
    render(
      <PayeeIdentity
        asHeading
        name="Anna Muster"
        username="anna"
        profileHref={ROUTES.PROFILES.VIEW('anna')}
      />
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Anna Muster' })).toBeTruthy();
    const handle = screen.getByRole('link', { name: '@anna' });
    expect(handle.getAttribute('href')).toBe('/profiles/anna');
    expect(handle.className).toContain('min-h-11');
  });

  it('on Receive: the same block, the handle as text', () => {
    render(<PayeeIdentity name="Anna Muster" username="anna" />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('@anna')).toBeTruthy();
  });
});
