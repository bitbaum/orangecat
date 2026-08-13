import { publicProfilePath } from '@/config/public-profile-path';

const DEFAULT_ORANGECAT_ORIGIN = 'https://www.orangecat.ch';

function publicUrl(name: string, fallback: string): URL {
  const value = process.env[name] ?? fallback;
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
}

const orangeCatOrigin = publicUrl('NEXT_PUBLIC_ORANGECAT_URL', DEFAULT_ORANGECAT_ORIGIN);
const fleetCrownOrigin = publicUrl('NEXT_PUBLIC_FLEETCROWN_URL', 'https://fleetcrown.orangecat.ch');

function orangeCatPage(path: string): string {
  return new URL(path, orangeCatOrigin).toString();
}

/** Canonical public identities used by support and sibling-product surfaces. */
export const ECOSYSTEM = {
  owner: 'Mao Nakamoto',
  orangeCat: {
    title: 'OrangeCat',
    projectId:
      process.env.NEXT_PUBLIC_ORANGECAT_PROJECT_ID ?? 'cb093f00-8745-4579-98df-050ebfb37181',
    siteUrl: orangeCatOrigin.toString(),
    // Keep this bootstrap identity path local: importing the route registry
    // here creates a routes → entity-registry → ecosystem cycle at runtime.
    profileUrl: orangeCatPage(publicProfilePath('mao-nakamoto')),
  },
  fleetCrown: {
    title: 'FleetCrown',
    projectId:
      process.env.NEXT_PUBLIC_FLEETCROWN_ORANGECAT_PROJECT_ID ??
      '8130c927-114a-45b7-8cc2-99efd5224025',
    siteUrl: fleetCrownOrigin.toString(),
  },
  support: {
    lightningAddress:
      process.env.NEXT_PUBLIC_ECOSYSTEM_LIGHTNING_ADDRESS ?? 'orangecat@getalby.com',
    bitcoinAddress:
      process.env.NEXT_PUBLIC_ECOSYSTEM_BITCOIN_ADDRESS ??
      'bc1q3hh4yklcmwtpnqmxyksw36yedg7zyfy6tzzqwz',
  },
} as const;

export const ECOSYSTEM_LINKS = {
  mao: ECOSYSTEM.orangeCat.profileUrl,
  orangeCat: orangeCatPage(`/projects/${ECOSYSTEM.orangeCat.projectId}`),
  fleetCrown: orangeCatPage(`/projects/${ECOSYSTEM.fleetCrown.projectId}`),
} as const;

export const ORANGECAT_FLEETCROWN_INTEGRATION = {
  customer: ECOSYSTEM.fleetCrown.title,
  owner: ECOSYSTEM.owner,
  orangeCat: { title: ECOSYSTEM.orangeCat.title, id: ECOSYSTEM.orangeCat.projectId },
  fleetCrown: {
    title: ECOSYSTEM.fleetCrown.title,
    id: ECOSYSTEM.fleetCrown.projectId,
    site: ECOSYSTEM.fleetCrown.siteUrl,
  },
  wallet: {
    btc: ECOSYSTEM.support.bitcoinAddress,
    lightning: ECOSYSTEM.support.lightningAddress,
  },
  relation: 'FleetCrown is a customer of OrangeCat.',
  note: 'OrangeCat is the public funding layer; FleetCrown is the building layer.',
} as const;
