// @vitest-environment jsdom
/**
 * Someone sent here by Solon to sign in used to read "Your AI economic agent"
 * beside the form and a "Back to home" link to OrangeCat. The column now
 * speaks for the app that sent them and leads back to it.
 */
import { render, screen } from '@testing-library/react';
import { AuthHeroPanel } from '@/app/auth/AuthHeroPanel';

describe('AuthHeroPanel', () => {
  it('speaks for the app that sent the person, and leads back to it', () => {
    render(<AuthHeroPanel client={{ name: 'Solon', home: 'https://solon.orangecat.ch' }} />);
    expect(screen.getByText('Continue to Solon')).toBeTruthy();
    expect(screen.getByText(/Solon never sees it/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Back to Solon/ }).getAttribute('href')).toBe(
      'https://solon.orangecat.ch'
    );
  });

  it("keeps OrangeCat's own pitch on a plain OrangeCat sign-in", () => {
    render(<AuthHeroPanel />);
    expect(screen.queryByText(/Continue to/)).toBeNull();
    expect(screen.getByRole('link', { name: /Back to home/ })).toBeTruthy();
  });

  it('holds no heading: the panel is hidden below lg, so the form title is the h1', () => {
    render(<AuthHeroPanel />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
