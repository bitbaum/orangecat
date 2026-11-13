import type { ComponentType } from 'react';
import { Mail } from 'lucide-react';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import { APP_NAME } from '@/config/brand';
import { shareIntentUrl } from '@/config/share';
import { xPostText } from '@/lib/og/share-line';

// Real brand marks. lucide-react dropped brand icons in 0.400+ and the
// replacement here was `const Facebook = Globe; const Linkedin = Globe;` — two
// buttons rendering the SAME generic globe, plus lucide's multiply glyph
// standing in for X inside a panel whose close button is also a multiply glyph.
// See BrandIcons.tsx for why these are inline SVG rather than a dependency.
import { XBrandIcon, FacebookBrandIcon, LinkedInBrandIcon, WhatsAppBrandIcon } from './BrandIcons';

export interface SharePlatform {
  name: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  action: (url: string, title: string, description?: string) => void;
}

export const SHARE_PLATFORMS: SharePlatform[] = [
  // Our own network first. A share panel on an OrangeCat page that offered X,
  // Facebook and LinkedIn and not OrangeCat was the platform forgetting it is
  // one (operator, 2026-10-10). Same door Loki's Thoughts and every fleet site
  // use: /share?url&title opens the composer prefilled.
  {
    name: APP_NAME,
    icon: BrandMarkIcon,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised hover:bg-surface-raised/80',
    action: (shareUrl, shareTitle) => {
      window.location.href = shareIntentUrl(window.location.origin, {
        url: shareUrl,
        title: shareTitle,
      });
    },
  },
  {
    name: 'X',
    icon: XBrandIcon,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised hover:bg-surface-raised/80',
    action: (shareUrl, shareTitle, shareDescription) => {
      const text = xPostText(shareTitle, shareDescription ?? null, `#Bitcoin #${APP_NAME}`);
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
