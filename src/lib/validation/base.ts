import { z } from 'zod';
import DOMPurify from 'dompurify';
import { validatePhoneNumber, normalizePhoneNumber } from '../phone-validation';
import { CURRENCY_CODES } from '@/config/currencies';
import {
  MAKER_STATUS_VALUES,
  HELP_WANTED_VALUES,
  MAX_HELP_WANTED_SELECTIONS,
} from '@/config/maker-status';

/**
 * Lightning Address Validation
 *
 * Lightning addresses follow the format: username@domain.tld
 * They are NOT emails but use a similar format for LNURL-pay.
 *
 * Valid examples:
 * - satoshi@walletofsatoshi.com
 * - user@getalby.com
 * - myname@ln.tips
 * - test_user@strike.me
 *
 * Rules:
 * - Username: alphanumeric, underscore, hyphen, dot (no leading/trailing dots)
 * - Domain: valid domain format with at least one dot
 * - Case-insensitive
 */
const LIGHTNING_ADDRESS_REGEX =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]?@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;

/**
 * Validates a Lightning address format
 * @param address - The Lightning address to validate
 * @returns true if valid, false otherwise
 */
export function isValidLightningAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  // Lightning addresses are case-insensitive
  return LIGHTNING_ADDRESS_REGEX.test(address.toLowerCase());
}

// =============================================================================
// GENERAL VALIDATORS
// =============================================================================

const BITCOIN_ADDRESS_PATTERNS = {
  legacy: /^1[A-HJ-NP-Z0-9]{25,34}$/,
  segwit: /^3[A-HJ-NP-Z0-9]{25,34}$/,
  bech32: /^bc1[a-z0-9]{8,87}$/,
  testnetLegacy: /^[mn][A-HJ-NP-Z0-9]{25,34}$/,
  testnetSegwit: /^2[A-HJ-NP-Z0-9]{25,34}$/,
  testnetBech32: /^tb1[a-z0-9]{8,87}$/,
};

const LIGHTNING_INVOICE_PATTERN = /^ln(bc|tb|tbs|bcrt)[0-9]+[munp]?[a-z0-9]+$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return UUID_PATTERN.test(value.trim());
}

export function isValidBitcoinAddress(address: string, allowTestnet: boolean = false): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  const trimmed = address.trim();
  if (allowTestnet) {
    return (
      BITCOIN_ADDRESS_PATTERNS.legacy.test(trimmed) ||
      BITCOIN_ADDRESS_PATTERNS.segwit.test(trimmed) ||
      BITCOIN_ADDRESS_PATTERNS.bech32.test(trimmed) ||
      BITCOIN_ADDRESS_PATTERNS.testnetLegacy.test(trimmed) ||
      BITCOIN_ADDRESS_PATTERNS.testnetSegwit.test(trimmed) ||
      BITCOIN_ADDRESS_PATTERNS.testnetBech32.test(trimmed)
    );
  }
  return (
    BITCOIN_ADDRESS_PATTERNS.legacy.test(trimmed) ||
    BITCOIN_ADDRESS_PATTERNS.segwit.test(trimmed) ||
    BITCOIN_ADDRESS_PATTERNS.bech32.test(trimmed)
  );
}

export function isValidLightningInvoice(invoice: string): boolean {
  if (!invoice || typeof invoice !== 'string') {
    return false;
  }
  return LIGHTNING_INVOICE_PATTERN.test(invoice.trim());
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_PATTERN.test(email.trim());
}

export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== 'string') {
    return false;
  }
  return USERNAME_PATTERN.test(username.trim());
}

// =============================================================================
// REUSABLE FIELD HELPERS
// =============================================================================

/**
 * Optional text field that accepts empty strings from form submissions.
 * Replaces the repeated `.optional().nullable().or(z.literal(''))` pattern.
 */
export const optionalText = (maxLen?: number) => {
  const base = maxLen ? z.string().max(maxLen) : z.string();
  return base.optional().nullable().or(z.literal(''));
};

/** Optional URL field that accepts empty strings */
export const optionalUrl = () => z.string().url().optional().nullable().or(z.literal(''));

/**
 * Zod schema for Lightning address validation
 * Use this in any schema that accepts Lightning addresses
 */
export const lightningAddressSchema = z
  .string()
  .max(200, 'Lightning address is too long')
  .refine(
    val => !val || val.trim() === '' || isValidLightningAddress(val),
    'Please enter a valid Lightning address (format: username@domain.com)'
  )
  .optional()
  .nullable()
  .or(z.literal(''));

