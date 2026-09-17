/**
 * Francesco Tarallo — "DJing & Music Production" service, OrangeCat-side SSOT.
 *
 * A real artist onboarding as a seller: a German DJ/producer resident in
 * Switzerland, releasing on Trapez since 2004. He sells his TIME and SKILL,
 * which is what makes this a `service` and not a `product` — see the
 * `choose` rubric on ENTITY_REGISTRY.service.
 *
 * The copy is defined ONCE here and written to the DB by
 * scripts/seed-francesco-tarallo-dj-service.ts. Edit this file, re-run the
 * seed; it upserts by (actor_id, title) and never truncates.
 *
 * Source for the biographical claims: his own Resident Advisor profile,
 * https://ra.co/dj/francescotarallo (read 2026-09-17). Nothing here is
 * invented about him EXCEPT the rate — see PRICE_IS_PLACEHOLDER below.
 *
 * Created: 2026-09-17
 */

// =====================================================================
// OWNERSHIP
// =====================================================================

/**
 * Actor slug that owns this service. Deliberately NOT the founder's `mao`
 * actor: this is another person's service and another person's income, so it
 * must hang off his own actor and his own wallet. The seed FAILS rather than
 * attaching it to anyone else. Override with SERVICE_ACTOR_SLUG if he signs
 * up under a different handle.
 */
export const SERVICE_ACTOR_SLUG = 'francescotarallo';

// =====================================================================
// THE ONE THING STILL UNCONFIRMED
// =====================================================================

/**
 * The rate below is a PLACEHOLDER chosen to be plausible for specialist music
 * tuition in Switzerland — it is not a rate Francesco has quoted. Nobody can
 * price his hour but him.
 *
 * This is why SERVICE_PAYLOAD.status is 'draft': a draft is not public, so no
 * invented number is ever shown to a buyer. Replace the rate with his, flip
 * status to 'active', re-run the seed.
 */
export const PRICE_IS_PLACEHOLDER = true;

// =====================================================================
// THE SERVICE
// =====================================================================

export interface ServiceSeedPayload {
  title: string;
  description: string;
  category: string;
  hourly_rate: number;
  currency: 'CHF';
  duration_minutes: number;
  service_location_type: 'remote' | 'onsite' | 'both';
  service_area: string;
  portfolio_links: string[];
  show_on_profile: boolean;
  status: 'draft' | 'active' | 'paused' | 'unavailable';
}

export const SERVICE_PAYLOAD: ServiceSeedPayload = {
  title: 'DJing & Music Production — 1:1 Lessons',

  description:
    'Learn to DJ and to produce electronic music with someone who has been ' +
    "releasing on Cologne's Trapez since 2004, with further records on Trapez " +
    'Ltd, Lucidflow, Pentagonik and Superordinate Music — work played out by ' +
    'Richie Hawtin among others.\n\n' +
    'Sessions are one-to-one and built around what you actually want to do:\n\n' +
    '• DJing — beatmatching, phrasing, EQ and transitions, reading a floor, ' +
    'building a set that goes somewhere, on CDJs or vinyl.\n' +
    '• Production — arrangement, sound design, drum programming, mixdown, and ' +
    'the last ten percent that separates a demo from a release.\n' +
    '• Getting heard — finishing tracks instead of hoarding them, and what a ' +
    'label actually listens for in a demo.\n\n' +
    'Complete beginners and producers stuck halfway through a track are equally ' +
    'welcome. In person in Switzerland, or online anywhere.',

  // 'Music & Audio' over 'Teaching & Tutoring': people looking for this search
  // for music, not for tutoring. Both are valid SERVICE_CATEGORIES entries.
  category: 'Music & Audio',

  hourly_rate: 120, // PLACEHOLDER — see PRICE_IS_PLACEHOLDER
  currency: 'CHF',
  duration_minutes: 90, // the usual length of one session

  service_location_type: 'both',
  service_area: 'Switzerland in person · worldwide online',

  // Only links corroborated by his RA profile. A Bandcamp (bathy.bandcamp.com)
  // is also listed there but the handle does not obviously match — confirm with
  // him before adding it rather than publishing a link to someone else.
  portfolio_links: ['https://ra.co/dj/francescotarallo', 'https://soundcloud.com/francesco'],

  show_on_profile: true,

  // Draft until he confirms the rate. See PRICE_IS_PLACEHOLDER.
  status: 'draft',
};
