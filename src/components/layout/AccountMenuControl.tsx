'use client';

/**
 * The account menu in the header: who is signed in, the places under "you",
 * the other identities to switch to, and sign-out.
 *
 * The menu itself is `@bitbaum/accountkit`'s `AccountMenu`, the one every
 * product uses. This file supplies what is OrangeCat's: the person, the
 * places, the identities and what a tap does. Layout, keyboard handling and
 * the failure states are the package's.
 */

import '@bitbaum/accountkit/styles.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BarChart3, Handshake, Settings, UserRound } from 'lucide-react';
import { AccountMenu, type AccountGroup } from '@bitbaum/accountkit';
import { IDENTITIES_COPY, isUnreachableEmail } from '@/config/identities';
import { ROUTES } from '@/config/routes';
import { getThemeModeOption } from '@/config/theme';
import { useAuth } from '@/hooks/useAuth';
import { useOtherIdentities } from '@/hooks/useOtherIdentities';
import { useThemeMode } from '@/hooks/useThemeMode';
import { switchToIdentity } from '@/lib/identities/client';
import { useAuthStore } from '@/stores/auth';
import { logger } from '@/utils/logger';

const ICON = 'h-5 w-5';

export default function AccountMenuControl() {
  const router = useRouter();
  const { user, profile, session, signOut } = useAuth();
  const { fetchProfile } = useAuthStore();
  const { mode, cycle, mounted } = useThemeMode();
  const signedIn = Boolean(user || session);
  const others = useOtherIdentities(signedIn);

  useEffect(() => {
    if (signedIn && !profile) {
      fetchProfile().catch(e => logger.warn('Failed to fetch profile', e, 'AccountMenu'));
    }
  }, [signedIn, profile, fetchProfile]);

  if (!signedIn) {
    return null;
  }

  // An identity sits on an address nobody can read; it has no email to show.
  const accountEmail = user?.email || session?.user?.email || null;
  const theme = getThemeModeOption(mode);
  const ThemeIcon = theme.icon;

  const groups: AccountGroup[] = [
    {
      id: 'places',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          href: ROUTES.DASHBOARD.HOME,
          icon: <BarChart3 className={ICON} />,
        },
        {
          id: 'projects',
          label: 'My projects',
          href: ROUTES.DASHBOARD.PROJECTS,
          icon: <Handshake className={ICON} />,
        },
        {
          id: 'page',
          label: 'Your page',
          href: ROUTES.PROFILE.SELF,
          icon: <UserRound className={ICON} />,
        },
        {
          id: 'profile',
          label: 'Edit profile',
          href: ROUTES.DASHBOARD.INFO_EDIT,
          icon: <Settings className={ICON} />,
        },
      ],
    },
    {
      // Here so a phone can reach it: the header's own toggle is desktop-only.
      id: 'appearance',
      items: mounted
        ? [
            {
              id: 'theme',
              label: `Appearance: ${theme.label}`,
              onSelect: cycle,
              icon: <ThemeIcon className={ICON} />,
            },
          ]
        : [],
    },
  ];

  return (
    <AccountMenu
      user={{
        name: profile?.name ?? null,
        handle: profile?.username ?? null,
        email: isUnreachableEmail(accountEmail) ? null : accountEmail,
        image: profile?.avatar_url ?? null,
      }}
      groups={groups}
      accounts={others.map(member => ({
        id: member.id,
        note: member.isHolder ? IDENTITIES_COPY.main : undefined,
        // What waits there, so it is known without switching (ADR-0014 D8).
        waiting: member.waiting,
        user: { name: member.name, handle: member.username, image: member.avatarUrl },
      }))}
      onSwitchAccount={async id => {
        // Resolves only when the switch failed; on success the tab reloads.
        throw new Error(await switchToIdentity(id));
      }}
      onSignOut={async () => {
        const { error } = await signOut();
        if (error) {
          logger.error('Sign out failed', { error: error.message }, 'AccountMenu');
          throw error;
        }
        router.push(ROUTES.HOME);
      }}
      renderLink={props => <Link {...props} />}
      labels={{
        switchAccount: IDENTITIES_COPY.switchLabel,
        switchFailed: IDENTITIES_COPY.switchFailed,
        waiting: '{count} unread',
        waitingElsewhere: 'something is unread in another identity',
      }}
    />
  );
}
