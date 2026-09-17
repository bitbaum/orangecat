// @vitest-environment jsdom
/**
 * `free_messages_per_day` is a real pricing term — `checkFreeMessageUsage`
 * counts the day's messages and `computeCreatorChargeBtc` returns 0 while the
 * allowance lasts — and until now the visitor could not see it before starting
 * a paid conversation.
 *
 * The interesting half is the case where it must NOT render. The allowance only
 * changes anything when the assistant charges: on a free assistant every message
 * costs nothing whatever the number says, so "First 50 free each day" would
 * announce a cap that does not exist. The badge is therefore gated on the same
 * condition the charge path uses, and that agreement is what these tests pin —
 * a field can be dead because nothing shows it, and it can be worse than dead
 * because something shows it wrongly.
 *
 * Gated by scripts/check-dead-fields.mjs; this is the instance.
 */

import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (n: number) => `${n} BTC`,
    formatAmount: (n: number) => `${n}`,
  }),
}));

import { aiAssistantDetailConfig } from '@/components/public/detail-configs/ai-assistant';

const paid = {
  id: 'a-1',
  title: 'Legal Information Assistant',
  pricing_model: 'per_message',
  price_per_message: 0.00001,
};

describe('ai assistant free-message allowance', () => {
  it('shows the allowance when the assistant actually charges', () => {
    render(
      <div>
        {aiAssistantDetailConfig.renderHeaderExtra?.({ ...paid, free_messages_per_day: 5 })}
      </div>
    );
    expect(screen.getByText('First 5 free each day')).toBeInTheDocument();
  });

  it('hides it on a free assistant, where the number caps nothing', () => {
    render(
      <div>
        {aiAssistantDetailConfig.renderHeaderExtra?.({
          id: 'a-2',
          title: 'OrangeCat Guide',
          pricing_model: 'free',
          free_messages_per_day: 50,
        })}
      </div>
    );
    expect(screen.queryByText(/free each day/)).not.toBeInTheDocument();
    expect(screen.getByText('Free to chat')).toBeInTheDocument();
  });

  it('hides it when a paid model has no price set, which bills as free', () => {
    // getAiPricing normalizes price<=0 to free, matching computeCreatorChargeBtc.
    render(
      <div>
        {aiAssistantDetailConfig.renderHeaderExtra?.({
          ...paid,
          price_per_message: 0,
          free_messages_per_day: 5,
        })}
      </div>
    );
    expect(screen.queryByText(/free each day/)).not.toBeInTheDocument();
  });

  it('hides it when the allowance is zero', () => {
    render(
      <div>
        {aiAssistantDetailConfig.renderHeaderExtra?.({ ...paid, free_messages_per_day: 0 })}
      </div>
    );
    expect(screen.queryByText(/free each day/)).not.toBeInTheDocument();
    expect(screen.getByText(/0\.00001 BTC/)).toBeInTheDocument();
  });
});
