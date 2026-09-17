// Mock for @/lib/nostr/nwc — prevents nostr-tools ESM/CJS issues in Jest.
// NWCClient is mocked with vi.fn() stubs; real NWC tests use integration environment.

class NWCClient {
  constructor(_uri) {}
  connect() {
    return Promise.resolve();
  }
  disconnect() {}
  payInvoice(_bolt11) {
    return Promise.resolve({ payment_hash: 'mock_hash', invoice: _bolt11 });
  }
  makeInvoice(_sats, _desc, _expiry) {
    return Promise.resolve({ invoice: 'lnbc_mock', payment_hash: 'mock_hash' });
  }
  getBalance() {
    return Promise.resolve(100000);
  }
  lookupInvoice(_hash) {
    return Promise.resolve({ payment_hash: _hash });
  }
}

function parseNWCUri(uri) {
  return { walletPubkey: 'mock', relayUrl: 'wss://mock', secret: 'mock' };
}
function isValidNWCUri(uri) {
  return typeof uri === 'string' && uri.startsWith('nostr+walletconnect://');
}

module.exports = { NWCClient, parseNWCUri, isValidNWCUri };
