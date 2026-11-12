/**
 * BitcoinBadge Component
 *
 * Reusable component for Bitcoin-related badges that automatically uses
 * the correct Bitcoin Orange color from the centralized theme system.
 *
 * Created: June 5, 2025
 * Last Modified: June 5, 2025
 * Last Modified Summary: Initial creation
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface BitcoinBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'solid';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BitcoinBadge: React.FC<BitcoinBadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
}) => {
  const variantClasses = {
    default: 'bg-bitcoinOrange/10 text-bitcoinOrange border-bitcoinOrange/20',
    outline: 'bg-transparent text-bitcoinOrange border-bitcoinOrange',
    solid: 'bg-bitcoinOrange text-on-accent border-bitcoinOrange',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
};

export default BitcoinBadge;
