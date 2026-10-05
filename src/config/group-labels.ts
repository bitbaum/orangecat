/**
 * Group labels — OrangeCat's defaults per kind of collective.
 *
 * WHAT A KIND IS lives in @bitbaum/collective-kinds (one list for OrangeCat,
 * Loki and Solon: name, description, whether it is bound to a place, whether it
 * can be tax-exempt). This file holds only what OrangeCat adds on top: the icon,
 * the visibility defaults, the features to switch on, the governance preset.
 * It is keyed by the package's ids, so a kind added there without a row here
 * fails the build — and `nonprofit`, which was OrangeCat's own word for what
 * the world calls an association, is gone (migration 20260928120000 renames
 * the rows).
 *
 * Labels are IDENTITY + TEMPLATE, not capability locks. A "Family" can enable
 * voting. A "DAO" can disable treasury. Labels influence defaults but don't
 * restrict capabilities.
 */

import {
  Users,
  Building2,
  Heart,
  Briefcase,
  Globe,
  Home,
  Handshake,
  Landmark,
  Sparkles,
  PiggyBank,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  COLLECTIVE_KINDS,
  COLLECTIVE_KIND_IDS,
  type CollectiveKindId,
} from '@bitbaum/collective-kinds';
import type { GovernancePreset } from './governance-presets';
import type { GroupFeature } from './group-features';

export type GroupVisibility = 'public' | 'members_only' | 'private';

interface GroupLabelDefaults {
  icon: LucideIcon;
  iconClass: string;
  defaults: {
    is_public: boolean;
    visibility: GroupVisibility;
  };
  suggestedFeatures: GroupFeature[];
  defaultGovernance: GovernancePreset;
}

/** OrangeCat's additions, one row per kind — the type makes a missing kind a build error. */
const LABEL_DEFAULTS: Record<CollectiveKindId, GroupLabelDefaults> = {
  circle: {
    icon: Users,
    iconClass: 'text-fg-primary',
    defaults: { is_public: false, visibility: 'members_only' },
    suggestedFeatures: [],
    defaultGovernance: 'consensus',
  },
  family: {
    icon: Home,
    iconClass: 'text-fg-primary',
    defaults: { is_public: false, visibility: 'private' },
    suggestedFeatures: ['shared_wallet'],
    defaultGovernance: 'consensus',
  },
  association: {
    icon: Heart,
    iconClass: 'text-fg-primary',
    defaults: { is_public: true, visibility: 'public' },
    suggestedFeatures: ['treasury', 'proposals'],
    defaultGovernance: 'democratic',
  },
  cooperative: {
    icon: Handshake,
    iconClass: 'text-fg-primary',
    defaults: { is_public: true, visibility: 'public' },
    suggestedFeatures: ['treasury', 'proposals', 'voting'],
    defaultGovernance: 'democratic',
  },
  collective: {
    icon: Sparkles,
    iconClass: 'text-fg-primary',
    defaults: { is_public: false, visibility: 'members_only' },
    suggestedFeatures: ['proposals'],
    defaultGovernance: 'consensus',
  },
  company: {
    icon: Building2,
    iconClass: 'text-fg-secondary',
    defaults: { is_public: false, visibility: 'members_only' },
    suggestedFeatures: ['treasury'],
    defaultGovernance: 'hierarchical',
  },
  guild: {
    icon: Briefcase,
    iconClass: 'text-fg-primary',
    defaults: { is_public: true, visibility: 'public' },
    suggestedFeatures: ['events', 'marketplace'],
    defaultGovernance: 'hierarchical',
  },
  dao: {
    icon: Globe,
    iconClass: 'text-fg-primary',
    defaults: { is_public: true, visibility: 'public' },
    suggestedFeatures: ['treasury', 'proposals', 'voting'],
    defaultGovernance: 'democratic',
  },
  town: {
    icon: Landmark,
    iconClass: 'text-fg-primary',
    defaults: { is_public: true, visibility: 'public' },
    suggestedFeatures: ['treasury', 'proposals', 'voting', 'events'],
    defaultGovernance: 'democratic',
  },
  charter_city: {
    icon: Building2,
    iconClass: 'text-fg-primary',
    defaults: { is_public: true, visibility: 'public' },
    suggestedFeatures: ['treasury', 'proposals', 'voting', 'events'],
    defaultGovernance: 'democratic',
  },
  network_state: {
    icon: Globe,
    iconClass: 'text-fg-primary',
    defaults: { is_public: true, visibility: 'public' },
    suggestedFeatures: ['treasury', 'proposals', 'voting', 'events'],
    defaultGovernance: 'democratic',
  },
  local_fund: {
    icon: PiggyBank,
    iconClass: 'text-fg-primary',
    defaults: { is_public: true, visibility: 'public' },
    suggestedFeatures: ['treasury', 'proposals', 'voting'],
    defaultGovernance: 'democratic',
  },
};

export type GroupLabel = CollectiveKindId;

export interface GroupLabelConfig extends GroupLabelDefaults {
  id: GroupLabel;
  name: string;
  description: string;
  needsPlace: boolean;
  canBeTaxExempt: boolean;
}

/** The kind (from the package) merged with OrangeCat's defaults — one object per label. */
export const GROUP_LABELS: Readonly<Record<GroupLabel, GroupLabelConfig>> = Object.fromEntries(
  COLLECTIVE_KIND_IDS.map(id => {
    const kind = COLLECTIVE_KINDS[id];
    return [
      id,
      {
        id,
        name: kind.name,
        description: kind.description,
        needsPlace: kind.needsPlace,
        canBeTaxExempt: kind.canBeTaxExempt,
        ...LABEL_DEFAULTS[id],
      },
    ];
  })
) as Record<GroupLabel, GroupLabelConfig>;

/** Labels in the package's declared order — for forms and enums. */
export const GROUP_LABEL_IDS: readonly GroupLabel[] = COLLECTIVE_KIND_IDS;

/** Whether a string is one of the kinds — model or form input is checked against this. */
export const isGroupLabel = (value: unknown): value is GroupLabel =>
  typeof value === 'string' && (GROUP_LABEL_IDS as readonly string[]).includes(value);

/** The labels that cannot be founded without a place (a town, a local fund). */
export const PLACE_BOUND_LABELS: readonly GroupLabel[] = GROUP_LABEL_IDS.filter(
  id => GROUP_LABELS[id].needsPlace
);

/**
 * Get defaults for a group label
 */
export function getGroupLabelDefaults(label: GroupLabel) {
  const config = GROUP_LABELS[label];
  return {
    ...config.defaults,
    label,
    governance_preset: config.defaultGovernance,
    suggestedFeatures: config.suggestedFeatures,
  };
}

/**
 * Get all group labels as array for UI rendering
 */
export function getGroupLabelsArray() {
  return GROUP_LABEL_IDS.map(key => ({ key, ...GROUP_LABELS[key] }));
}
