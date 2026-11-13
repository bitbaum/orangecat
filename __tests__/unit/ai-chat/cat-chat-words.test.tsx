// @vitest-environment jsdom
/**
 * The Cat chat said things that were not true (orangecat.ch, 2026-11-12):
 * - The Loki sheet sent a half-finished template at once, naming the
 *   operator's projects ("orangecat and loki"), even to an unlinked account.
 * - The model menu offered credits that cannot be bought.
 * - The page footnote showed a model hint ("update_profile").
 * - The Cat Credits ledger read "Once top-up is live to run Cat …".
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LokiChip, LOKI_EXAMPLES } from '@/components/ai-chat/LokiChip';
import { CAT_SEND_EVENT, type CatSendDetail } from '@/lib/chat/cat-send-event';
import {
  UNLOCK_LINK_TEXT,
  lockedModelTitle,
} from '@/components/ai-chat/ModernChatPanel/components/ModelSelector';
import { CAT_CREDITS_ON_SALE } from '@/config/cat-plans';
import { describePageForCat } from '@/config/cat-page-context';
import { CatCreditsPanel } from '@/components/ai/CatCreditsPanel';

function lokiStatus(state: 'connected' | 'not_connected') {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      data: {
        connections: [
          { id: 'loki', state, detail: null, connect: { href: 'https://loki.example/link' } },
        ],
      },
    }),
  })) as unknown as typeof fetch;
}

describe('the Loki sheet', () => {
  it('names nobody’s projects', () => {
    for (const ex of LOKI_EXAMPLES) {
      expect(ex.prompt).not.toMatch(/orangecat and loki/i);
    }
  });

  it('puts a template in the box for the person to finish; it does not send it', async () => {
    lokiStatus('connected');
    const seen: CatSendDetail[] = [];
    const listen = (e: Event) => seen.push((e as CustomEvent<CatSendDetail>).detail);
    window.addEventListener(CAT_SEND_EVENT, listen);
    render(<LokiChip />);
    fireEvent.click(screen.getByRole('button', { name: /Loki/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Send one task to several projects/ })
    );
    window.removeEventListener(CAT_SEND_EVENT, listen);
    expect(seen).toEqual([{ text: 'Send this task to my Loki projects: ', send: false }]);
  });

  it('an account not linked to Loki is offered the link, not tasks to send', async () => {
    lokiStatus('not_connected');
    render(<LokiChip />);
    fireEvent.click(screen.getByRole('button', { name: /Loki/ }));
    expect(await screen.findByRole('link', { name: 'Connect Loki' })).toBeInTheDocument();
    for (const ex of LOKI_EXAMPLES) {
      expect(screen.queryByRole('button', { name: new RegExp(ex.label) })).toBeNull();
    }
  });
});

describe('the model menu', () => {
  it('offers credits only while they are on sale', () => {
    expect(CAT_CREDITS_ON_SALE).toBe(false);
    expect(UNLOCK_LINK_TEXT).toBe('Connect your own key to unlock →');
    expect(lockedModelTitle('Model X')).not.toMatch(/Credits/);
  });
});

describe('the page footnote', () => {
  it('names the profile editor without a model instruction', () => {
    const label = describePageForCat('/dashboard/info/edit')?.label ?? '';
    expect(label).toBe('your profile editor');
    expect(label).not.toMatch(/[a-z]+_[a-z]+/);
  });
});

describe('the Cat Credits ledger', () => {
  it('reads as a sentence while top-up is closed', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { balanceBtc: 0, topupEnabled: false, entries: [] } }),
    })) as unknown as typeof fetch;
    render(<CatCreditsPanel />);
    await waitFor(() =>
      expect(document.body.textContent).toContain(
        'No credit activity yet. Purchases and usage will show here once top-up opens.'
      )
    );
    expect(document.body.textContent).not.toContain('Once top-up is live to run');
  });
});
