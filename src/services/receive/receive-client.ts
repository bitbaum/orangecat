/**
 * Browser client for the owner-side /receive surface.
 * Settlement polling reuses the tips status endpoint — a receive request IS
 * the tips engine pointed at yourself (same intent, same bearer token).
 */

import { API_ROUTES } from '@/config/api-routes';
import { unwrapApiResponse } from '@/lib/api/client-response';

export { fetchTipStatus as fetchReceiveStatus } from '@/services/tips/tip-client';

export interface ReceiveRequest {
  intentId: string;
  statusToken: string;
  qrData: string;
  methodLabel: string;
  amountBtc: number;
  expiresInSeconds: number | null;
  paymentMethod: 'nwc' | 'lightning_address' | 'onchain';
}

export interface OwnerReceiveOverview {
  username: string | null;
  lightningAddress: string | null;
  rail: 'nwc' | 'lightning_address' | 'onchain' | null;
  lightningAddressActive: boolean;
}

export interface ReceiveWalletOption {
  id: string;
  label: string;
  wallet_type: string | null;
  is_primary: boolean;
}

/** Can I be paid right now, and what is my @orangecat.ch address? */
export async function fetchReceiveOverview(): Promise<OwnerReceiveOverview> {
  const res = await fetch(API_ROUTES.WALLETS.RECEIVE_STATUS);
  return unwrapApiResponse<OwnerReceiveOverview>(res, 'Could not load your receiving setup.');
}

/** The owner's active wallets, for the receive-with switcher. */
export async function fetchReceiveWallets(profileId: string): Promise<ReceiveWalletOption[]> {
  const res = await fetch(`${API_ROUTES.WALLETS.BASE}?profile_id=${encodeURIComponent(profileId)}`);
  const rows = (await unwrapApiResponse<Array<Record<string, unknown>> | null>(res, 'Could not load your wallets.')) ?? [];
  return rows.map(w => ({
    id: String(w.id),
    label: String(w.label ?? 'Wallet'),
    wallet_type: (w.wallet_type as string | null) ?? null,
    is_primary: !!w.is_primary,
  }));
}

/** Mint an exact-amount payment request against my own wallet. */
export async function createReceiveRequest(
  amountBtc: number,
  walletId?: string
): Promise<ReceiveRequest> {
  const res = await fetch(API_ROUTES.RECEIVE.REQUEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount_btc: amountBtc, ...(walletId ? { wallet_id: walletId } : {}) }),
  });
  return unwrapApiResponse<ReceiveRequest>(res, 'Could not create a payment request.');
}
