/**
 * App shell layout SSOT
 *
 * Header offset and full-height content regions must derive from here.
 * AppShell uses pt-14 / sm:pt-16 — keep those values in sync with this file.
 *
 * created_date: 2026-06-03
 * last_modified_date: 2026-06-03
 * last_modified_summary: Extracted header height tokens used by Cat chat and messaging surfaces
 */

/** Mobile app header height (matches AppShell `pt-14`) */
export const APP_HEADER_HEIGHT_MOBILE = '3.5rem' as const;

/** Desktop app header height (matches AppShell `sm:pt-16`) */
export const APP_HEADER_HEIGHT_DESKTOP = '4rem' as const;

/**
 * Class for a column that fills the viewport below the fixed header.
 * Use on chat-style surfaces (Cat, messages, ai-chat).
 *
 * This is a REAL CSS utility defined in globals.css (.app-content-height), NOT a
 * Tailwind arbitrary value. Tailwind's content scanner doesn't extract class
 * strings referenced only from this .ts const, so an `h-[calc(...)]` here never
 * generated a rule — the height silently didn't apply and chat surfaces collapsed
 * to content height (composer floated, whole page scrolled). The globals.css
 * utility is always present and handles the responsive header offset (56/64px).
 */
export const APP_CONTENT_HEIGHT_CLASS = 'app-content-height' as const;

/** Max width for chat message columns (ChatGPT-style readable measure) */
export const CHAT_CONTENT_MAX_WIDTH_CLASS = 'max-w-3xl' as const;

/**
 * Marks an open conversation that owns the phone screen on a page that is not
 * always a chat (the talk home with `?with=`). globals.css hides the app
 * header below md while it is on the page; see "A chat that owns the phone".
 */
export const IMMERSIVE_CHAT_ATTR = 'data-immersive-chat' as const;
