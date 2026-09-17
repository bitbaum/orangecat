import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { SocialPlatformId } from './social-platforms';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes social media URLs for proper display and linking
 *
 * Converts handles/usernames to full URLs for platforms that support it
 * For example: "catomean" on X platform becomes "https://x.com/catomean"
 */
export function normalizeSocialUrl(platform: SocialPlatformId, value: string): string {
  // If it's already a full URL, return as-is
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  // Platform-specific URL building
  switch (platform) {
    case 'x':
      // X (Twitter) - convert @username or username to full URL
      const handle = value.startsWith('@') ? value.substring(1) : value;
      return `https://x.com/${handle}`;

    case 'instagram':
      // Instagram - convert @username or username to full URL
      const igHandle = value.startsWith('@') ? value.substring(1) : value;
      return `https://instagram.com/${igHandle}`;

    case 'facebook':
      // Facebook - if it's just a username, convert to profile URL
      if (!value.includes('/') && !value.includes('facebook.com')) {
        return `https://facebook.com/${value}`;
      }
      return value.startsWith('facebook.com') ? `https://${value}` : value;

    case 'linkedin':
      // LinkedIn - if it's not already a full URL, assume it's a profile path
      if (!value.includes('linkedin.com')) {
        return `https://linkedin.com/in/${value}`;
      }
      return value.startsWith('linkedin.com') ? `https://${value}` : value;

    case 'github':
      // GitHub - convert username to full URL
      if (!value.includes('github.com') && !value.includes('/')) {
        return `https://github.com/${value}`;
      }
      return value.startsWith('github.com') ? `https://${value}` : value;

    case 'youtube':
      // YouTube - handle various formats
      if (value.startsWith('@')) {
        return `https://youtube.com/@${value.substring(1)}`;
      }
      if (!value.includes('youtube.com') && !value.includes('youtu.be')) {
        // Assume it's a channel name or handle
        return `https://youtube.com/@${value}`;
      }
      return value;

    case 'patreon':
      // Patreon - convert username to full URL
      if (!value.includes('patreon.com')) {
        return `https://patreon.com/${value}`;
      }
      return value.startsWith('patreon.com') ? `https://${value}` : value;

    case 'nostr':
      // Nostr - if it's an npub key, might need special handling
      // For now, if it's not a URL, treat as profile URL
      if (value.startsWith('npub1')) {
        // Could potentially resolve npub to URL, but for now return as-is or handle specially
        return value; // Nostr clients handle npub resolution
      }
      if (!value.startsWith('http')) {
        return `https://${value}`;
      }
      return value;

    case 'telegram':
      // Telegram - convert @username to full URL
      const tgHandle = value.startsWith('@') ? value.substring(1) : value;
      return `https://t.me/${tgHandle}`;

    case 'custom':
      // Custom links - ensure they have protocol
      if (!value.startsWith('http')) {
        return `https://${value}`;
      }
      return value;

    default:
      // For unknown platforms, ensure they have a protocol
      if (!value.startsWith('http')) {
        return `https://${value}`;
      }
      return value;
  }
}
