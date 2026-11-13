// @vitest-environment jsdom
/**
 * Send's "Connect a wallet" used to land on a form titled "Get paid in
 * Bitcoin", with the connection field hidden under "Other ways to get paid
 * (advanced)". Arriving to send, the form now opens on that field, in the
 * same words Send used.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { WalletForm } from '@/components/wallets/WalletManager/components/WalletForm';
import { ROUTES } from '@/config/routes';
import { SEND_COPY } from '@/config/send';

afterEach(cleanup);

describe('the wallet form, arriving to send', () => {
  it('opens on the connection field, focused, under the heading Send promised', () => {
    render(<WalletForm purpose="send" onSubmit={async () => undefined} />);

    expect(screen.getByText(SEND_COPY.noWalletTitle)).toBeInTheDocument();
    const toggle = screen.getByRole('button', {
      name: 'Add an on-chain address or a wallet connection',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(screen.getByLabelText('Wallet connection link'));
  });

  it('keeps the receive form as it was otherwise', () => {
    render(<WalletForm onSubmit={async () => undefined} />);
    expect(screen.getByText('Get paid in Bitcoin')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add an on-chain address or a wallet connection' })
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('is linked from Send with the purpose in the URL', () => {
    expect(ROUTES.DASHBOARD.WALLETS_FOR_SEND).toBe(`${ROUTES.DASHBOARD.WALLETS}?for=send`);
  });
});

describe('the wallet form, hosted on a page that is already the surface', () => {
  it('draws no card of its own and sets its two actions as equal cells', () => {
    const { container } = render(
      <WalletForm
        bare
        hideIntro
        submitLabel="Save wallet"
        cancelLabel="Not now"
        onCancel={() => undefined}
        onSubmit={async () => undefined}
      />
    );
    expect((container.firstElementChild as HTMLElement).className).not.toContain('border');
    const save = screen.getByRole('button', { name: 'Save wallet' });
    expect(save.parentElement?.className).toContain('grid-cols-2');
    expect(screen.getByRole('button', { name: 'Not now' }).parentElement).toBe(save.parentElement);
  });
});
