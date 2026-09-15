'use client';

import React from 'react';
import Link from 'next/link';
import { footerNavigation } from '@/config/navigation';
import { shouldShowFooter } from '@/config/routes';
import Logo from './Logo';
import { usePathname } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { APP_NAME } from '@/config/brand';
import { useAuth } from '@/hooks/useAuth';

const footerLinkClass =
  'group flex items-center text-sm text-fg-secondary hover:text-fg-primary transition-colors py-1.5 rounded-md min-h-9';
const footerHeadingClass = 'text-xs font-medium text-fg-secondary uppercase tracking-normal';

/**
 * One column of footer links. Five of these were written out by hand — the
 * same seventeen lines five times, and only two of the five carried the
 * anchor-vs-Link branch, so which columns could hold an external link was an
 * accident of which ones had been copied last. One column, one rule: an item
 * marked external is an <a target="_blank">, everything else is a <Link>.
 */
function FooterColumn({
  title,
  items,
  className,
}: {
  title: string;
  items: ReadonlyArray<{ name: string; href: string; external?: boolean }>;
  className?: string;
}) {
  return (
    <div className={className ? `space-y-6 ${className}` : 'space-y-6'}>
      <h3 className={footerHeadingClass}>{title}</h3>
      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.name}>
            {'external' in item && item.external ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={footerLinkClass}
              >
                <span>{item.name}</span>
              </a>
            ) : (
              <Link href={item.href} className={footerLinkClass}>
                <span>{item.name}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const Footer = React.memo(function Footer() {
  const pathname = usePathname();
  const { user, hydrated } = useAuth();
  const shouldRender = shouldShowFooter(pathname ?? '/');

  const scrollToTop = () => {
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Marketing footer is for anonymous visitors only. Signed-in users keep
  // the app chrome everywhere — including public pages and 404/error pages
  // — instead of getting a second marketing nav system. Also never render
  // on app surfaces (layout conflicts with the sidebar).
  if (!shouldRender || (hydrated && !!user)) {
    return null;
  }

  return (
    <footer className="bg-surface-page border-t border-default mt-auto relative">
      {/* Back to top button */}
      <button
        onClick={scrollToTop}
        className="absolute -top-5 right-4 sm:right-8 w-10 h-10 bg-surface-base text-fg-primary rounded-md border border-default hover:bg-surface-raised transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background flex items-center justify-center group z-10"
        aria-label="Back to top"
        type="button"
      >
        <ArrowUp className="w-4 h-4" />
      </button>

      <div className="max-w-7xl mx-auto py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-10">
          {/* Brand Section */}
          <div className="sm:col-span-2 lg:col-span-1 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-4 mb-2">
                <Logo />
              </div>
              <p className="text-fg-secondary text-base leading-relaxed max-w-xs">
                Your AI economic agent — and the platform where it operates.
              </p>
            </div>

            {/* Social Links */}
            <div className="flex space-x-4">
              {footerNavigation.social.map(item => (
                <a
                  key={item.name}
                  href={item.href}
                  className="group w-9 h-9 bg-surface-base border border-default rounded-md flex items-center justify-center text-fg-secondary hover:text-fg-primary hover:bg-surface-raised transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow us on ${item.name}`}
                >
                  {item.icon && (
                    <item.icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                  )}
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title="Product" items={footerNavigation.product} />

          <FooterColumn title="Learn" items={footerNavigation.learn} />

          <FooterColumn title="Support" items={footerNavigation.support} />

          <FooterColumn title="Ecosystem" items={footerNavigation.ecosystem} />

          <FooterColumn
            title="Legal"
            items={footerNavigation.legal}
            className="sm:col-span-2 lg:col-span-1"
          />
        </div>

        {/* Bottom Section */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-default">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="text-sm text-fg-secondary text-center sm:text-left">
              <p>&copy; 2026 {APP_NAME}. All rights reserved.</p>
            </div>

            {/* Additional Links — sourced from config.footerNavigation.bottomBar
                so adding/removing a link is a config-only change. */}
            <div className="flex items-center space-x-6 text-sm">
              {footerNavigation.bottomBar.map(link =>
                link.external ? (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={footerLinkClass}
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link key={link.name} href={link.href} className={footerLinkClass}>
                    {link.name}
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;
