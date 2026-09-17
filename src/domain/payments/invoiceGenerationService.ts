/**
 * Invoice Generation Service
 *
 * Creates invoices using the resolved payment method:
 * - NWC: make_invoice via Nostr Wallet Connect
 * - Lightning Address: LNURL-pay protocol
 * - On-chain: BIP21 URI
 */

import { NWCClient } from '@/lib/nostr/nwc';
import { materializeOnchainAddress } from './walletResolutionService';
import type { ResolvedWallet } from './types';
import { logger } from '@/utils/logger';
import { bitcoinToSats } from '@/services/currency';

interface GeneratedInvoice {
  /** BOLT11 invoice string (Lightning) or null (on-chain) */
  bolt11: string | null;
  /** Payment hash for NWC lookups */
  payment_hash: string | null;
  /** On-chain BTC address */
  onchain_address: string | null;
  /** LUD-21 verify URL (lightning_address only, when the provider supports it) */
  lnurl_verify_url: string | null;
  /** QR code data (bolt11 uppercased, or bitcoin: URI) */
  qr_data: string;
  /** When the invoice expires (ISO string) */
  expires_at: string | null;
}

const LIGHTNING_INVOICE_EXPIRY_SECS = 3600; // 1 hour

/**
 * Generate an invoice for a payment using the resolved wallet.
 */
export async function generateInvoice(
  wallet: ResolvedWallet,
  amountBtc: number,
  description: string
): Promise<GeneratedInvoice> {
  switch (wallet.method) {
    case 'nwc':
      try {
        return await generateNWCInvoice(wallet.nwc_uri!, amountBtc, description);
      } catch (error) {
        // An NWC connection can be authorised for one direction only. Coinos
        // issues send-only connections (`pay_invoice` without `make_invoice`),
        // and NWC outranks every other rail — so connecting one to enable
        // payouts made this throw and took the owner's ENTIRE receiving path
        // down with it. Observed in production 2026-09-07: every invoice on
        // catomean@orangecat.ch failed with "Could not create an invoice right
        // now" until the connection was pulled back out.
        //
        // A rail that cannot mint an invoice is not a receiving rail. Fall
        // through to one that is, rather than failing the payment.
        if (!wallet.lightning_address) {
          throw error;
        }
        logger.warn(
          'NWC cannot mint invoices (likely a send-only connection); receiving via the lightning address instead',
          { walletId: wallet.wallet_id, error }
        );
        return generateLightningAddressInvoice(wallet.lightning_address, amountBtc, description);
      }

    case 'lightning_address':
      return generateLightningAddressInvoice(wallet.lightning_address!, amountBtc, description);

    case 'onchain': {
      // A wallet configured with an xpub has no address yet — derive a fresh,
      // never-reused one here, at the single point every invoice passes
      // through. Uniqueness per invoice is what makes on-chain settlement
      // detection sound.
      const materialized = await materializeOnchainAddress(wallet);
      return generateOnchainInvoice(materialized.onchain_address!, amountBtc, description);
    }

    default:
      throw new Error(`Unsupported payment method: ${wallet.method}`);
  }
}

/**
 * NWC: Create invoice via Nostr Wallet Connect relay
 */
async function generateNWCInvoice(
  nwcUri: string,
  amountBtc: number,
  description: string
): Promise<GeneratedInvoice> {
  const client = new NWCClient(nwcUri);
  // NWC protocol uses sats
  const amountSats = bitcoinToSats(amountBtc);

  try {
    await client.connect();
    const invoice = await client.makeInvoice(
      amountSats,
      description,
      LIGHTNING_INVOICE_EXPIRY_SECS
    );

    const expiresAt = new Date(Date.now() + LIGHTNING_INVOICE_EXPIRY_SECS * 1000).toISOString();

    return {
      bolt11: invoice.invoice,
      payment_hash: invoice.payment_hash,
      onchain_address: null,
      lnurl_verify_url: null,
      qr_data: invoice.invoice.toUpperCase(), // Uppercase for QR efficiency
      expires_at: expiresAt,
    };
  } catch (error) {
    logger.error('NWC invoice generation failed', { error });
    throw new Error('Failed to generate Lightning invoice via NWC');
  } finally {
    client.disconnect();
  }
}

