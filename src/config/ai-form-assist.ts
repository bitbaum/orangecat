/**
 * AI FORM ASSIST — CONFIG SSOT
 *
 * Everything the AI form filler shows or says that is *not* generic prompt
 * plumbing lives here:
 *
 * - `AI_ADJUSTMENTS`  — the catalog of one-click refinements ("make the
 *   description longer", "add a German version", …). Each entry declares which
 *   fields it applies to, so a form only ever offers adjustments that make
 *   sense for the fields it actually has.
 * - `AI_FILL_EXAMPLES` — the "Try:" starter descriptions per entity type.
 *
 * Both used to be hardcoded switch statements inside the prompt builder, which
 * meant entity types added to the registry silently got nothing. Keeping them
 * here as data means the bar is form-aware by construction and new entities
 * are one config entry, not a new `case`.
 */

import { ENTITY_REGISTRY, isValidEntityType, type EntityType } from '@/config/entity-registry';
import { getAssistFormConfig } from '@/config/ai-assist-forms';
import type { FieldConfig, FieldInputType } from '@/components/create/types';

// ==================== INTENT ====================

/**
 * What the user is asking the AI to do.
 *
 * - `fill`   — the form is (mostly) empty; generate values. Anything the user
 *   already typed is protected and wins over the AI.
 * - `refine` — the form already has content; *revise* it. The AI's output wins
 *   for the fields it returns, because changing them is the whole point.
 *
 * This distinction is the SSOT for "who wins on conflict". Without it a refine
 * request can never change anything, since every field it wants to rewrite is
 * already non-empty.
 */
export type AiAssistIntent = 'fill' | 'refine';

/**
 * Fields the AI may overwrite even under intent `fill`.
 *
 * These carry template/defaults rather than user intent (a service form opens
 * with a currency and often a placeholder rate), so protecting them means a
 * description like "CHF 150 per hour" gets silently ignored. One list, used by
 * both the prompt and the merge — they disagreed before, and the merge won.
 */
export const USER_OVERRIDABLE_FIELDS: readonly string[] = [
  'price',
  'currency',
  'hourly_rate',
  'fixed_price',
];

/**
 * Shortest input each intent accepts, enforced identically on client and server.
 *
 * The two floors differ because the two inputs differ: `fill` takes a
 * description of a thing that does not exist yet and needs real substance to
 * work from, while `refine` takes an instruction about a form that is already
 * full — and "shorter", "longer" and "in german" are all perfectly clear at
 * well under ten characters.
 *
 * One number per intent, in one place: the button and the API used to disagree
 * (enabled at 3, rejected under 10), so the most natural way to ask for a small
 * change failed with "Description must be at least 10 characters".
 */
export const AI_ASSIST_MIN_INPUT_LENGTH: Record<AiAssistIntent, number> = {
  fill: 10,
  refine: 3,
};

// ==================== ADJUSTMENTS ====================

/** Which fields an adjustment is relevant to. Omit to always offer it. */
interface AdjustmentScope {
  /** Matches a field with any of these exact names */
  fieldNames?: string[];
  /** Matches a field of any of these input types */
  fieldTypes?: FieldInputType[];
}

export interface AiAdjustment {
  /** Stable identifier (used as React key and in tests) */
  id: string;
  /** Chip label — what the user reads */
  label: string;
  /** Sent to the AI verbatim as the refinement request */
  instruction: string;
  /** Only offered when the form has a matching field */
  appliesTo?: AdjustmentScope;
}

/** A language a listing can be mirrored into, alongside the original text. */
interface AiTranslationLanguage {
  /** Chip label — "Add {label} version" */
  label: string;
  /** How the AI should be told to write it, including any spelling conventions */
  instruction: string;
}

/**
 * Languages offered as a one-click "add a translation" adjustment.
 *
 * Switzerland has four national languages, so which one is offered is a config
 * decision, not something to bake into a component. Order is priority: the
 * first is offered up front, the rest sit further down the chip list.
 * German carries the house spelling rule (ss, never ß).
 */
export const AI_TRANSLATION_LANGUAGES: readonly AiTranslationLanguage[] = [
  {
    label: 'German',
    instruction:
      'German, using Swiss conventions: write "ss" instead of "ß", and keep the umlauts ä, ö and ü',
  },
  { label: 'French', instruction: 'French' },
];

function translationAdjustment(language: AiTranslationLanguage): AiAdjustment {
  return {
    id: `description-translate-${language.label.toLowerCase()}`,
    label: `Add ${language.label} version`,
    instruction: `Rewrite the description so it contains the original text first, then a blank line, then a faithful translation of the same text into ${language.instruction}. Keep both versions equally complete and do not add facts to either one.`,
    appliesTo: { fieldNames: ['description'] },
  };
}

const TRANSLATION_ADJUSTMENTS = AI_TRANSLATION_LANGUAGES.map(translationAdjustment);

/**
 * The adjustments people actually ask for, most-valuable first.
 *
 * Ordering is the display order; `AI_ADJUSTMENT_CHIP_LIMIT` caps how many a
 * form shows so the bar stays a bar and not a menu.
 */
