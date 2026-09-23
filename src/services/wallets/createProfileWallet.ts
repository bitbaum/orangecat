/**
 * Create a profile receive destination from the paste form.
 *
 * The dashboard helper refuses a Lightning-only paste (it demands an on-chain
 * address) and forwards empty strings that the create schema rejects. This
 * sends only the handle the user actually pasted.
 */

import { API_ROUTES } from '@/config/api-routes';
import { unwrapApiResponse } from '@/lib/api/client-response';
import type { Wallet, WalletFormData } from '@/types/wallet';

interface CreatedWalletPayload {
  wallet?: Wallet;
}

export async function createProfileWallet(
  profileId: string,
  data: WalletFormData
): Promise<Wallet> {
  const body: Record<string, unknown> = {
    ...data,
    profile_id: profileId,
    label: data.label?.trim() || 'Main',
  };

  for (const key of [
    'address_or_xpub',
    'lightning_address',
    'nwc_connection_uri',
    'description',
  ] as const) {
    const value = body[key];
    if (typeof value !== 'string' || value.trim() === '') {
      delete body[key];
    }
  }

  const res = await fetch(API_ROUTES.WALLETS.BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await unwrapApiResponse<CreatedWalletPayload>(
    res,
    'Could not save that destination.'
  );
  if (!payload.wallet?.id) {
    throw new Error('Could not save that destination.');
  }
  return payload.wallet;
}
