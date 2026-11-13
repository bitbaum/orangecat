/**
 * Header Navigation Component
 *
 * Reusable navigation component for headers with dropdown support
 * Eliminates code duplication between UnifiedHeader and AuthenticatedHeader
 *
 * Created: 2025-01-27
 * Last Modified: 2025-01-12
 * Last Modified Summary: Added dropdown menu support
 */

'use client';

import { useState, useRef, useEffect, useId } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavigationItem {
  name: string;
  href?: string;
  children?: NavigationItem[];
  description?: string;
  external?: boolean;
}

interface HeaderNavigationProps {
  items: NavigationItem[];
  isActive: (href: string) => boolean;
  className?: string;
}

/**
 * Header Navigation Component
 *
 * The horizontal links of the public header, with a dropdown for an item that
 * has children. The same items on a narrow screen are `MobileMenu`.
 */
export function HeaderNavigation(props: HeaderNavigationProps) {
  const { items = [], isActive, className } = props;
  const safeItems = Array.isArray(items) ? items : [];
  const activeFn = typeof isActive === 'function' ? isActive : () => false;
  return (
    <nav className={cn('flex items-center space-x-1', className)}>
      {safeItems.map(item => {
        if (item.children && item.children.length > 0) {
          return <HeaderNavDropdown key={item.name} item={item} isActive={activeFn} />;
        }

        if (!item.href) {
          return null;
        }
        if (item.external) {
          return (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-fg-secondary hover:text-fg-primary"
            >
              {item.name}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          );
        }
        return (
          <HeaderNavLink
            key={item.href}
            href={item.href}
            label={item.name}
            isActive={activeFn(item.href)}
          />
        );
      })}
    </nav>
  );
}

interface HeaderNavLinkProps {
  href: string;
  label: string;
  isActive: boolean;
}

/**
 * Header Navigation Link Component
 *
 * Individual navigation link with active state styling
 */
function HeaderNavLink({ href, label, isActive }: HeaderNavLinkProps) {
  const linkClasses = cn(
    'px-4 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 relative',
    isActive
      ? 'text-fg-primary bg-surface-overlay'
      : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-overlay'
  );

  return (
    <Link href={href} className={linkClasses}>
      {label}
      {isActive && <div className="absolute inset-x-3 bottom-0 h-px bg-fg-primary" />}
    </Link>
  );
}

interface HeaderNavDropdownProps {
  item: NavigationItem;
  isActive: (href: string) => boolean;
}

/**
 * Header Navigation Dropdown Component
 *
 * Dropdown menu for navigation items with children
 */
function HeaderNavDropdown({ item, isActive }: HeaderNavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Stable id linking the trigger (aria-controls) to the panel — disclosure pattern.
  const panelId = useId();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Escape closes the panel and returns focus to the trigger (keyboard a11y).
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Check if any child is active
  const hasActiveChild = item.children?.some(child => child.href && isActive(child.href)) || false;

  return (
    <div
      className="relative"
      ref={dropdownRef}
      // Close when keyboard focus leaves the panel. Only a mousedown closed it,
      // so Tab moved on with the panel still open, and two could be open at once.
      onBlur={event => {
        if (!dropdownRef.current?.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={cn(
          'px-4 py-2.5 min-h-11 text-sm font-medium rounded-md transition-colors duration-150 relative flex items-center gap-1',
          hasActiveChild
            ? 'text-fg-primary bg-surface-overlay'
            : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-overlay'
        )}
      >
        {item.name}
        <ChevronDown
          aria-hidden="true"
          className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
        />
        {hasActiveChild && <div className="absolute inset-x-3 bottom-0 h-px bg-fg-primary" />}
      </button>

      {isOpen && (
        <div
          id={panelId}
          aria-label={item.name}
          className="absolute top-full left-0 mt-2 w-56 bg-surface-base rounded-lg shadow-sm border border-default py-2 z-50"
        >
          {item.children?.map((child, _index) => {
            // Skip children without href
            if (!child.href) {
              return null;
            }

            // External children leave the app: new tab, noopener, and a visible
            // indicator — the same treatment top-level and mobile links get.
            if (child.external) {
              return (
                <a
                  key={child.href}
                  href={child.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2.5 min-h-11 text-sm text-fg-secondary transition-colors hover:text-fg-primary hover:bg-surface-overlay"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-center gap-1 font-medium">
                    {child.name}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </div>
                  {child.description && (
                    <div className="text-xs text-fg-secondary mt-0.5">{child.description}</div>
                  )}
                </a>
              );
            }

            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'block px-4 py-2.5 min-h-11 text-sm transition-colors',
                  isActive(child.href)
                    ? 'text-fg-primary bg-surface-overlay font-medium'
                    : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-overlay'
                )}
                onClick={() => setIsOpen(false)}
              >
                <div className="font-medium">{child.name}</div>
                {child.description && (
                  <div className="text-xs text-fg-secondary mt-0.5">{child.description}</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
