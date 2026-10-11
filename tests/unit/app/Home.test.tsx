// @vitest-environment jsdom
/**
 * Home page composition: the fold, the studio behind it, then "What it solves".
 * Long-form marketing sections (steps, comparison) live on /how-it-works.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/home/sections/HeroSection', () => ({
  default: function MockHeroSection() {
    return (
      <section data-testid="hero-section">
        <h1>
          Turn who you are <span>into income.</span>
        </h1>
        <a href="/auth">Meet your Cat</a>
      </section>
    );
  },
}));

vi.mock('@/components/home/sections/StudioSection', () => ({
  default: function MockStudioSection() {
    return <div data-testid="studio-section" />;
  },
}));

vi.mock('@/components/home/sections/ProblemsSection', () => ({
  default: function MockProblemsSection() {
    return <div data-testid="problems-section" />;
  },
}));

import HomePublic from '@/components/home/HomePublic';

describe('HomePublic', () => {
  it('renders the fold, the studio and what it solves, in that order', () => {
    const { container } = render(<HomePublic />);
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('studio-section')).toBeInTheDocument();
    expect(screen.getByTestId('problems-section')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /turn who you are into income/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /meet your cat/i })).toBeInTheDocument();

    const order = Array.from(container.querySelectorAll('[data-testid]')).map(el =>
      el.getAttribute('data-testid')
    );
    expect(order).toEqual(['hero-section', 'studio-section', 'problems-section']);
  });

  it('has a minimum height container', () => {
    const { container } = render(<HomePublic />);
    expect(container.firstChild).toHaveClass('min-h-screen');
  });
});
