/**
 * The fleet's own bots in the companions' room — SSOT.
 *
 * Diplodoctor reads a medical report with you; Causius does legal work on a
 * case file. Each lives in its own product and its own repository, with its
 * own rules about what it may say. The room does not copy any of that: it
 * ASKS the product, over the one contract the fleet's bots share —
 *
 *   POST <live url>/api/ask
 *   { messages: [{ role: "user" | "assistant", content }], locale }
 *   → { text, replies?: string[] }
 *
 * What each product IS (its name, its one-line "what", where it runs) is not
 * typed here either: it comes from the fleet map Loki publishes
 * (`studio-map-fetcher.ts`), so a rename or a move in Loki reaches this rail
 * without a commit here. This file holds only the behaviour the room needs
 * to know: which products answer at that path, and in which languages.
 *
 * To seat another product's bot here: give it `/api/ask` with that shape and
 * add its Loki slug below. Nothing else.
 */

/**
 * The path on the PRODUCT, in two parts: OrangeCat's own route audit reads a
 * literal "/api/…" string as one of OrangeCat's routes, and this one is not.
 */
export const FLEET_BOT_ASK_ROUTE = { base: 'api', name: 'ask' } as const;

/** Where a product answers: its live url plus the contract's path. */
export function fleetBotAskUrl(liveUrl: string): string {
  return `${liveUrl.replace(/\/+$/, '')}/${FLEET_BOT_ASK_ROUTE.base}/${FLEET_BOT_ASK_ROUTE.name}`;
}

/** How long a product may take to answer one line. */
export const FLEET_BOT_TIMEOUT_MS = 60_000;

export interface FleetBotContract {
  /** Languages the product's `/api/ask` accepts; the room asks in the first it shares with the app. */
  locales: readonly string[];
}

export const FLEET_BOTS: Readonly<Record<string, FleetBotContract>> = {
  diplodoctor: { locales: ['en', 'de', 'fr', 'it', 'es'] },
  causius: { locales: ['en', 'de', 'fr', 'it'] },
};

/** The locale the room asks in: the app is English. */
export const FLEET_BOT_LOCALE = 'en';

/**
 * What one request to `/api/ask` may carry, as the products' own schemas cap
 * it (diplodoctor `lib/ask.ts`, causius `lib/ask.ts`): twenty turns of up to
 * 4,000 characters, and an attached file as `context` of up to 20,000. A
 * longer line is cut here rather than refused there.
 */
export const FLEET_BOT_ASK_CAPS = {
  turns: 20,
  messageChars: 4_000,
  contextChars: 20_000,
  /** `scene`: the setting the question is asked in (a group chat's roster and rules). */
  sceneChars: 1_000,
} as const;

/**
 * A product's own mark: Next.js serves `app/icon.svg` at this path, and every
 * product in the contract ships one. The fleet's agents wear their own face
 * here, never one made up for them.
 */
export const FLEET_BOT_MARK_PATH = '/icon.svg';

export function fleetBotMarkUrl(liveUrl: string): string {
  return `${liveUrl.replace(/\/+$/, '')}${FLEET_BOT_MARK_PATH}`;
}

export function isFleetBotSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(FLEET_BOTS, slug);
}
