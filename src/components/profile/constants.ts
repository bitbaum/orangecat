/**
 * Profile Editor Constants
 *
 * Constants and default values for ModernProfileEditor.
 *
 * Created: 2025-01-30
 * Last Modified: 2026-01-05
 * Last Modified Summary: Added PREFERENCES section for currency settings
 */

export const MAX_SOCIAL_LINKS = 15;

export const PROFILE_SECTIONS = {
  PROFILE: 'Profile',
  STATUS: 'Status & How to Help',
  ONLINE_PRESENCE: 'Online Presence',
  CONTACT: 'Contact Information',
  PREFERENCES: 'Preferences',
} as const;

export const PROFILE_SECTION_DESCRIPTIONS = {
  PROFILE: 'Your basic profile information – username, name, bio and location.',
  STATUS: 'What stage your work is at, and concrete ways others can help.',
  ONLINE_PRESENCE: 'Your website and social media – where people can find you online.',
  CONTACT: 'How people can reach you directly.',
  PREFERENCES: 'Your display preferences – currency and other settings.',
} as const;
