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
  publishDraft(title: string): CopyBlock;
  growthSkill(args: {
    skill: string;
    noun: string;
    kind: 'product' | 'service';
    wanted: boolean;
  }): CopyBlock;
  growthAsset(args: { asset: string; wanted: boolean }): CopyBlock;
  activation(args: { title: string; noun: string }): { title: string; cta: string };
  connection(name: string): { title: string; cta: string };
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
    publishDraft: title => ({
      title: `Publish your draft "${title}"`,
      body: `It's still a draft, so no one can find it yet. A couple of clicks makes it live.`,
      cta: 'Review & publish',
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
    activation: ({ title, noun }) => ({
      title: `Offer "${title}" as a ${noun}`,
      cta: `Create ${noun}`,
    }),
    connection: name => ({
      title: `You should meet ${name}`,
      cta: 'View profile',
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
    publishDraft: title => ({
      title: `Veröffentliche deinen Entwurf „${title}“`,
      body: 'Er ist noch ein Entwurf — niemand kann ihn finden. Zwei Klicks machen ihn live.',
      cta: 'Prüfen & veröffentlichen',
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
    activation: ({ title, noun }) => ({
      title: `Biete „${title}“ als ${noun} an`,
      cta: `${noun} erstellen`,
    }),
    connection: name => ({
      title: `Du solltest ${name} kennenlernen`,
      cta: 'Profil ansehen',
    }),
  },
};