// Profile validation
// Note: Server-side normalizes empty strings to undefined before validation
// Username is optional (can be set during registration/profile update)
export const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ), // Required field - no optional/nullable
  name: optionalText(100),
  bio: optionalText(500),
  // Structured location fields for better search functionality
  location_country: z
    .string()
    .max(2)
    .optional()
    .nullable()
    .refine(val => !val || val.length === 2, {
      message: 'Country code must be 2 characters (ISO 3166-1 alpha-2)',
    })
    .or(z.literal('')),
  location_city: optionalText(100),
  location_zip: optionalText(20),
  location_search: optionalText(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  // Extended transparency fields
  background: optionalText(1000),
  inspiration_statement: optionalText(500),
  location_context: optionalText(300),
  // Legacy location field (deprecated but kept for backward compatibility)
  location: optionalText(100),
  avatar_url: optionalUrl(),
  banner_url: optionalUrl(),
  website: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .or(z.literal(''))
    .refine(
      val =>
        !val ||
        val.trim() === '' ||
        /^https?:\/\/.+/i.test(val) ||
        /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/.test(val),
      'Please enter a valid website (e.g., orangecat.ch or https://orangecat.ch)'
    ),
  // Social & Contact
  social_links: z
    .object({
      links: z.array(
        z.object({
          platform: z.string().max(50),
          label: z.string().max(100).optional().nullable(),
          value: z.string().min(1, 'Value is required').max(500),
        })
      ),
    })
    .optional()
    .nullable(),
  contact_email: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .refine(
      val => !val || val.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      'Please enter a valid email address'
    ),
  phone: z
    .string()
    .max(20)
    .optional()
    .nullable()
    .or(z.literal(''))
    .refine(
      val => {
        if (!val || val.trim() === '') {
          return true;
        }
        const result = validatePhoneNumber(val);
        return result.valid;
      },
      val => {
        const result = validatePhoneNumber(val || '');
        return { message: result.error || 'Invalid phone number format' };
      }
    ),
  // Wallet fields (kept for backward compatibility, but wallets are now managed separately)
  // IMPORTANT: Validation is intentionally lenient to avoid blocking profile saves
  // when legacy data contains non-standard test values.
  bitcoin_address: optionalText(200),
  lightning_address: optionalText(200),
  // Currency preference for displaying prices
  currency: z.enum(CURRENCY_CODES).optional().nullable(),
  // Maker profile hardening: current status of their work + concrete ways
  // others can help. Value lists are the SSOT in @/config/maker-status.
  current_status: z.enum(MAKER_STATUS_VALUES).optional().nullable().or(z.literal('')),
  help_wanted: z
    .array(z.enum(HELP_WANTED_VALUES))
    .max(MAX_HELP_WANTED_SELECTIONS, `Select up to ${MAX_HELP_WANTED_SELECTIONS} options`)
    .optional()
    .nullable(),
});

// HTML sanitization for rich text content
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side: basic HTML tag removal for security
    return html.replace(/<[^>]*>/g, '');
  }

  // Client-side: use DOMPurify for comprehensive sanitization
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
    ],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  });
}

// Helper function to normalize profile data
export function normalizeProfileData(data: unknown): ProfileData {
  const normalized = { ...(data as Record<string, unknown>) } as Record<string, unknown>;

  // If name is empty or not provided, use username
  if (!normalized.name || (typeof normalized.name === 'string' && normalized.name.trim() === '')) {
    normalized.name = normalized.username;
  }

  // Auto-add https:// to website if protocol is missing
  if (normalized.website && typeof normalized.website === 'string') {
    const website = normalized.website.trim();
    if (website && !website.match(/^https?:\/\//i)) {
      // Only add https:// if it looks like a domain (has a dot)
      if (website.includes('.')) {
        normalized.website = `https://${website}`;
      }
    }
  }

  // Normalize phone number to E.164 format
  if (normalized.phone && typeof normalized.phone === 'string') {
    const normalizedPhone = normalizePhoneNumber(normalized.phone);
    if (normalizedPhone) {
      normalized.phone = normalizedPhone;
    }
  }

  // Normalize country code to uppercase if provided
  if (normalized.location_country && typeof normalized.location_country === 'string') {
    normalized.location_country = normalized.location_country.trim().toUpperCase();
  }

  // Trim and clean location fields
  if (normalized.location_city && typeof normalized.location_city === 'string') {
    normalized.location_city = normalized.location_city.trim();
  }

  if (normalized.location_zip && typeof normalized.location_zip === 'string') {
    normalized.location_zip = normalized.location_zip.trim();
  }

  // Normalize contact_email:
  // - If user explicitly provides a public contact email, store it in the
  //   profile.email column which is used as the public-facing email.
  // - If contact_email is empty, keep existing email unchanged.
  if (normalized.contact_email && typeof normalized.contact_email === 'string') {
    normalized.email = normalized.contact_email;
  }

  // Normalize social_links: ensure structure is { links: [...] }
  if (normalized.social_links) {
    if (Array.isArray(normalized.social_links)) {
      // If it's an array, wrap it
      normalized.social_links = { links: normalized.social_links };
    } else if (typeof normalized.social_links === 'object' && normalized.social_links !== null) {
      const socialLinks = normalized.social_links as Record<string, unknown>;
      if (!socialLinks.links) {
        // If it's an object but not the right structure, try to convert
        normalized.social_links = { links: [] };
      }
    }
    // Filter out empty links
    if (typeof normalized.social_links === 'object' && normalized.social_links !== null) {
      const socialLinks = normalized.social_links as { links?: Array<{ value?: string }> };
      if (socialLinks.links) {
        socialLinks.links = socialLinks.links.filter(
          (link: { value?: string }) => link && link.value && link.value.trim()
        );
        // If no links, set to undefined
        if (socialLinks.links.length === 0) {
          normalized.social_links = undefined;
        }
      }
    }
  }

  // Normalize empty strings to undefined for optional fields
  Object.keys(normalized).forEach(key => {
    const value = normalized[key];
    if (typeof value === 'string' && value.trim() === '') {
      normalized[key] = undefined;
    }
  });

  return normalized as unknown as ProfileData;
}

// Types
export type ProfileData = z.infer<typeof profileSchema>;
