/**
 * Header logo — thin wrapper around BrandMark (SSOT).
 */

'use client';

import { BrandMark } from '@/components/shell/BrandMark';

export interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Where the mark leads; BrandMark's default (the public home) otherwise. */
  href?: string;
}

export default function Logo({ className = '', showText = true, size = 'md', href }: LogoProps) {
  const compact = size === 'sm' || !showText;

  return (
    <BrandMark
      compact={compact}
      showWordmark={showText}
      className={className}
      {...(href ? { href } : {})}
    />
  );
}
