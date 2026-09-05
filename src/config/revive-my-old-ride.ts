/**
 * "Revive My Old Ride" — OrangeCat-side SSOT
 *
 * The economic/outward half of a revamp-it initiative. OrangeCat is the layer
 * that *markets* it (public project, Supporters, the Cat's outward voice);
 * FleetCrown is the layer that *executes* it (agent-fleet dispatch, ops).
 *
 * This file is the single source of truth for the project's canonical content
 * and for the seed that registers it on-platform
 * (scripts/seed-revive-my-old-ride.ts). The copy is defined ONCE here and
 * reused by the seed today and any /projects rendering or Cat context later.
 *
 * On-platform ownership: there is no separate "revamp-it" actor — the founder's
 * platform identity is the `mao` actor (Cato), which already owns the
 * "FleetCrown" and "OrangeCat" projects. Revive My Old Ride is owned the same
 * way, with revamp-it represented as an external stakeholder link. Swap to a
 * dedicated revamp-it actor/group later by changing OWNER_ACTOR_SLUG.
 *
 * Created: 2026-06-15
 */

// =====================================================================
// OWNERSHIP
// =====================================================================

/** Actor slug that owns this project (and the stakeholder edges). */
export const OWNER_ACTOR_SLUG = 'mao';

// =====================================================================
// FIRST-PRINCIPLES ECONOMIC GATE
// =====================================================================

/**
 * The non-negotiable rule that governs every intake. A vehicle is revived ONLY
 * when restoration is net-positive at unsubsidised cost. Otherwise it descends
 * the waste hierarchy — recycle, then energy-recover, then dispose. No
 * sentimental, money-losing restorations; the planet and the P&L agree.
 */
export const ECONOMIC_GATE = {
  rule: 'Revive only when restoration is net-positive at unsubsidised cost.',
  fallbackHierarchy: ['recycle', 'energy-recover', 'dispose'] as const,
  explainer:
    'We do not restore vehicles at a loss and call it sustainability. If the ' +
    'numbers do not clear on their own — parts, labour, time, resale — the ' +
    'vehicle moves down the waste hierarchy: reusable parts recovered, ' +
    'materials recycled, residual energy recovered, and only what is left is ' +
    'disposed. The greenest and the most honest outcome are the same outcome.',
} as const;

// =====================================================================
// SERVICE PIPELINE
// =====================================================================

export const SERVICE_PIPELINE = [
  { step: 'intake', label: 'Intake & assessment', detail: 'VIN, condition, paperwork, photos.' },
  {
    step: 'gate',
    label: 'Economic gate check',
    detail: 'Unsubsidised net-positive? GO to revive, else recycle path.',
  },
  {
    step: 'revive',
    label: 'Revive',
    detail: 'Restore / refurbish to target spec, then resell to a new owner.',
  },
  {
    step: 'recover',
    label: 'Recover',
    detail: 'Harvest reusable parts; recycle materials; energy-recover the rest.',
  },
] as const;

// =====================================================================
// ANCHOR PILOT
// =====================================================================

export const ANCHOR_PILOT = {
  vehicle: 'BMW 6 Series',
  purpose:
    'First real GO/NO-GO run of the economic gate against a concrete vehicle, ' +
    'budget ceiling, and target restoration spec.',
} as const;

// =====================================================================
// PUBLIC LISTING COPY (the "marketing" the FleetCrown session deferred to OC)
// =====================================================================

export const LISTING_COPY = {
  headline: 'Revive My Old Ride',
  subhead: 'Give your old vehicle an honest second life — or a responsible end.',
  body: [
    'revamp-it has spent years keeping good machines out of the scrap heap. ' +
      'Revive My Old Ride extends that craft from computers to vehicles: you ' +
      'bring an old ride, and we tell you the truth about it.',
    'Every vehicle passes one gate — is it worth more revived than recycled, ' +
      'without subsidy? If yes, we restore it and find it a new owner. If no, ' +
      'we recover every reusable part, recycle the materials, and dispose of ' +
      'nothing that still has value. You get a clear answer either way.',
    'OrangeCat is where the work is shown and supported; FleetCrown is the ' +
      'engine room where an agent fleet plans, sources, and runs each job.',
  ],
  cta: 'Bring us your old ride',
} as const;

// =====================================================================
// PROJECT PROFILE PAYLOAD (maps 1:1 to the live `projects` table)
// =====================================================================

export interface ReviveProjectPayload {
  title: string;
  description: string;
  category: string;
  currency: string;
  status: string;
  tags: string[];
  funding_purpose: string;
  website_url: string;
}

export const PROJECT_PAYLOAD: ReviveProjectPayload = {
  title: LISTING_COPY.headline,
  description: [LISTING_COPY.subhead, '', ...LISTING_COPY.body].join('\n'),
  category: 'Sustainability',
  currency: 'CHF',
  status: 'active',
  tags: ['circular-economy', 'restoration', 'recycling', 'vehicles', 'revamp-it'],
  funding_purpose:
    'Supporters fund the pilots and the tooling that make the economic gate ' +
    'sharper — so more vehicles clear the bar for revival instead of recycling.',
  website_url: 'https://revamp-it.ch',
} as const;

// =====================================================================
// STAKEHOLDER EDGES (from the Revive project → counterparties)
//   kind ∈ competitor | collaborator | investor | customer | employee |
//          acquirer | acquisition_target | in_house_dev
//   The Revive project lives on OrangeCat and is executed by FleetCrown.
// =====================================================================

export interface StakeholderEdgeSpec {
  /** Resolve target by a sibling project's title, OR by an external link. */
  toProjectTitle?: string;
  toExternalUrl?: string;
  toExternalName?: string;
  kind:
    | 'competitor'
    | 'collaborator'
    | 'investor'
    | 'customer'
    | 'employee'
    | 'acquirer'
    | 'acquisition_target'
    | 'in_house_dev';
  notes: string;
}

export const STAKEHOLDER_EDGES: StakeholderEdgeSpec[] = [
  {
    toProjectTitle: 'FleetCrown',
    kind: 'in_house_dev',
    notes: 'FleetCrown is the engineering/execution layer — the agent fleet that runs each job.',
  },
  {
    toProjectTitle: 'OrangeCat',
    kind: 'collaborator',
    notes: 'OrangeCat is the economic/marketing layer where the project is shown and supported.',
  },
  {
    toExternalUrl: 'https://revamp-it.ch',
    toExternalName: 'revamp-it',
    kind: 'collaborator',
    notes: 'revamp-it is the real-world Swiss circular-economy operator behind the initiative.',
  },
];
