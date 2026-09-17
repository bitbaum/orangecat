import { z } from 'zod';
import DOMPurify from 'dompurify';
import { validatePhoneNumber, normalizePhoneNumber } from '../phone-validation';
import { CURRENCY_CODES } from '@/config/currencies';
import { profilePrivacySettingsSchema } from '@/config/profile-privacy';
import {
  MAKER_STATUS_VALUES,
  HELP_WANTED_VALUES,
  MAX_HELP_WANTED_SELECTIONS,
} from '@/config/maker-status';
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_PATTERN,
  USERNAME_RULE_MESSAGE,
  reservedReason,
} from '@/config/usernames';
import { apiErrorMessage } from '@/lib/api/errorMessage';

/**
 * The one username schema. Registration and profile-edit both use it, so a name
 * you cannot sign up with is not a name you can switch to later — which is
 * exactly what the two divergent copies of these rules used to allow (register
 * capped at 20 characters, profile edit at 30).
 *
 * The reserved check lives here rather than in a route so that every path which
 * validates a username gets it, including ones written later.
 */
export const usernameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters`)
  .max(USERNAME_MAX_LENGTH, `Username must be at most ${USERNAME_MAX_LENGTH} characters`)
  .regex(USERNAME_PATTERN, USERNAME_RULE_MESSAGE)
  .refine(value => reservedReason(value) === null, {
    error: issue => {
      const value = String(issue.input ?? '');
      return `"${value}" is reserved — ${reservedReason(value) ?? 'not available'}`;
    },
  });

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

// NOTE: there is deliberately NO Bitcoin address/xpub validator here. Address
// validation is cryptographic (checksums, network bytes) and lives in ONE
// place: src/types/wallet.ts. A regex approximation that accepts typo'd
// addresses is worse than none.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return UUID_PATTERN.test(value.trim());
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_PATTERN.test(email.trim());
}

export { isValidUsername } from '@/config/usernames';

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

/**
 * A URL we are willing to put in an `href` or `src`.
 *
 * `z.string().url()` is NOT that: it delegates to `new URL()`, which happily
 * accepts `javascript:` and `data:`. Any such value rendered into an anchor is
 * stored XSS — the victim only has to click a link the attacker labelled, and
 * `target="_blank" rel="noopener noreferrer"` does nothing to stop it.
 *
 * So scheme is part of validity here, not a separate concern: http(s) only.
 * Use this for EVERY user-supplied URL. `eslint no-restricted-syntax` fails the
 * build on a bare `z.string().url()` so the unsafe form cannot come back.
 */
export const webUrl = ({ message, max }: { message?: string; max?: number } = {}) => {
  // Always trim: browsers strip leading whitespace and control characters
  // before parsing a scheme, so " \n javascript:…" is live in an href. Trimming
  // here means the stored value is the same string the browser will act on.
  // `max` is applied BEFORE .refine(), because refine returns a ZodEffects that
  // no longer exposes .max() to the caller.
  const base = max ? z.string().trim().max(max) : z.string().trim();
  return (
    base
      // Reached through `base` rather than chained off z.string() directly: this
      // is the one place allowed to call .url(), and the indirection is what
      // keeps the no-restricted-syntax ban from flagging its own implementation.
      .url(message)
      .refine(
        value => /^https?:\/\//i.test(value),
        message ?? 'Must be an http:// or https:// address'
      )
  );
};

/** Optional URL field that accepts empty strings */
export const optionalUrl = () => webUrl().optional().nullable().or(z.literal(''));

/**
 * Coerce a coordinate value (latitude/longitude) to a number, or null when it
 * is empty/blank/NaN. The location UI registers these as hidden text inputs, so
 * an unset coordinate arrives as the string "" (or a numeric string once set).
 * Used by `normalizeProfileData` to guarantee "" never reaches the numeric DB
 * column, and available for the input layer to coerce at the source.
 */
export const coerceCoordinate = (val: unknown): number | null => {
  if (val === '' || val === null || val === undefined) {
    return null;
  }
  if (typeof val === 'number') {
    return Number.isNaN(val) ? null : val;
  }
  if (typeof val === 'string') {
    const n = Number(val.trim());
    return val.trim() === '' || Number.isNaN(n) ? null : n;
  }
  return null;
};

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
  username: usernameSchema, // Required field - no optional/nullable
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
      {
        error: issue => {
          const result = validatePhoneNumber(String(issue.input ?? ''));
          return apiErrorMessage(result, 'Invalid phone number format');
        },
      }
    ),
  // Wallet fields (kept for backward compatibility, but wallets are now managed separately)
  // IMPORTANT: Validation is intentionally lenient to avoid blocking profile saves
  // when legacy data contains non-standard test values.
  bitcoin_address: optionalText(200),
  lightning_address: optionalText(200),
  // Currency preference for displaying prices
  currency: z.enum(CURRENCY_CODES).optional().nullable(),
  // Per-field visibility (which public fields the owner hides from visitors).
  // Stored in the profiles.privacy_settings jsonb column. Included here so it
  // survives both the client zodResolver and this server-side parse — a field
  // absent from the schema is silently stripped. See config/profile-privacy.ts.
  privacy_settings: profilePrivacySettingsSchema,
  // Maker profile hardening: current status of their work + concrete ways
  // others can help. Value lists are the SSOT in @/config/maker-status.
  current_status: z.enum(MAKER_STATUS_VALUES).optional().nullable().or(z.literal('')),
  help_wanted: z
    .array(z.enum(HELP_WANTED_VALUES))
    .max(MAX_HELP_WANTED_SELECTIONS, `Select up to ${MAX_HELP_WANTED_SELECTIONS} options`)
    .optional()
    .nullable(),
});

/**
 * The columns a profile PUT may write — derived from the schema so the two
 * can never drift. A hand-written copy of this list in the API route silently
 * dropped 'currency', 'background', and 'inspiration_statement' for months:
 * saves succeeded while those fields vanished. Server-managed columns
 * (id, email, created_at, updated_at) are not in the schema, so they can
 * never be written through this path.
 */
export const PROFILE_UPDATABLE_FIELDS: readonly string[] = Object.keys(profileSchema.shape);

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

  // Coordinates arrive as "" from the hidden lat/long inputs when unset — map
  // that (and any blank/NaN/numeric-string) to a number or null so it never
  // reaches the numeric DB column as "". Defends the server path; the input
  // layer (ProfileLocationSection) also coerces so the client resolver, which
  // validates raw form values against z.number(), never sees "".
  if ('latitude' in normalized) {
    normalized.latitude = coerceCoordinate(normalized.latitude);
  }
  if ('longitude' in normalized) {
    normalized.longitude = coerceCoordinate(normalized.longitude);
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
