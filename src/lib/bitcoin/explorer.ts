/**
 * Links to a block explorer — one host, one network switch.
 *
 * Three places built these by hand: two on mempool.space, one on
 * blockstream.info, and none followed NEXT_PUBLIC_BITCOIN_NETWORK, so a
 * testnet deployment linked every transaction to a mainnet page that does
 * not have it.
 */

const EXPLORER =
  process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'testnet'
    ? 'https://mempool.space/testnet'
    : 'https://mempool.space';

export const explorerTxUrl = (txid: string) => `${EXPLORER}/tx/${encodeURIComponent(txid)}`;

export const explorerAddressUrl = (address: string) =>
  `${EXPLORER}/address/${encodeURIComponent(address)}`;