export const AI_ADJUSTMENTS: readonly AiAdjustment[] = [
  {
    id: 'description-longer',
    label: 'Longer description',
    instruction:
      'Rewrite the description so it is substantially longer and more useful — at least three or four sentences. Cover what is offered, what makes it worth choosing, and what the buyer can expect. Keep every fact that is already there and do not invent new facts such as prices, dates, locations, credentials or guarantees.',
    appliesTo: { fieldNames: ['description'] },
  },
  // Primary translation language up front; the rest land after the staples.
  ...TRANSLATION_ADJUSTMENTS.slice(0, 1),
  {
    id: 'description-shorter',
    label: 'Shorter description',
    instruction:
      'Tighten the description to two crisp sentences. Keep the concrete details and drop the filler. Do not remove any factual information such as prices, dates or what is included.',
    appliesTo: { fieldNames: ['description'] },
  },
  {
    id: 'title-sharper',
    label: 'Better title',
    instruction:
      'Rewrite the title so it is specific and scannable — what it is, for whom. Under 60 characters, no marketing filler, no trailing punctuation. Leave the other fields as they are.',
    appliesTo: { fieldNames: ['title', 'name'] },
  },
  {
    id: 'fill-blanks',
    label: 'Fill in the blanks',
    instruction:
      'Fill in every field that is still empty, inferring sensible values from what is already filled in. Leave all fields that already have a value exactly as they are. Do not invent prices, dates or contact details — leave those empty if they are not implied by the rest of the form.',
  },
  {
    id: 'tags-suggest',
    label: 'Better tags',
    instruction:
      'Replace the tags with five to eight specific, lowercase keywords someone would actually search for to find this. No generic words like "quality" or "best".',
    appliesTo: { fieldTypes: ['tags'] },
  },
  {
    id: 'tone-professional',
    label: 'More professional',
    instruction:
      'Rewrite the free-text fields in a more professional, confident tone. No exclamation marks, no hype words like "amazing" or "revolutionary". Keep all facts unchanged.',
    appliesTo: { fieldNames: ['description'] },
  },
  {
    id: 'tone-warmer',
    label: 'Friendlier tone',
    instruction:
      'Rewrite the free-text fields in a warmer, more personal tone — speak directly to the reader as "you". Keep all facts unchanged.',
    appliesTo: { fieldNames: ['description'] },
  },
  ...TRANSLATION_ADJUSTMENTS.slice(1),
];

/** How many adjustment chips a form shows at once. */
export const AI_ADJUSTMENT_CHIP_LIMIT = 5;

/** A field, reduced to what adjustment matching needs. */
type MatchableField = Pick<FieldConfig, 'name' | 'type'>;

function adjustmentApplies(adjustment: AiAdjustment, fields: MatchableField[]): boolean {
  const scope = adjustment.appliesTo;
  if (!scope) {
    return true;
  }
  return fields.some(
    field =>
      scope.fieldNames?.includes(field.name) === true ||
      scope.fieldTypes?.includes(field.type) === true
  );
}

/**
 * The adjustments worth offering for a specific form.
 *
 * This is what makes the bar form-aware: a wishlist with no tags field never
 * offers "Better tags", and a form with no description never offers to
 * lengthen one.
 */
export function getAdjustmentsForFields(
  fields: MatchableField[],
  limit: number = AI_ADJUSTMENT_CHIP_LIMIT
): AiAdjustment[] {
  return AI_ADJUSTMENTS.filter(adjustment => adjustmentApplies(adjustment, fields)).slice(0, limit);
}

/** Look up an adjustment's instruction by id (client sends the instruction). */
export function getAdjustmentById(id: string): AiAdjustment | undefined {
  return AI_ADJUSTMENTS.find(adjustment => adjustment.id === id);
}

// ==================== PER-ENTITY PROMPT INSTRUCTIONS ====================

/**
 * Rules the AI needs to fill a *specific* entity correctly — option values it
 * must use verbatim, sentinel numbers, which of two price fields to set.
 *
 * Data, not a `switch`: an entity type with nothing special here simply has no
 * entry, and adding one is a config line rather than a new branch in the
 * prompt builder.
 */
export const AI_ENTITY_INSTRUCTIONS: Partial<Record<EntityType, string[]>> = {
  product: [
    'For product_type: Choose "physical" for tangible goods, "digital" for downloads/files, or "service" for service-based products.',
    'For price: the amount in the unit named by `currency`, as the user said it — "CHF 15" is price 15 with currency "CHF". Never convert it to BTC.',
    'For fulfillment_type: "digital" when the buyer receives a file or link, otherwise "manual".',
    'For inventory_count: Use -1 for unlimited inventory, or a positive number for limited stock.',
  ],
  service: [
    'For services: Provide either hourly_rate OR fixed_price (or both). Duration is in minutes.',
  ],
  event: ['For events: start_date is required. Use ISO format (YYYY-MM-DDTHH:mm).'],
  loan: [
    'For loans: original_amount is what you need to borrow in BTC. Interest rates are annual percentages (e.g., 5 for 5%).',
  ],
  investment: [
    'For investments: target_amount is the total raise goal in BTC. minimum_investment is the minimum ticket size in BTC.',
  ],
  research: [
    'For research: funding_goal_btc is the funding target. field and methodology must use the exact option values shown above (not labels).',
  ],
  wishlist: [
    'For wishlists: type must be one of: general, birthday, wedding, baby_shower, graduation, personal. visibility: public, unlisted, or private.',
  ],
};

