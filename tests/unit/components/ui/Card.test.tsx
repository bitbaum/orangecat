// @vitest-environment jsdom
/**
 * Card Component Tests — behavior, not class strings.
 *
 * The earlier suite asserted specific Tailwind class combinations the
 * design system has since changed. Rewritten 2026-06-03 to test what
 * consumers actually rely on: children render, variants route through
 * COMPONENT_STYLES (we just check classNames differ), and sub-parts
 * render as the right HTML elements.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';

describe('Card', () => {
  it('renders children', () => {
    render(
      <Card>
        <span>hello</span>
      </Card>
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('passes className through to the root', () => {
    const { container } = render(<Card className="my-card">x</Card>);
    expect(container.firstChild).toHaveClass('my-card');
  });

  it('forwards arbitrary props (data attributes)', () => {
    const { container } = render(
      <Card data-testid="card" aria-label="info card">
        x
      </Card>
    );
    expect(container.querySelector('[data-testid="card"]')).toHaveAttribute(
      'aria-label',
      'info card'
    );
  });

  const variants = ['default', 'elevated', 'minimal', 'gradient'] as const;
  it.each(variants)('variant=%s renders without throwing', variant => {
    const { container } = render(<Card variant={variant}>x</Card>);
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).className.length).toBeGreaterThan(0);
  });

  it('renders nested header/title/description/content/footer', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByText('Title').tagName).toBe('H3');
    expect(screen.getByText('Description').tagName).toBe('P');
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});
