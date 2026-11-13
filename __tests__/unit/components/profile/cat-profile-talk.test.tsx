// @vitest-environment jsdom
/**
 * A direct message to the Cat's account is answered only when it tags @cat,
 * so the "Message" button on its profile opened a thread where an ordinary
 * question got no answer. Until a one-to-one with a bot answers every message
 * (ADR-0015 D3), the Cat's profile leads to the Cat's own chat.
 */
import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import { ProfileActions } from '@/components/profile/ProfileActions';
import { ROUTES } from '@/config/routes';
import type { ScalableProfile } from '@/services/profile/types';

vi.mock('@/components/profile/useCanReceive', () => ({ useCanReceive: () => false }));

const CAT = { id: 'cat-id', username: 'cat', name: 'Cat', avatar_url: null };
const CATO = { id: 'cato-id', username: 'cato', name: 'Cato', avatar_url: 'c.png' };

afterEach(cleanup);

describe("the Cat's profile", () => {
  function renderActions(profile: Partial<ScalableProfile>) {
    render(
      <ProfileActions
        profile={profile as ScalableProfile}
        isOwnProfile={false}
        isFollowing={false}
        isFollowLoading={false}
        showShare={false}
        shareButtonRef={createRef<HTMLDivElement>()}
        shareDropdownRef={createRef<HTMLDivElement>()}
        onShareToggle={() => {}}
        onFollowToggle={() => {}}
      />
    );
  }

  it("leads to the Cat's chat, not a direct message it would not answer", () => {
    renderActions(CAT);
    expect(screen.getByRole('link', { name: 'Talk to Cat' })).toHaveAttribute(
      'href',
      ROUTES.DASHBOARD.CAT
    );
    expect(screen.queryByRole('link', { name: 'Message' })).not.toBeInTheDocument();
  });

  it('still opens a direct message with a person', () => {
    renderActions(CATO);
    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute(
      'href',
      ROUTES.MESSAGES_TO(CATO.id)
    );
  });
});
