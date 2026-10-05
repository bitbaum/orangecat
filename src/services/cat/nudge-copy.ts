/**
 * Nudge copy SSOT — every user-facing nudge string, per language.
 *
 * One language per user: the language is resolved ONCE from the user's profile
 * (profile.language, and nothing else) and every nudge — deterministic
 * templates AND LLM-written reasons — uses it. Mixed English/German cards on
 * one dashboard were a founder-verified trust bug.
 */

import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';

export type NudgeLanguage = 'en' | 'de';

/**
 * Resolve the ONE language all nudges for this user are written in.
 *
 * `profile.language` — an explicit choice — is the only input. Currency is NOT
 * a language signal, and reading it as one is why a founder with an English
 * interface got a dashboard of German nudge cards: CHF is this platform's
 * DEFAULT fiat (see config/currencies), so "prefers CHF" is what every account
 * that never chose anything looks like. A default is not a preference. And
 * Switzerland has four national languages, so even a deliberate CHF would not
 * imply German.
 *
 * It is the same category error `@/utils/locale` was written to end one layer
 * down — there it was "the language of the interface is not the language of
 * your operating system"; here it is "…is not the currency you get paid in".
 *
 * Note the practical consequence: no surface in this app writes
 * `profile.language` (the sole write is a mapper default of 'en'), and the
 * interface ships `<html lang="en">` with no translations. So 'de' is
 * currently unreachable, and NUDGE_COPY.de waits for real i18n rather than
 * being selected by a heuristic nobody opted into. That is deliberate — German
 * nudge cards inside an English interface are the mixed-language dashboard
 * this file's header calls a trust bug, just at a larger grain.
 */
export function resolveNudgeLanguage(
  // `currency` stays in the accepted shape because callers pass a whole
  // profile — and because a regression test has to be able to hand this
  // function the exact CHF-shaped profile that used to come back German.
  profile: { language?: string | null; currency?: string | null } | null | undefined
): NudgeLanguage {
  const lang = (profile?.language ?? '').toLowerCase();
  return lang.startsWith('de') ? 'de' : 'en';
}

interface CopyBlock {
  title: string;
  body: string;
  cta: string;
}

export interface NudgeCopy {
  /** Human name for the LLM instruction ("write in <languageName>"). */
  languageName: string;
  /** Localized entity noun (falls back to the registry display name). */
  entityNoun(type: EntityType): string;
  completionBio: CopyBlock;
  /** `others`: how many more drafts have sat as long — said once, not as more cards. */
  publishDraft(title: string, others: number): CopyBlock;
  /** People searched for what this listing offers. Good news, so it ranks first. */
  demandMatch(args: { query: string; count: number; title: string; noun: string }): CopyBlock;
  growthSkill(args: {
    skill: string;
    noun: string;
    kind: 'product' | 'service';
    wanted: boolean;
  }): CopyBlock;
  growthAsset(args: { asset: string; wanted: boolean }): CopyBlock;
  /** A paid deal the person has not reviewed yet. `others`: more open ones, counted once. */
  reviewDeal(args: { who: string | null; title: string; others: number }): CopyBlock;
}

const NOUN_DE: Partial<Record<EntityType, string>> = {
  service: 'Dienstleistung',
  product: 'Produkt',
  project: 'Projekt',
  cause: 'Cause',
  event: 'Event',
  wishlist: 'Wunschliste',
  asset: 'Asset',
};

