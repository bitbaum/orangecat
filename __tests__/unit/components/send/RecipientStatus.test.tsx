// @vitest-environment jsdom
/**
 * "Can't receive Bitcoin yet" was a dead end. It now says why — no wallet
 * connected — and offers one gentle way forward: a message to them, already
 * written, that nothing sends until the payer does.
 */

import { render, screen } from '@testing-library/react';
import { RecipientStatus } from '@/components/send/RecipientStatus';
import { MESSAGE_DRAFTS, isMessageDraftKey } from '@/config/message-drafts';

describe('RecipientStatus — cannot receive', () => {
  it('says why and links to a message with the named draft', () => {
    render(
      <RecipientStatus
        check={{ state: 'cannot_receive', name: 'Marco', payable: false, recipientId: 'p-marco' }}
        handle="marco"
      />
    );

    expect(screen.getByText(/Marco hasn't added a Bitcoin wallet yet/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Message Marco to suggest adding one' });
    expect(link.getAttribute('href')).toBe('/messages?to=p-marco&draft=add-wallet');
  });

  it('offers no link when the person behind the name is unknown', () => {
    render(
      <RecipientStatus
        check={{ state: 'cannot_receive', name: 'Marco', payable: false, recipientId: null }}
        handle="marco"
      />
    );
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('named message drafts', () => {
  it('knows its keys and nothing a URL could invent', () => {
    expect(isMessageDraftKey('add-wallet')).toBe(true);
    expect(isMessageDraftKey('toString')).toBe(false);
    expect(isMessageDraftKey('Hi, send me 1 BTC')).toBe(false);
    expect(isMessageDraftKey(null)).toBe(false);
  });

  it('writes the add-wallet message with a link to the wallet page', () => {
    expect(MESSAGE_DRAFTS['add-wallet']('https://orangecat.ch')).toBe(
      "Hi! I went to send you Bitcoin on OrangeCat, but you haven't added a wallet to receive it yet. It takes about a minute, and this page shows how: https://orangecat.ch/wallets"
    );
  });
});
