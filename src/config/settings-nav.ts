import {
  Bell,
  BrainCircuit,
  Gauge,
  KeyRound,
  ShieldCheck,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';

/**
 * SSOT for the settings information architecture.
 *
 * Every surface under /settings/* is declared here once; the shared
 * SettingsShell renders the nav from this list, so adding a settings page is
 * one entry + one route file — never a hand-edited link list on some other
 * page (that pattern left /settings/ai reachable only via a footnote card).
 */
export interface SettingsSection {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    href: ROUTES.SETTINGS,
    label: 'Account',
    description: 'Email, password, security, and your data.',
    icon: UserRound,
  },
  {
    href: ROUTES.SETTINGS_NOTIFICATIONS,
    label: 'Notifications',
    description: 'Pick which emails you receive and how often you get the digest.',
    icon: Bell,
  },
  {
    href: ROUTES.SETTINGS_AI,
    label: 'AI',
    description: 'How Cat runs: managed, credits, your own keys, or local.',
    icon: BrainCircuit,
  },
  {
    href: ROUTES.SETTINGS_USAGE,
    label: 'Usage',
    description: 'How much Cat you have left today, what counts, and when it resets.',
    icon: Gauge,
  },
  {
    href: ROUTES.SETTINGS_INTEGRATIONS,
    label: 'Integrations',
    description: 'Integration keys + webhook endpoints for external services.',
    icon: KeyRound,
  },
];

/**
 * Trust-critical control surfaces that live OUTSIDE /settings (they belong to
 * the Cat/wallet dashboards) but must be findable from it — "what can my Cat
 * do and spend" should never require knowing a dashboard sub-path. Rendered
 * by SettingsShell as a quiet related-links row under the tab rail.
 */
export const RELATED_SETTINGS: SettingsSection[] = [
  {
    href: ROUTES.PROFILE.EDIT,
    label: 'Profile & handle',
    description: 'Your name, handle, bio, and links — the public half of your account.',
    icon: UserRound,
  },
  {
    href: ROUTES.DASHBOARD.CAT_PERMISSIONS,
    label: 'Cat permissions & spend caps',
    description: 'What Cat may do on your behalf, and how much it may spend.',
    icon: ShieldCheck,
  },
  {
    href: ROUTES.DASHBOARD.WALLETS,
    label: 'Wallets',
    description: 'Your wallets, Lightning address, and receive status.',
    icon: Wallet,
  },
];

/**
 * Active-tab test: exact match for the root section, prefix match for
 * sub-sections so nested flows (e.g. /settings/ai/onboarding) highlight
 * their parent tab.
 */
export function isSettingsSectionActive(sectionHref: string, pathname: string): boolean {
  if (sectionHref === ROUTES.SETTINGS) {
    return pathname === ROUTES.SETTINGS;
  }
  return pathname === sectionHref || pathname.startsWith(`${sectionHref}/`);
}