export const NUDGE_COPY: Record<NudgeLanguage, NudgeCopy> = {
  en: {
    languageName: 'English',
    entityNoun: type => ENTITY_REGISTRY[type].name.toLowerCase(),
    completionBio: {
      title: 'Add a bio so people — and the Cat — can find you',
      body: 'A few lines about what you do lets the Cat match you to the right people, work, and opportunities.',
      cta: 'Add your bio',
    },
    publishDraft: (title, others) => ({
      title: `"${title}" has waited a few days as a draft`,
      body:
        others > 0
          ? `Nobody can find a draft, and you have ${others} more like it. Publishing takes a couple of clicks — or ask your Cat to tidy them up.`
          : `Nobody can find it while it's a draft. Publishing takes a couple of clicks.`,
      cta: others > 0 ? 'Review your drafts' : 'Review & publish',
    }),
    reviewDeal: ({ who, title, others }) => ({
      title: who ? `How did "${title}" go with ${who}?` : `How did "${title}" go?`,
      body:
        others > 0
          ? `Your answer helps the next person decide, and ${others} more of your deals are waiting for one. Reviews stay hidden until both sides have written.`
          : 'Your answer helps the next person decide. It stays hidden until both of you have written.',
      cta: others > 0 || !who ? 'Review your deals' : `Review ${who}`,
    }),
    demandMatch: ({ query, count, title, noun }) => ({
      title: `People are looking for what you offer`,
      body: `"${query}" was searched ${count} times in the last two weeks, and your ${noun} "${title}" matches. Sharing its link puts it in front of them.`,
      cta: `Open "${title}"`,
    }),
    growthSkill: ({ skill, noun, kind, wanted }) => ({
      title: `Turn "${skill}" into a ${noun}`,
      body: wanted
        ? `People on OrangeCat are already asking for ${skill} — and you have it, but it isn't listed yet. Drafting it takes one tap.`
        : kind === 'product'
          ? `You make ${skill}, but it isn't listed yet — people here can only buy what they can see. Drafting it takes one tap.`
          : `You can do ${skill}, but it isn't listed yet — people here can only hire you for what they can see. Drafting it takes one tap.`,
      cta: `Draft a ${skill} ${noun}`,
    }),
    growthAsset: ({ asset, wanted }) => ({
      title: `Put your ${asset} to work`,
      body: wanted
        ? `People here are looking for things like ${asset} — and yours mostly sits idle. Listed as an asset, it can earn.`
        : `Your ${asset} mostly sits idle. Listed as an asset, it can earn while you're not using it.`,
      cta: `List your ${asset}`,
    }),
  },
  de: {
    languageName: 'German (Deutsch)',
    entityNoun: type => NOUN_DE[type] ?? ENTITY_REGISTRY[type].name,
    completionBio: {
      title: 'Füge eine Bio hinzu, damit Menschen — und die Cat — dich finden',
      body: 'Ein paar Zeilen darüber, was du machst, lassen die Cat dich mit den richtigen Menschen, Aufträgen und Chancen zusammenbringen.',
      cta: 'Bio hinzufügen',
    },
    publishDraft: (title, others) => ({
      title: `„${title}“ wartet seit ein paar Tagen als Entwurf`,
      body:
        others > 0
          ? `Einen Entwurf findet niemand, und du hast noch ${others} weitere. Veröffentlichen sind zwei Klicks — oder bitte deine Cat, sie aufzuräumen.`
          : 'Solange er ein Entwurf ist, findet ihn niemand. Veröffentlichen sind zwei Klicks.',
      cta: others > 0 ? 'Entwürfe ansehen' : 'Prüfen & veröffentlichen',
    }),
    reviewDeal: ({ who, title, others }) => ({
      title: who ? `Wie lief „${title}“ mit ${who}?` : `Wie lief „${title}“?`,
      body:
        others > 0
          ? `Deine Antwort hilft der nächsten Person bei der Entscheidung, und ${others} weitere deiner Deals warten noch darauf. Bewertungen bleiben verborgen, bis beide Seiten geschrieben haben.`
          : 'Deine Antwort hilft der nächsten Person bei der Entscheidung. Sie bleibt verborgen, bis ihr beide geschrieben habt.',
      cta: others > 0 || !who ? 'Deals bewerten' : `${who} bewerten`,
    }),
    demandMatch: ({ query, count, title, noun }) => ({
      title: 'Jemand sucht, was du anbietest',
      body: `„${query}“ wurde in den letzten zwei Wochen ${count}-mal gesucht, und dein Angebot „${title}“ (${noun}) passt. Teile den Link, damit sie es finden.`,
      cta: `„${title}“ öffnen`,
    }),
    growthSkill: ({ skill, noun, kind, wanted }) => ({
      title: `Biete „${skill}“ als ${noun} an`,
      body: wanted
        ? `Auf OrangeCat wird ${skill} bereits gesucht — du kannst es, aber es ist noch nicht gelistet. Ein Entwurf ist einen Tipp entfernt.`
        : kind === 'product'
          ? `Du machst ${skill}, aber es ist noch nicht gelistet — hier kann man nur kaufen, was sichtbar ist. Ein Entwurf ist einen Tipp entfernt.`
          : `Du kannst ${skill}, aber es ist noch nicht gelistet — man kann dich nur für das buchen, was sichtbar ist. Ein Entwurf ist einen Tipp entfernt.`,
      cta: `Entwurf anlegen: ${skill}`,
    }),
    growthAsset: ({ asset, wanted }) => ({
      title: `Lass „${asset}“ für dich arbeiten`,
      body: wanted
        ? `Genau so etwas wie ${asset} wird hier gesucht — und deins liegt meist ungenutzt. Als Asset gelistet kann es verdienen.`
        : `Dein ${asset} liegt meist ungenutzt. Als Asset gelistet kann es verdienen, während du es nicht brauchst.`,
      cta: `„${asset}“ listen`,
    }),
  },
};
