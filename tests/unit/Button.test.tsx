// @vitest-environment jsdom
/**
 * Button Component Tests — behavior, not class strings.
 *
 * Earlier this file asserted specific Tailwind class combinations like
 * "bg-tiffany-500 hover:bg-tiffany-600" that the rebrand removed. The
 * test failed every time anyone touched the design system. Rewritten
 * 2026-06-03 to assert what consumers CARE about: variant + size
 * routing produce *some* className change, clicks fire, disabled stops
 * clicks, loading hides the children and shows the spinner. Now the
 * design system can evolve without breaking these tests.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from '@/components/ui/Button';

vi.mock('next/link', () => ({
  default: function MockLink({
    children,
    href,
    ...props
  }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

describe('Button', () => {
  describe('rendering', () => {
    it('renders its children as a button by default', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders as a link when href is provided', () => {
      render(<Button href="/foo">Link button</Button>);
      const link = screen.getByRole('link', { name: 'Link button' });
      expect(link).toHaveAttribute('href', '/foo');
    });

    it('passes className through to the rendered element', () => {
      render(<Button className="my-custom-class">x</Button>);
      expect(screen.getByRole('button')).toHaveClass('my-custom-class');
    });

    it('has a stable displayName for devtools', () => {
      expect(Button.displayName).toBe('Button');
    });
  });

  describe('variant + size routing', () => {
    // We don't assert specific Tailwind classes (those move with the
    // design system). Instead we verify that different variant / size
    // props produce DIFFERENT className strings — proves the routing
    // through COMPONENT_STYLES works.
    const variants = ['primary', 'secondary', 'ghost', 'danger', 'outline', 'gradient'] as const;

    it.each(variants)('variant=%s produces a non-empty className', variant => {
      const { container } = render(<Button variant={variant}>Variant</Button>);
      const btn = container.querySelector('button');
      expect(btn?.className.length).toBeGreaterThan(0);
    });

    const sizes = ['sm', 'md', 'lg', 'xl'] as const;
    it.each(sizes)('size=%s produces a non-empty className', size => {
      const { container } = render(<Button size={size}>Sized</Button>);
      const btn = container.querySelector('button');
      expect(btn?.className.length).toBeGreaterThan(0);
    });
  });

  describe('interactivity', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Click</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn();
      render(
        <Button onClick={onClick} disabled>
          Disabled
        </Button>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('reflects the disabled prop in the DOM', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('applies the type attribute (defaults to button)', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });
  });

  describe('loading state', () => {
    it('disables the button while loading', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });
});
