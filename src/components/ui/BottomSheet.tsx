'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import FocusTrap from 'focus-trap-react';

export interface BottomSheetProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

/**
 * Mobile-first Bottom Sheet Component
 *
 * Features:
 * - Smooth slide-up animation
 * - Touch-friendly swipe-to-dismiss
 * - Backdrop overlay
 * - Accessible (ARIA, keyboard navigation)
 * - Portal rendering (z-index safe)
 * - iOS safe area support
 */
export default function BottomSheet({
  id,
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '85vh',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  // Close on Escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) {
      return;
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // Prevent body scroll when open
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Touch handlers for swipe-to-dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) {
      return;
    }

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    // Only allow downward swipes
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) {
      return;
    }

    const diff = currentY.current - startY.current;

    // Snap back even when the caller keeps the sheet open after a failed save.
    if (sheetRef.current) {
      sheetRef.current.style.transform = 'translateY(0)';
    }
    isDragging.current = false;
    if (diff > 100) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const sheet = (
    <FocusTrap active={isOpen}>
      <div
        id={id}
        className="fixed inset-0 z-50 flex items-end justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={closeOnOverlayClick ? onClose : undefined}
          aria-hidden="true"
        />

        {/* Sheet */}
        <div
          ref={sheetRef}
          className="relative w-full bg-surface-base rounded-t-lg shadow-sm transition-transform duration-300 ease-out"
          style={{
            maxHeight,
            transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          }}
        >
          {/* Drag handle */}
          <div
            className="flex min-h-11 justify-center pt-3 pb-2 touch-none"
            data-sheet-drag-handle
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={() => {
              isDragging.current = false;
              if (sheetRef.current) {
                sheetRef.current.style.transform = 'translateY(0)';
              }
            }}
          >
            <div className="w-12 h-1.5 bg-muted rounded-full" aria-hidden="true" />
          </div>

          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 id={titleId} className="text-lg font-semibold text-fg-primary">
                {title || ''}
              </h2>

              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="text-muted-dim hover:text-fg-primary min-h-11 min-w-11 flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div
            className="overflow-y-auto overscroll-contain"
            style={{
              maxHeight: title || showCloseButton ? `calc(${maxHeight} - 60px)` : maxHeight,
            }}
          >
            {children}
          </div>

          {/* iOS safe area padding */}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </div>
    </FocusTrap>
  );

  // Render in portal for z-index safety
  if (typeof window !== 'undefined') {
    return createPortal(sheet, document.body);
  }

  return null;
}
