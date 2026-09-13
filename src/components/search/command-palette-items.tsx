/**
 * CommandPalette items + helpers — extracted from CommandPalette.tsx to keep the
 * component under the 300-line limit. Pure data/helpers; the two builder fns
 * close over `navigateTo` so the component wires them via useMemo.
 */
import {
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  Compass,
  HandHeart,
  Heart,
  Home,
  Lightbulb,
  Mail,
  MessageCircle,
  Package,
  PiggyBank,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import type { LucideIcon } from 'lucide-react';
import type { GlobalSearchHit } from '@/services/search';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

/** Public detail route for a global-search hit, by entity type. */
export function hrefForHit(hit: GlobalSearchHit): string {
  switch (hit.entity_type) {
    case 'project':
      return ROUTES.PROJECTS.VIEW(hit.id);
    case 'product':
      return ROUTES.PRODUCTS.VIEW(hit.id);
    case 'service':
      return ROUTES.SERVICES.VIEW(hit.id);
    case 'cause':
      return ROUTES.CAUSES.VIEW(hit.id);
    case 'loan':
      return ROUTES.LOANS.VIEW(hit.id);
    case 'event':
      return ROUTES.EVENTS.VIEW(hit.id);
    case 'profile':
      return ROUTES.PROFILES.VIEW((hit.subtitle ?? '').replace(/^@/, '') || hit.id);
    default:
      return ROUTES.DISCOVER;
  }
}

export const HIT_ICONS: Record<string, LucideIcon> = {
  project: Lightbulb,
  product: Package,
  service: Briefcase,
  cause: HandHeart,
  loan: PiggyBank,
  event: Calendar,
  profile: Users,
};

/** "Create X" quick actions. `navigateTo` closes the palette + routes. */
export function buildQuickActions(navigateTo: (href: string) => void): PaletteItem[] {
  return [
    {
      id: 'create-product',
      label: 'Create a product',
      hint: 'Physical or digital goods',
      icon: Package,
      keywords: 'sell store shop merchandise digital',
      run: () => navigateTo(ROUTES.DASHBOARD.STORE_CREATE),
    },
    {
      id: 'create-service',
      label: 'Create a service',
      hint: 'Offer your time or expertise',
      icon: Briefcase,
      keywords: 'consulting freelance hourly',
      run: () => navigateTo(ROUTES.DASHBOARD.SERVICES_CREATE),
    },
    {
      id: 'create-project',
      label: 'Create a project',
      hint: 'Raise funds with milestones',
      icon: Lightbulb,
      keywords: 'fundraise campaign goal',
      run: () => navigateTo(ROUTES.DASHBOARD.PROJECTS_CREATE),
    },
    {
      id: 'create-cause',
      label: 'Create a cause',
      hint: 'No-strings charitable funding',
      icon: HandHeart,
      keywords: 'donate charity nonprofit',
      run: () => navigateTo(ROUTES.DASHBOARD.CAUSES_CREATE),
    },
    {
      id: 'create-event',
      label: 'Create an event',
      hint: 'Workshops, meetups, hackathons',
      icon: Calendar,
      keywords: 'meetup workshop conference rsvp',
      run: () => navigateTo(ROUTES.DASHBOARD.EVENTS_CREATE),
    },
    {
      id: 'create-group',
      label: 'Create a group',
      hint: 'Organization, collective, or DAO',
      icon: Building2,
      keywords: 'organization team collective dao company',
      run: () => navigateTo(ROUTES.DASHBOARD.GROUPS_CREATE),
    },
    {
      id: 'create-loan',
      label: 'Create a loan request',
      hint: 'Borrow with repayment terms',
      icon: PiggyBank,
      keywords: 'borrow credit interest',
      run: () => navigateTo(ROUTES.DASHBOARD.LOANS_CREATE),
    },
    {
      id: 'create-investment',
      label: 'Create an investment offer',
      hint: 'Raise equity / revenue share',
      icon: TrendingUp,
      keywords: 'equity revenue share raise capital',
      run: () => navigateTo(ROUTES.DASHBOARD.INVESTMENTS_CREATE),
    },
    {
      id: 'create-wishlist',
      label: 'Create a wishlist',
      hint: 'Gift registry',
      icon: Heart,
      keywords: 'gift registry wishlist',
      run: () => navigateTo(ROUTES.DASHBOARD.WISHLISTS),
    },
    {
      id: 'create-asset',
      label: 'Create an asset listing',
      hint: 'Property, equipment, rentals',
      icon: Bookmark,
      keywords: 'rental property equipment',
      run: () => navigateTo(ROUTES.DASHBOARD.ASSETS_CREATE),
    },
  ];
}

/** Navigate-to-page items. `navigateTo` closes the palette + routes. */
export function buildPages(navigateTo: (href: string) => void): PaletteItem[] {
  return [
    {
      id: 'go-cat',
      label: 'My Cat',
      hint: 'Your AI economic agent',
      icon: Sparkles,
      keywords: 'ai agent chat assistant',
      run: () => navigateTo(ROUTES.DASHBOARD.CAT),
    },
    {
      id: 'go-dashboard',
      label: 'Dashboard',
      icon: Home,
      run: () => navigateTo(ROUTES.DASHBOARD.HOME),
    },
    {
      id: 'go-discover',
      label: 'Discover',
      hint: 'Browse everyone',
      icon: Compass,
      keywords: 'explore browse',
      run: () => navigateTo(ROUTES.DISCOVER),
    },
    {
      id: 'go-timeline',
      label: 'Timeline',
      icon: TrendingUp,
      keywords: 'feed updates',
      run: () => navigateTo(ROUTES.TIMELINE),
    },
    {
      id: 'go-messages',
      label: 'Messages',
      icon: MessageCircle,
      run: () => navigateTo(ROUTES.MESSAGES),
    },
    {
      id: 'go-people',
      label: 'People',
      hint: 'Discover users',
      icon: Users,
      keywords: 'profiles users',
      run: () => navigateTo(ROUTES.DASHBOARD.PEOPLE),
    },
    {
      id: 'go-wallets',
      label: 'Wallets',
      icon: Wallet,
      keywords: 'bitcoin lightning balance',
      run: () => navigateTo(ROUTES.DASHBOARD.WALLETS),
    },
    {
      id: 'go-integrations',
      label: 'Integration keys',
      hint: 'API keys for Loki, hirn.li, …',
      icon: Mail,
      keywords: 'api token settings developers',
      run: () => navigateTo(ROUTES.SETTINGS_INTEGRATIONS),
    },
  ];
}
