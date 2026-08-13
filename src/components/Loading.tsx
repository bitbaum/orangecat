'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { ContextualLoader } from '@/components/navigation/ContextualLoader';
import { cn } from '@/lib/utils';

interface Props {
  fullScreen?: boolean;
  message?: string;
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
  className?: string;
  contextual?: boolean;
}

export default function Loading({
  fullScreen = false,
  message = 'Loading...',
  size = 'medium',
  overlay = false,
  className = '',
  contextual = false,
}: Props) {
  // Size mapping
  const sizeClasses = {
    small: 'h-5 w-5',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
  };

  // Container classes
  const containerClasses = fullScreen
    ? 'min-h-screen flex items-center justify-center'
    : 'flex items-center justify-center ' + className;

  // Overlay classes
  const overlayClasses = overlay
    ? 'fixed inset-0 bg-black/30 backdrop-blur-sm z-loading flex items-center justify-center'
    : '';

  // Show contextual loader for better UX during navigation
  if (contextual && fullScreen) {
    return (
      <div
        className={cn(
          'min-h-screen flex items-center justify-center',
          overlay
            ? 'fixed inset-0 bg-surface-base/95 dark:bg-surface-base/95 backdrop-blur-sm z-loading'
            : '',
          className
        )}
        suppressHydrationWarning
        role="status"
        aria-live="polite"
        aria-busy="true"
        data-loading="true"
      >
        <ContextualLoader />
      </div>
    );
  }

  const content = (
    <div
      className="flex flex-col items-center space-y-3"
      suppressHydrationWarning
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-loading="true"
    >
      <Loader2 className={`${sizeClasses[size]} animate-spin text-fg-primary`} />
      {message && <p className="text-sm text-fg-secondary font-sans">{message}</p>}
    </div>
  );

  if (overlay) {
    return (
      <div className={overlayClasses} suppressHydrationWarning>
        {content}
      </div>
    );
  }

  return (
    <div className={containerClasses} suppressHydrationWarning>
      {content}
    </div>
  );
}
