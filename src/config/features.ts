/**
 * Product feature flags — SSOT for env-gated UI behavior.
 *
 * Read flags from here instead of scattering `process.env.NEXT_PUBLIC_*`
 * checks across components.
 */

/**
 * Next.js only inlines NEXT_PUBLIC_* vars into the client bundle when they are
 * read as static literals (`process.env.NEXT_PUBLIC_X`). Dynamic access like
 * `process.env[name]` compiles to `undefined` in the browser, silently forcing
 * every flag off client-side regardless of the build env. Keep each read static.
 */
function envFlag(value: string | undefined): boolean {
  return value === 'true';
}

export const FEATURES = {
  /** Voice input on create forms and onboarding (requires browser speech APIs). */
  voiceInput: envFlag(process.env.NEXT_PUBLIC_FEATURE_VOICE_INPUT),
  /**
   * Cat Credits Lightning top-up is live. Set alongside the server-side
   * PLATFORM_NWC_URI (the receiving wallet) once one live top-up is verified —
   * this flag only flips the UI from "Activating" to a live top-up CTA; the
   * server still independently refuses top-up when PLATFORM_NWC_URI is unset.
   */
  catCreditsLive: envFlag(process.env.NEXT_PUBLIC_CAT_CREDITS_LIVE),
  /**
   * OrangeCat is able to CHARGE — see config/commerce.ts, which is where this
   * should be read from. Off unless explicitly set, because the expensive
   * direction of this mistake is taking money we are not yet allowed to take.
   */
  paidPlansOpen: envFlag(process.env.NEXT_PUBLIC_PAID_PLANS_OPEN),
} as const;
