/**
 * The visitor menu: the public header's links on a screen too narrow for
 * them. It lists the same destinations as the desktop header, in the same
 * groups, each with the line that says what it is, and ends with the two
 * ways in. The page's footer is not repeated here; it is on the page.
 */

'use client';

import { useId } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import { ExternalLink, X } from 'lucide-react';

import Button from '@/components/ui/Button';
import { getMobileMenuBackdropClasses, getMobileMenuPanelClasses } from '@/lib/ui/header-utils';

import type { NavigationItem } from './HeaderNavigation';

/** The id the header's menu button points at with `aria-controls`. */
export const VISITOR_MENU_ID = 'visitor-menu';

interface MobileMenuProps {
  /** Whether menu is open */
  isOpen: boolean;
  /** Whether menu is in closing animation */
  isClosing: boolean;
  /** Ref for menu element */
  menuRef: React.RefObject<HTMLDivElement | null>;
  /** The header's destinations: links, and groups of links. */
  navigation: NavigationItem[];
  /** The two ways in, pinned under the list. */
  signIn: { name: string; href: string };
  getStarted: { name: string; href: string };
  /** Callback when menu closes */
  onClose: () => void;
}

const ROW =
  'flex min-h-11 flex-col justify-center rounded-md px-3 py-2 text-fg-primary hover:bg-surface-raised';

function MenuRow({ item, onClose }: { item: NavigationItem; onClose: () => void }) {
  if (!item.href) {
    return null;
  }

  const label = (
    <>
      <span className="flex items-center gap-1.5 text-base font-medium">
        {item.name}
        {item.external ? <ExternalLink className="h-3.5 w-3.5" aria-hidden /> : null}
      </span>
      {item.description ? (
        <span className="text-sm text-fg-secondary">{item.description}</span>
      ) : null}
    </>
  );

  return (
    <li>
      {item.external ? (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={ROW}
          onClick={onClose}
        >
          {label}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        <Link href={item.href} className={ROW} onClick={onClose}>
          {label}
        </Link>
      )}
    </li>
  );
}

function MenuGroup({ item, onClose }: { item: NavigationItem; onClose: () => void }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-caps text-fg-secondary"
      >
        {item.name}
      </h2>
      <ul className="space-y-1">
        {(item.children ?? []).map(child => (
          <MenuRow key={`${item.name}-${child.name}`} item={child} onClose={onClose} />
        ))}
      </ul>
    </section>
  );
}

type MenuBlock =
  { group: NavigationItem; links?: never } | { group?: never; links: NavigationItem[] };

/**
 * The header's items as the blocks the menu draws: a group with its heading,
 * or a run of plain links. A hairline separates blocks, so a plain link that
 * follows a group does not read as one more member of it.
 */
function menuBlocks(items: NavigationItem[]): MenuBlock[] {
  const blocks: MenuBlock[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      blocks.push({ group: item });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last?.links) {
      last.links.push(item);
    } else {
      blocks.push({ links: [item] });
    }
  }
  return blocks;
}

/**
 * Rendered in a portal so it layers above the page. It is a modal dialog:
 * focus stays inside while it is open and returns to the menu button when it
 * closes.
 */
export function MobileMenu({
  isOpen,
  isClosing,
  menuRef,
  navigation,
  signIn,
  getStarted,
  onClose,
}: MobileMenuProps) {
  // Don't render if menu has never been opened
  if (!isOpen && !isClosing) {
    return null;
  }

  const items = Array.isArray(navigation) ? navigation : [];

  return createPortal(
    <>
      <div className={getMobileMenuBackdropClasses(isOpen)} aria-hidden="true" />

      <FocusLock disabled={!isOpen} returnFocus>
        <div
          ref={menuRef}
          id={VISITOR_MENU_ID}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={getMobileMenuPanelClasses(isOpen)}
        >
          <div className="flex items-center justify-between border-b border-subtle py-1 pl-7 pr-2">
            <span className="text-sm font-medium text-fg-secondary">Menu</span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-primary hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg-primary"
            >
              <X className="h-5 w-5" aria-hidden />
              <span className="sr-only">Close menu</span>
            </button>
          </div>

          <nav
            aria-label="Site"
            className="min-h-0 flex-1 divide-y divide-subtle overflow-y-auto overscroll-contain px-4"
          >
            {menuBlocks(items).map(block =>
              block.group ? (
                <div key={block.group.name} className="pb-3">
                  <MenuGroup item={block.group} onClose={onClose} />
                </div>
              ) : (
                <ul key={block.links[0]?.name} className="space-y-1 py-3">
                  {block.links.map(link => (
                    <MenuRow key={link.name} item={link} onClose={onClose} />
                  ))}
                </ul>
              )
            )}
          </nav>

          <div className="grid grid-cols-2 gap-2 border-t border-subtle p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button href={signIn.href} variant="outline" className="w-full" onClick={onClose}>
              {signIn.name}
            </Button>
            <Button href={getStarted.href} variant="accent" className="w-full" onClick={onClose}>
              {getStarted.name}
            </Button>
          </div>
        </div>
      </FocusLock>
    </>,
    document.body
  );
}
