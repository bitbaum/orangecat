// @vitest-environment jsdom
/**
 * Talking to the Cat, and read receipts once it has answered.
 *
 * 1. A direct message to the Cat's account is answered only when it tags @cat,
 *    so its profile's "Message" button and the New message picker's "Cat @cat"
 *    row opened a thread where an ordinary question got no answer. Both now
 *    lead to the Cat's own chat.
 * 2. The Cat stays in a conversation after it answers, and its read mark moves
 *    only when it writes. Counted as a recipient, it held every later message
 *    at "Delivered" after the person it was sent to had read it.
 */
import { createRef, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NewConversationModal from '@/components/messaging/NewConversationModal';
import { ProfileActions } from '@/components/profile/ProfileActions';
import { ROUTES } from '@/config/routes';
import { MESSAGE_STATUS } from '@/features/messaging/lib/constants';
import {
  applyStatusToMessages,
  calculateMessageStatus,
} from '@/features/messaging/lib/message-utils';
import { pickerOffersCat, rankPeopleForPicker } from '@/features/messaging/people-picker';
import type { Message } from '@/features/messaging/types';
import type { ScalableProfile } from '@/services/profile/types';

vi.mock('@/components/profile/useCanReceive', () => ({ useCanReceive: () => false }));

const CAT = { id: 'cat-id', username: 'cat', name: 'Cat', avatar_url: null };
const CATO = { id: 'cato-id', username: 'cato', name: 'Cato', avatar_url: 'c.png' };
const ALISA = { id: 'alisa-id', username: 'alisa', name: 'Alisa', avatar_url: null };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

describe('the New message picker', () => {
  it('never lists the Cat as a person', () => {
    expect(
      rankPeopleForPicker([CATO, CAT, ALISA], { searching: true }).map(p => p.username)
    ).toEqual(['cato', 'alisa']);
  });

  it("offers Talk to Cat while what is typed could be the Cat's name or handle", () => {
    for (const typed of ['', 'c', 'ca', 'cat', 'Cat', '@cat', ' CAT ']) {
      expect(pickerOffersCat(typed)).toBe(true);
    }
    for (const typed of ['cato', 'alisa', '@al', 'at']) {
      expect(pickerOffersCat(typed)).toBe(false);
    }
  });

  it('keeps the Talk to Cat row up when "cat" is typed, and drops the Cat from the results', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [CATO, CAT, ALISA] }),
    } as Response);

    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <NewConversationModal isOpen={open} onClose={() => setOpen(false)} onCreated={() => {}} />
      );
    }

    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('searchbox', { name: 'Find a person to message' }), 'cat');

    await waitFor(() => expect(screen.getByText('Cato')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Talk to Cat/ })).toHaveAttribute(
      'href',
      ROUTES.DASHBOARD.CAT
    );
    // Each person row carries their picture, named after them.
    expect(screen.getByAltText('Cato')).toBeInTheDocument();
    expect(screen.queryByAltText('Cat')).not.toBeInTheDocument();
  });
});

describe('read receipts once the Cat has answered', () => {
  const ME = 'me';
  const MARA = 'mara';
  const CAT_SEAT = 'cat-seat';

  function sent(createdAt: string): Message {
    return {
      id: `m-${createdAt}`,
      conversation_id: 'conv',
      sender_id: ME,
      content: 'Mara, it is 1.2 m — see you Friday?',
      message_type: 'text',
      metadata: null,
      created_at: createdAt,
      updated_at: createdAt,
      is_deleted: false,
      edited_at: null,
    };
  }

  // The Cat answered at 10:00 and has not written since, so its mark sits there.
  const catAnsweredAt = new Date('2026-11-12T10:00:00.000Z');
  const later = sent('2026-11-12T10:07:00.000Z');

  it('shows Read once the person has read it, whatever the Cat last read', () => {
    const readTimes = new Map<string, Date | null>([
      [ME, new Date('2026-11-12T10:07:00.000Z')],
      [MARA, new Date('2026-11-12T10:08:30.000Z')],
      [CAT_SEAT, catAnsweredAt],
    ]);
    expect(calculateMessageStatus(later, ME, readTimes, new Set([CAT_SEAT]))).toBe(
      MESSAGE_STATUS.READ
    );
    expect(applyStatusToMessages([later], ME, readTimes, new Set([CAT_SEAT]))[0].is_read).toBe(
      true
    );
  });

  it('is not Read because the Cat read it while the person has not', () => {
    const readTimes = new Map<string, Date | null>([
      [ME, new Date('2026-11-12T10:07:00.000Z')],
      [MARA, new Date('2026-11-12T09:00:00.000Z')],
      [CAT_SEAT, new Date('2026-11-12T10:09:00.000Z')],
    ]);
    expect(calculateMessageStatus(later, ME, readTimes, new Set([CAT_SEAT]))).toBe(
      MESSAGE_STATUS.DELIVERED
    );
  });

  it("counts the Cat's read when it is the only one else in the conversation", () => {
    const question = sent('2026-11-12T09:59:00.000Z');
    const readTimes = new Map<string, Date | null>([
      [ME, new Date('2026-11-12T09:59:00.000Z')],
      [CAT_SEAT, catAnsweredAt],
    ]);
    expect(calculateMessageStatus(question, ME, readTimes, new Set([CAT_SEAT]))).toBe(
      MESSAGE_STATUS.READ
    );
  });
});