/** Instruction that applies to every entity type. */
export const AI_UNIVERSAL_INSTRUCTIONS: readonly string[] = [
  // Scoped to BTC-denominated fields. It used to read "For Bitcoin prices" and
  // was applied to a product's `price` too — an amount in its own `currency`
  // with a minimum of 1 — so "CHF 15" came back as 0.0002, was dropped by the
  // field's min, and the form opened at 0.00.
  'For fields ending in _btc (and amounts the user gave in BTC): express them in BTC as decimal values (e.g., 0.001). Never use satoshis. Fields paired with a `currency` field take the amount in that currency as stated.',
];

// ==================== STARTER EXAMPLES ====================

/**
 * "Try:" examples shown before the user has typed anything.
 *
 * Every entity type in the registry that can be created through a form should
 * have an entry; `getExampleDescriptions` falls back to the registry's own
 * description so a missing entry degrades to something useful rather than to
 * the old placeholder text.
 */
export const AI_FILL_EXAMPLES: Partial<Record<EntityType, string[]>> = {
  product: [
    'Handmade ceramic mugs, CHF 45 each, glazed in small batches, ships from Zurich',
    'Digital download of my Swiss landscape print collection, $15',
    'Vintage hardware wallets, limited stock of 5 units, 0.005 BTC each',
  ],
  service: [
    'Portrait and event photography, CHF 150 per hour, based in Zurich, travel possible',
    'Web development and Lightning integration, from 0.01 BTC per project',
    'One-to-one Bitcoin onboarding sessions, 90 minutes, remote',
  ],
  event: [
    'Bitcoin meetup next Saturday evening at a cafe in Bern, free entry',
    'Online workshop about the Lightning Network, January 15th at 7pm, 20 seats',
    'Weekend hackathon with a 0.1 BTC prize pool',
  ],
  project: [
    'Building an open-source Bitcoin wallet app, goal of 0.5 BTC',
    'Documentary about Bitcoin adoption in Africa, three-month shoot',
    'Community education programme for local merchants',
  ],
  cause: [
    'Supporting Bitcoin education in underserved communities',
    'Funding for open-source maintenance work',
    'Help me replace the hardware wallet that was stolen',
  ],
  loan: [
    'Need CHF 5,000 for 3 months to expand my repair shop',
    'Looking to refinance an existing loan at a better rate',
    'Small business loan for mining equipment, 0.1 BTC',
  ],
  investment: [
    'Seeking 0.5 BTC equity investment for my app, revenue-share model',
    'Raising 1 BTC for solar farm expansion, 8% annual return',
    'Seed round, 0.25 BTC minimum ticket',
  ],
  research: [
    'Bitcoin adoption study in emerging markets, goal 0.5 BTC',
    'Computational biology research on protein folding, mixed methods',
    'Economic impact of decentralised finance on local communities',
  ],
  wishlist: [
    'Birthday wishlist for my 30th in June',
    'Wedding registry — kitchen essentials and a honeymoon fund',
    'Personal wishlist for books and electronics',
  ],
  asset: [
    'Two-room flat in Basel available as loan collateral, valued around CHF 400,000',
    'Professional camera kit available to rent by the day',
    'Cargo bike I rent out to neighbours on weekends',
  ],
  ai_assistant: [
    'An assistant that answers customer questions about my repair shop, CHF 5 per conversation',
    'A research assistant that summarises Bitcoin news every morning',
    'A bookkeeping assistant that categorises invoices for small businesses',
  ],
  group: [
    'A Zurich Bitcoin builders collective with a shared treasury',
    'A neighbourhood repair cooperative, membership by invitation',
    'A small studio of three freelancers sharing project work',
  ],
  circle: [
    'A weekly reading circle for Bitcoin books, open to anyone',
    'A circle for parents in my neighbourhood organising childcare swaps',
    'A circle of local makers sharing workshop space',
  ],
  document: [
    'My skills, rates and the kind of work I want more of',
    'Notes on my business goals for this year',
    'Context about my clients and how I usually price projects',
  ],
};

/**
 * Starter examples for any AI-assistable form — an entity type or a
 * standalone assist form (task, proposal). Entity types without their own
 * entry fall back to a prompt built from the registry so every one gets
 * something concrete.
 */
export function getExampleDescriptions(formType: string): string[] {
  if (isValidEntityType(formType)) {
    const examples = AI_FILL_EXAMPLES[formType];
    if (examples && examples.length > 0) {
      return examples;
    }
    const meta = ENTITY_REGISTRY[formType];
    return [`Describe your ${meta.name.toLowerCase()} — ${meta.description.toLowerCase()}`];
  }
  return getAssistFormConfig(formType)?.examples ?? [];
}
