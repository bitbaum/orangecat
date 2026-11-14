// @vitest-environment jsdom
/**
 * Home page composition: the fold (the promise and the claim), what people
 * have listed, the Cat's first answer, then "What it solves". The studio's
 * own products are on /ecosystem; long-form sections live on /how-it-works.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/home/sections/HeroSection', () => ({
  default: function MockHeroSection() {
    return (
      <section data-testid="hero-section">
        <h1>Turn who you are into income.</h1>
        <button type="submit">Claim your link</button>
      </section>
    );
  },
}));

vi.mock('@/components/home/sections/MakersSection', () => ({
  default: function MockMakersSection() {
    return <div data-testid="makers-section" />;
  },
}));

vi.mock('@/components/home/sections/FirstAnswerSection', () => ({
  default: function MockFirstAnswerSection() {
    return <div data-testid="first-answer-section" />;
  },
}));

vi.mock('@/components/home/sections/ProblemsSection', () => ({
  default: function MockProblemsSection() {
    return <div data-testid="problems-section" />;
  },
}));

import HomePublic from '@/components/home/HomePublic';

describe('HomePublic', () => {
  it('renders the fold, the makers, the first answer and what it solves, in that order', () => {
    const { container } = render(<HomePublic />);
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('problems-section')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /turn who you are into income/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim your link/i })).toBeInTheDocument();

    const order = Array.from(container.querySelectorAll('[data-testid]')).map(el =>
      el.getAttribute('data-testid')
    );
    expect(order).toEqual([
      'hero-section',
      'makers-section',
      'first-answer-section',
      'problems-section',
    ]);
  });

  it('has a minimum height container', () => {
    const { container } = render(<HomePublic />);
    expect(container.firstChild).toHaveClass('min-h-screen');
  });
});
