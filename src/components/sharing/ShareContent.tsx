'use client';

import { useState } from 'react';
import { Share2, Mail, Copy, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { GRADIENTS } from '@/config/gradients';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { APP_NAME } from '@/config/brand';

// Real brand marks. lucide-react dropped brand icons in 0.400+ and the
// replacement here was `const Facebook = Globe; const Linkedin = Globe;` — two
// buttons rendering the SAME generic globe, plus lucide's multiply glyph
// standing in for X inside a panel whose close button is also a multiply glyph.
// See BrandIcons.tsx for why these are inline SVG rather than a dependency.
import { XBrandIcon, FacebookBrandIcon, LinkedInBrandIcon, WhatsAppBrandIcon } from './BrandIcons';

export interface SharePlatform {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  action: (url: string, title: string, description?: string) => void;
}

export const SHARE_PLATFORMS: SharePlatform[] = [
  {
    name: 'X',
    icon: XBrandIcon,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised hover:bg-surface-raised/80',
    action: (shareUrl, shareTitle, shareDescription) => {
      const text = `${shareTitle}\n\n${shareDescription}\n\n#Bitcoin #${APP_NAME}`;
      window.open(
        `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
        '_blank',
        'width=550,height=420'
      );
    },
  },
  {
    name: 'Facebook',
    icon: FacebookBrandIcon,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised/40 hover:bg-surface-raised',
    action: (shareUrl, shareTitle) => {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareTitle)}`,
        '_blank',
        'width=550,height=420'
      );
    },
  },
  {
    name: 'LinkedIn',
    icon: LinkedInBrandIcon,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised/40 hover:bg-surface-raised',
    action: (shareUrl, shareTitle, shareDescription) => {
      window.open(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}&summary=${encodeURIComponent(shareDescription || '')}`,
        '_blank',
        'width=550,height=420'
      );
    },
  },
  {
    name: 'WhatsApp',
    icon: WhatsAppBrandIcon,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised hover:bg-surface-raised/80',
    action: (shareUrl, shareTitle) => {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${shareTitle} ${shareUrl}`)}`,
        '_blank'
      );
    },
  },
  {
    name: 'Email',
    icon: Mail,
    color: 'text-fg-secondary',
    bgColor: 'bg-surface-raised hover:bg-surface-raised/80',
    action: (shareUrl, shareTitle, shareDescription) => {
      const subject = encodeURIComponent(`Check out ${shareTitle}`);
      const body = encodeURIComponent(`${shareDescription}\n\n${shareUrl}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    },
  },
];

export interface ShareContentProps {
  title: string;
  description: string;
  url: string;
  onClose?: () => void;
  className?: string;
  showTitle?: boolean;
  titleText?: string;
}

/**
 * Reusable ShareContent Component
 *
 * DRY, modular sharing UI that works for profiles, projects, and any shareable content.
 * Best practices:
 * - Single source of truth for share platforms
 * - Consistent UX across all sharing contexts
 * - Mobile-first with native share API support
 * - Accessible and responsive
 */
export default function ShareContent({
  title,
  description,
  url,
  onClose,
  className = '',
  showTitle = true,
  titleText = 'Share',
}: ShareContentProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const isMobile = useMediaQuery('(max-width: 639px)');

  // Handle native share (mobile)
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        });
        if (onClose) {
          onClose();
        }
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    }
  };

  // Handle platform-specific sharing
  const handlePlatformShare = (platform: SharePlatform) => {
    platform.action(url, title, description);
    if (onClose) {
      onClose();
    }
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      toast.success('URL copied to clipboard!');
      setTimeout(() => {
        setCopySuccess(false);
        if (onClose) {
          onClose();
        }
      }, 2000);
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  // Check if native share is available
  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  // Modern share UI - Modal on mobile, dropdown on desktop
  const shareContent = (
    <div
      className={`bg-surface-base rounded-lg shadow-sm border border-default dark:border-default/50 backdrop-blur-xl p-5 sm:p-6 w-full max-w-md mx-auto ${className}`}
      style={{
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {showTitle && (
        <div className="flex items-center justify-between mb-5 sm:mb-6 pb-4 border-b border-subtle">
          <h3 className="font-semibold text-fg-primary flex items-center gap-2 text-lg">
            <div
              className={`w-8 h-8 rounded-full ${GRADIENTS.brandOrange} flex items-center justify-center`}
            >
              <Share2 className="w-4 h-4 text-white" />
            </div>
            {titleText}
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-fg-tertiary hover:text-fg-primary transition-colors p-2 hover:bg-surface-raised rounded-full touch-manipulation min-h-11 min-w-11 flex items-center justify-center"
              aria-label="Close share menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Native Share (Mobile) - Show as primary option if available */}
      {hasNativeShare && (
        <button
          onClick={handleNativeShare}
          className={`w-full mb-5 flex items-center justify-center gap-3 p-4 rounded-lg ${GRADIENTS.btnOrange} text-white font-semibold transition-all touch-manipulation active:scale-95 shadow-sm`}
        >
          <Share2 className="w-5 h-5" />
          <span>Share via...</span>
        </button>
      )}

      {/* Social Platforms - Modern grid with icons */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 sm:gap-4 mb-5">
        {SHARE_PLATFORMS.map(platform => {
          const Icon = platform.icon;
          return (
            <button
              key={platform.name}
              onClick={() => handlePlatformShare(platform)}
              className={`group flex flex-col items-center gap-2 p-3 sm:p-4 rounded-lg transition-all touch-manipulation active:scale-95 ${platform.bgColor} hover:shadow-sm`}
              aria-label={`Share on ${platform.name}`}
            >
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${platform.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}
              >
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${platform.color}`} />
              </div>
              <span className="text-xs sm:text-sm font-medium text-fg-primary group-hover:text-fg-primary dark:group-hover:text-fg-primary">
                {platform.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Copy URL - Prominent action */}
      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-3 p-4 rounded-lg transition-all touch-manipulation active:scale-95 font-semibold ${
          copySuccess
            ? 'bg-status-positive-subtle hover:bg-status-positive-subtle/80 text-status-positive border-2 border-status-positive/20'
            : 'bg-surface-raised hover:bg-surface-raised/80 text-fg-primary border-2 border-default'
        }`}
        aria-label="Copy URL to clipboard"
      >
        {copySuccess ? (
          <>
            <Check className="w-5 h-5" />
            <span>Copied to clipboard!</span>
          </>
        ) : (
          <>
            <Copy className="w-5 h-5" />
            <span>Copy Link</span>
          </>
        )}
      </button>
    </div>
  );

  // On mobile, show as modal overlay; on desktop, show as dropdown
  if (isMobile && onClose) {
    // Mobile: Dialog modal
    return (
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Share</DialogTitle>
          {shareContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Desktop: Dropdown
  return shareContent;
}
