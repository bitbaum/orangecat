/**
 * Desktop Navigation Component
 *
 * Modular desktop navigation links for header.
 * Follows SOC principle - separate from Header component.
 *
 * Created: 2026-01-16
 * Last Modified: 2026-07-27
 * Last Modified Summary: Delegate rendering to HeaderNavigation (Variant A) so
 *   dropdown items (children, no href) render as menus instead of crashing.
 */

'use client';

import { useShellPathname } from '@/hooks/useShellPathname';
import type { NavigationItem } from '@/config/navigation';
import { isNavHrefActive } from '@/lib/navigation/isActive';
import { HeaderNavigation } from './HeaderNavigation';

interface DesktopNavigationProps {
  /** Navigation items to display */
  items: NavigationItem[];
}

/**
 * Desktop navigation links
 *
 * Delegates to HeaderNavigation (Variant A), the dropdown-aware header nav
 * renderer, instead of duplicating link markup. This matters because the
 * marketing nav now contains parent items with `children` and no `href`
 * (e.g. the "Product" dropdown) — rendering those as a bare `<Link>` produced
 * `href={undefined}`, which crashes static prerendering in production.
 *
 * Active-state matching uses the same SSOT (`isNavHrefActive`) as the sidebar
 * and mobile bottom nav — adding a new chrome surface should never grow a
 * fourth implementation.
 */
export function DesktopNavigation({ items }: DesktopNavigationProps) {
  const pathname = useShellPathname();

  return (
    <div className="hidden lg:flex items-center gap-1 xl:gap-2 ml-2">
      <HeaderNavigation items={items} isActive={href => isNavHrefActive(pathname, href)} />
    </div>
  );
}
