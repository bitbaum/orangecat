// @vitest-environment jsdom
/**
 * The one header every public page opens with (fleet rule "One shape per
 * kind": siblings share one frame).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';

describe('PublicPageHeader', () => {
  it('renders one h1 at the public title scale', () => {
    render(<PublicPageHeader title="Pricing" />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Pricing');
    expect(headings[0].className).toContain('font-heading');
    expect(headings[0].className).toContain('text-3xl');
    expect(headings[0].className).toContain('lg:text-5xl');
  });

  it('centres by default and starts the column for a document', () => {
    const { rerender } = render(<PublicPageHeader title="About" lede="What it is." />);
    expect(screen.getByRole('banner').className).toContain('text-center');
    expect(screen.getByText('What it is.').className).toContain('mx-auto');

    rerender(<PublicPageHeader align="start" title="Changelog" lede="What changed." />);
    expect(screen.getByRole('banner').className).not.toContain('text-center');
    expect(screen.getByText('What changed.').className).not.toContain('mx-auto');
  });

  it('puts the eyebrow above the title, and the lede and small print under it', () => {
    render(
      <PublicPageHeader
        eyebrow="Building in public"
        title="Changelog"
        lede="What changed."
        meta="Last updated: 2026-11-12"
      />
    );
    const order = Array.from(screen.getByRole('banner').children).map(el => el.textContent);
    expect(order).toEqual([
      'Building in public',
      'Changelog',
      'What changed.',
      'Last updated: 2026-11-12',
    ]);
  });

  it('cancels the global paragraph margin so its own spacing holds', () => {
    render(<PublicPageHeader title="Docs" lede="How it works." meta="v1" />);
    expect(screen.getByText('How it works.').className).toContain('mb-0');
    expect(screen.getByText('v1').className).toContain('mb-0');
  });

  it('holds buttons or a form that belong to the title', () => {
    render(
      <PublicPageHeader title="Domains">
        <button type="button">Check availability</button>
      </PublicPageHeader>
    );
    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('button', { name: 'Check availability' })
    );
  });

  it('offers exactly two page widths', () => {
    expect(Object.keys(PUBLIC_PAGE_WIDTH)).toEqual(['reading', 'wide']);
    expect(PUBLIC_PAGE_WIDTH.reading).toContain('max-w-3xl');
    expect(PUBLIC_PAGE_WIDTH.wide).toContain('max-w-6xl');
  });
});
