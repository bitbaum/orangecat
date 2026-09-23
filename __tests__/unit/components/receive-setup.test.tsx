// @vitest-environment jsdom
/**
 * /receive with no rail shows the paste, a reason, and a way out.
 * Skipping must stay possible — money is not a requirement to use OrangeCat.
 */

import { render, screen } from '@testing-library/react';
import { ReceiveSetup } from '@/components/receive/ReceiveSetup';

describe('ReceiveSetup', () => {
  it('asks where money should land and offers Not now', () => {
    render(
      <ReceiveSetup
        profileId="11111111-1111-4111-8111-111111111111"
        onConnected={() => undefined}
      />
    );

    expect(screen.getByRole('heading', { name: 'How should people pay you?' })).toBeTruthy();
    expect(screen.getByText('Why do I need this?')).toBeTruthy();
    expect(screen.getByPlaceholderText('you@wallet.com or bc1…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
    expect(screen.queryByText('Bitcoin Address')).toBeNull();
    expect(screen.queryByText('Lightning Address')).toBeNull();
  });
});
