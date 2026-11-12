// @vitest-environment jsdom
/**
 * The visitor menu (the public header's links on a narrow screen).
 *
 * Measured on production at 390px on 2026-11-12: the menu showed "Blog" and
 * "Support", dropped the Product and Ecosystem groups (they have children and
 * no href, so they rendered nothing), listed 27 footer links in their place,
 * and offered no Sign in anywhere. It was a plain div: no dialog role, no
 * close control, and the button that opened it did not say it was open.
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { MobileMenu, VISITOR_MENU_ID } from '@/components/layout/MobileMenu';
import { MenuToggleButton } from '@/components/layout/MenuToggleButton';
import { authNavigationItems, getHeaderNavigationItems } from '@/config/navigation';
import type { NavigationItem } from '@/components/layout/HeaderNavigation';

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

const navigation: NavigationItem[] = [
  {
    name: 'Product',
    children: [
      { name: 'About & mission', href: '/about', description: 'Why OrangeCat exists' },
      { name: 'Pricing', href: '/pricing', description: 'Cat plans' },
    ],
  },
  { name: 'Blog', href: '/blog', description: 'Guides and stories from the build' },
  {
    name: 'Ecosystem',
    children: [
      { name: 'Loki', href: 'https://loki.example', external: true, description: 'Build' },
    ],
  },
];

function renderMenu(onClose = vi.fn()) {
  const menuRef = React.createRef<HTMLDivElement>();
  render(
    <MobileMenu
      isOpen
      isClosing={false}
      menuRef={menuRef}
      navigation={navigation}
      signIn={{ name: 'Sign In', href: '/auth?mode=login' }}
      getStarted={{ name: 'Get Started', href: '/auth?mode=register' }}
      onClose={onClose}
    />
  );
  return { onClose, dialog: screen.getByRole('dialog', { name: 'Menu' }) };
}

describe('visitor menu', () => {
  it('is a modal dialog the header button can point at', () => {
    const { dialog } = renderMenu();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('id', VISITOR_MENU_ID);
  });

  it('lists a group as a heading with its links, each with its line', () => {
    const { dialog } = renderMenu();
    expect(within(dialog).getByRole('heading', { name: 'Product' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Ecosystem' })).toBeInTheDocument();

    const about = within(dialog).getByRole('link', { name: /About & mission/ });
    expect(about).toHaveAttribute('href', '/about');
    expect(about).toHaveTextContent('Why OrangeCat exists');
    expect(about.className).toContain('min-h-11');
  });

  it('keeps a plain link out of the group before it', () => {
    const { dialog } = renderMenu();
    const blog = within(dialog).getByRole('link', { name: /Blog/ });
    const productGroup = within(dialog).getByRole('heading', { name: 'Product' }).closest('section');
    expect(productGroup).not.toBeNull();
    expect(productGroup).not.toContainElement(blog);
  });

  it('opens an outside site in a new tab and says so', () => {
    const { dialog } = renderMenu();
    const loki = within(dialog).getByRole('link', { name: /Loki/ });
    expect(loki).toHaveAttribute('target', '_blank');
    expect(loki).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(loki).toHaveTextContent('(opens in a new tab)');
  });

  it('ends with the two ways in, as equal cells', () => {
    const { dialog } = renderMenu();
    const signIn = within(dialog).getByRole('link', { name: 'Sign In' });
    const getStarted = within(dialog).getByRole('link', { name: 'Get Started' });
    expect(signIn).toHaveAttribute('href', '/auth?mode=login');
    expect(getStarted).toHaveAttribute('href', '/auth?mode=register');
    expect(signIn.parentElement).toBe(getStarted.parentElement);
    expect(signIn.parentElement?.className).toContain('grid-cols-2');
  });

  it('has a close button, and picking a destination closes it too', () => {
    const { dialog, onClose } = renderMenu();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('link', { name: /Pricing/ }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not repeat the footer', () => {
    const { dialog } = renderMenu();
    expect(within(dialog).queryByRole('link', { name: /Privacy/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: /Terms/ })).not.toBeInTheDocument();
  });

  it('renders nothing until it has been opened', () => {
    const menuRef = React.createRef<HTMLDivElement>();
    render(
      <MobileMenu
        isOpen={false}
        isClosing={false}
        menuRef={menuRef}
        navigation={navigation}
        signIn={{ name: 'Sign In', href: '/auth?mode=login' }}
        getStarted={{ name: 'Get Started', href: '/auth?mode=register' }}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('the button that opens the visitor menu', () => {
  it('says whether the menu is open and which element it opens', () => {
    const { rerender } = render(
      <MenuToggleButton
        onClick={vi.fn()}
        ariaLabel="Open navigation menu"
        expanded={false}
        controls={VISITOR_MENU_ID}
      />
    );
    const button = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', VISITOR_MENU_ID);

    rerender(
      <MenuToggleButton
        onClick={vi.fn()}
        ariaLabel="Close navigation menu"
        expanded
        controls={VISITOR_MENU_ID}
      />
    );
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });
});

describe('the header navigation config the menu draws', () => {
  const items = getHeaderNavigationItems();

  it('gives every destination a line that says what it is', () => {
    const links = items.flatMap(item => (item.children?.length ? item.children : [item]));
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      expect(link.href, link.name).toBeTruthy();
      expect(link.description, link.name).toBeTruthy();
    }
  });

  it('has a sign-in and a get-started destination for the menu to end with', () => {
    expect(authNavigationItems).toHaveLength(2);
    expect(authNavigationItems[0]?.href).toContain('mode=login');
    expect(authNavigationItems[1]?.href).toContain('mode=register');
  });
});
