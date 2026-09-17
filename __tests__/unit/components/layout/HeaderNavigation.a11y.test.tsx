// @vitest-environment jsdom
/**
 * Accessibility behavior for the header navigation dropdown (disclosure pattern).
 *
 * The trigger must advertise its expanded state and control relationship so
 * screen-reader users know a button opens a menu, and Escape must close it.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeaderNavigation, type NavigationItem } from '@/components/layout/HeaderNavigation';

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

const items: NavigationItem[] = [
  {
    name: 'Explore',
    children: [
      { name: 'Projects', href: '/projects', description: 'Fundraising' },
      { name: 'Causes', href: '/causes' },
    ],
  },
];

describe('HeaderNavigation dropdown — a11y', () => {
  it('trigger exposes haspopup and collapsed state initially', () => {
    render(<HeaderNavigation items={items} isActive={() => false} />);
    const trigger = screen.getByRole('button', { name: /explore/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls');
  });

  it('toggles aria-expanded and reveals the linked panel on click', () => {
    render(<HeaderNavigation items={items} isActive={() => false} />);
    const trigger = screen.getByRole('button', { name: /explore/i });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // The panel referenced by aria-controls is now present and labelled.
    const panelId = trigger.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId);
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('aria-label', 'Explore');
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<HeaderNavigation items={items} isActive={() => false} />);
    const trigger = screen.getByRole('button', { name: /explore/i });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