/**
 * Lightning Address: Fetch invoice via LNURL-pay protocol
 */
async function generateLightningAddressInvoice(
  lightningAddress: string,
  amountBtc: number,
  description: string
): Promise<GeneratedInvoice> {
  // Step 1: Resolve Lightning Address to LNURL-pay endpoint
  // Lightning address format: user@domain.com -> https://domain.com/.well-known/lnurlp/user
  const [user, domain] = lightningAddress.split('@');
  if (!user || !domain) {
    throw new Error(`Invalid Lightning Address: ${lightningAddress}`);
  }

  const lnurlpUrl = `https://${domain}/.well-known/lnurlp/${user}`;

  // Step 2: Fetch LNURL-pay metadata
  const metaResponse = await fetch(lnurlpUrl);
  if (!metaResponse.ok) {
    throw new Error(`LNURL-pay endpoint returned ${metaResponse.status}`);
  }

  const meta = await metaResponse.json();

  if (meta.tag !== 'payRequest') {
    throw new Error('LNURL endpoint is not a pay request');
  }

  // LNURL-pay protocol uses millisatoshis
  const amountSats = bitcoinToSats(amountBtc);
  const amountMsats = amountSats * 1000;

  // Validate amount is within bounds
  if (amountMsats < meta.minSendable || amountMsats > meta.maxSendable) {
    throw new Error(
      `Amount ${amountSats} sat is outside allowed range: ${meta.minSendable / 1000}-${meta.maxSendable / 1000} sat`
    );
  }

  // Step 3: Request invoice from callback URL
  const callbackUrl = new URL(meta.callback);
  callbackUrl.searchParams.set('amount', amountMsats.toString());
  if (description) {
    callbackUrl.searchParams.set('comment', description);
  }

  const invoiceResponse = await fetch(callbackUrl.toString());
  if (!invoiceResponse.ok) {
    throw new Error(`LNURL callback returned ${invoiceResponse.status}`);
  }

  const invoiceData = await invoiceResponse.json();

  if (!invoiceData.pr) {
    throw new Error('LNURL callback did not return a payment request');
  }

  // LUD-21: providers like Alby and Coinos return a `verify` URL alongside the
  // invoice. Polling it lets us detect settlement trustlessly — without it the
  // flow degrades to buyer-confirmed ("I've paid").
  const verifyUrl =
    typeof invoiceData.verify === 'string' && invoiceData.verify.startsWith('https://')
      ? invoiceData.verify
      : null;

  return {
    bolt11: invoiceData.pr,
    payment_hash: null, // LNURL-pay doesn't always return payment_hash directly
    onchain_address: null,
    lnurl_verify_url: verifyUrl,
    qr_data: invoiceData.pr.toUpperCase(),
    expires_at: new Date(Date.now() + LIGHTNING_INVOICE_EXPIRY_SECS * 1000).toISOString(),
  };
}

/**
 * On-chain: Generate BIP21 URI for QR code
 */
async function generateOnchainInvoice(
  address: string,
  amountBtc: number,
  description: string
): Promise<GeneratedInvoice> {
  // BIP21 format: bitcoin:<address>?amount=<btc>&label=<description>
  const params = new URLSearchParams();
  params.set('amount', amountBtc.toFixed(8));
  if (description) {
    params.set('label', description);
  }

  const bip21Uri = `bitcoin:${address}?${params.toString()}`;

  return {
    bolt11: null,
    payment_hash: null,
    onchain_address: address,
    lnurl_verify_url: null,
    qr_data: bip21Uri,
    // On-chain payments don't expire — address is valid forever
    expires_at: null,
  };
}
