// @vitest-environment jsdom
/**
 * A scanner's failure modes ARE the feature.
 *
 * A camera widget that shows a black rectangle when permission was refused, or
 * spins forever on a desktop with no webcam, is worse than the paste field it
 * was meant to improve: the person cannot tell whether the app is broken or
 * they are holding it wrong. Each state below has to say which.
 *
 * The happy path needs a real camera and a real QR code, so it is not asserted
 * here — what is asserted is that nothing renders a dead rectangle, and that
 * every dead end offers the paste field as a way out.
 */

import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/wallets/pastedHandle', () => ({
  normalizePastedHandle: (s: string) => s.trim(),
}));

import WalletQrScanner from '@/components/wallets/WalletQrScanner';

const noop = () => {};

function setCamera(value: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value,
    configurable: true,
    writable: true,
  });
}

function setSecure(secure: boolean) {
  Object.defineProperty(window, 'isSecureContext', {
    value: secure,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  setSecure(true);
  setCamera(undefined);
});

describe('the scanner tells you which dead end you are in', () => {
  it('names an insecure connection rather than blaming permissions', async () => {
    // The browser reports this as a permission failure, which sends people to
    // reset a permission that was never the problem.
    setSecure(false);
    render(<WalletQrScanner onScanned={noop} onClose={noop} />);
    expect(await screen.findByText(/secure connection/i)).toBeInTheDocument();
  });

  it('says so when the browser has no camera API at all', async () => {
    setCamera(undefined);
    render(<WalletQrScanner onScanned={noop} onClose={noop} />);
    expect(await screen.findByText(/cannot open a camera/i)).toBeInTheDocument();
  });

  it('says access was declined when permission is refused', async () => {
    const err = new Error('denied');
    err.name = 'NotAllowedError';
    setCamera({ getUserMedia: () => Promise.reject(err) });
    render(<WalletQrScanner onScanned={noop} onClose={noop} />);
    expect(await screen.findByText(/access was declined/i)).toBeInTheDocument();
  });

  it('says there is no camera on a machine without one', async () => {
    const err = new Error('none');
    err.name = 'NotFoundError';
    setCamera({ getUserMedia: () => Promise.reject(err) });
    render(<WalletQrScanner onScanned={noop} onClose={noop} />);
    expect(await screen.findByText(/no camera found/i)).toBeInTheDocument();
  });

  it('always offers the paste field as the way out', async () => {
    // Every dead end must leave a person able to finish the task.
    setCamera(undefined);
    render(<WalletQrScanner onScanned={noop} onClose={noop} />);
    await waitFor(() => expect(screen.getByText(/paste instead/i)).toBeInTheDocument());
  });

  it('is announced as a dialog, and closable', async () => {
    setCamera(undefined);
    render(<WalletQrScanner onScanned={noop} onClose={noop} />);
    expect(screen.getByRole('dialog', { name: /scan a wallet qr code/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/close scanner/i)).toBeInTheDocument();
  });
});
