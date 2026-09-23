import { applyWalletSelection } from '@/components/create/wallet-selector/applyWalletSelection';

describe('applyWalletSelection', () => {
  it('links the wallet row and copies its handles onto the entity form', () => {
    const changes: Record<string, unknown> = {};
    applyWalletSelection(
      (field, value) => {
        changes[field] = value;
      },
      {
        id: 'wallet-1',
        address_or_xpub: 'bc1qexample',
        lightning_address: null,
      }
    );

    expect(changes).toEqual({
      bitcoin_address: 'bc1qexample',
      lightning_address: '',
      _wallet_id: 'wallet-1',
    });
  });
});
