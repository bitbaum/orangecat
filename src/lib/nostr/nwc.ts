/**
 * Nostr Wallet Connect (NWC) Client
 *
 * Implements NIP-47 (Nostr Wallet Connect) for non-custodial Lightning payments.
 * Users paste their NWC connection string from their wallet (Alby, Mutiny, etc.)
 * and OrangeCat can request payments through the Nostr relay.
 *
 * Created: 2026-02-25
 */

import { finalizeEvent, Relay, nip04 } from 'nostr-tools';
import type { EventTemplate } from 'nostr-tools';
import type { NWCConnection, NWCResponse, NWCInvoice, NWCBalanceResponse } from './types';
import { logger } from '@/utils/logger';

// NWC event kinds (NIP-47)
const NWC_REQUEST_KIND = 23194;
const NWC_RESPONSE_KIND = 23195;

/** Timeout for NWC requests (30 seconds) */
const NWC_TIMEOUT_MS = 30_000;

/**
 * Parse a nostr+walletconnect:// URI into connection details
 *
 * Format: nostr+walletconnect://<wallet_pubkey>?relay=<relay_url>&secret=<secret>&lud16=<lnaddress>
 */
export function parseNWCUri(uri: string): NWCConnection {
  const cleaned = uri.trim();

  if (!cleaned.startsWith('nostr+walletconnect://')) {
    throw new Error('Invalid NWC URI: must start with nostr+walletconnect://');
  }

  const withoutScheme = cleaned.replace('nostr+walletconnect://', '');
  const [walletPubkey, queryString] = withoutScheme.split('?');

  if (!walletPubkey || !queryString) {
    throw new Error('Invalid NWC URI: missing wallet pubkey or parameters');
  }

  const params = new URLSearchParams(queryString);
  const relayUrl = params.get('relay');
  const secret = params.get('secret');
  const lud16 = params.get('lud16') || undefined;

  if (!relayUrl) {
    throw new Error('Invalid NWC URI: missing relay parameter');
  }
  if (!secret) {
    throw new Error('Invalid NWC URI: missing secret parameter');
  }

  return { walletPubkey, relayUrl, secret, lud16 };
}

/**
 * Validate an NWC URI without connecting
 */
export function isValidNWCUri(uri: string): boolean {
  try {
    parseNWCUri(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * NWC Client - handles communication with a Nostr Wallet Connect relay
 */
export class NWCClient {
  private connection: NWCConnection;
  private relay: Relay | null = null;
  private secretKeyBytes: Uint8Array;
  private timeoutMs: number;

  /** `timeoutMs` bounds the relay connect and each request (default 30s). A
   *  caller inside an HTTP request needs less: the reverse proxy gives up
   *  first and the payer sees a bare 502 (QA 2026-11-10, /pay/cato ~35s). */
  constructor(connectionUri: string, opts: { timeoutMs?: number } = {}) {
    this.timeoutMs = opts.timeoutMs ?? NWC_TIMEOUT_MS;
    this.connection = parseNWCUri(connectionUri);
    this.secretKeyBytes = Uint8Array.from(Buffer.from(this.connection.secret, 'hex'));
  }

  /** Connect to the NWC relay */
  async connect(): Promise<void> {
    if (this.relay) {
      return;
    }

    try {
      this.relay = await Promise.race([
        Relay.connect(this.connection.relayUrl),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('NWC relay connect timed out')), this.timeoutMs)
        ),
      ]);
      logger.info('NWC relay connected', { relay: this.connection.relayUrl });
    } catch (error) {
      logger.error('NWC relay connection failed', {
        relay: this.connection.relayUrl,
        error,
      });
      throw new Error(`Failed to connect to NWC relay: ${this.connection.relayUrl}`);
    }
  }

  /** Disconnect from the NWC relay */
  disconnect(): void {
    if (this.relay) {
      this.relay.close();
      this.relay = null;
      logger.info('NWC relay disconnected');
    }
  }

  /** Check if connected */
  get isConnected(): boolean {
    return this.relay !== null;
  }

  /** Get the wallet's Lightning address if provided in NWC URI */
  get lightningAddress(): string | undefined {
    return this.connection.lud16;
  }

  /**
   * Send an NWC request and wait for the response
   */
  private async sendRequest<T>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<NWCResponse<T>> {
    if (!this.relay) {
      await this.connect();
    }

    const relay = this.relay!;
    const content = JSON.stringify({ method, params });

    // Encrypt content with NIP-04 (shared secret with wallet)
    const encrypted = await nip04.encrypt(
      this.secretKeyBytes,
      this.connection.walletPubkey,
      content
    );

    // Build and sign the NWC request event
    const eventTemplate: EventTemplate = {
      kind: NWC_REQUEST_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', this.connection.walletPubkey]],
      content: encrypted,
    };

    const signedEvent = finalizeEvent(eventTemplate, this.secretKeyBytes);

    // Subscribe to response BEFORE publishing request
    return new Promise<NWCResponse<T>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        sub.close();
        reject(new Error(`NWC request timed out: ${method}`));
      }, this.timeoutMs);

      const sub = relay.subscribe(
        [
          {
            kinds: [NWC_RESPONSE_KIND],
            authors: [this.connection.walletPubkey],
            '#e': [signedEvent.id],
          },
        ],
        {
          onevent: async (event: { content: string }) => {
            clearTimeout(timeout);
            sub.close();

            try {
              const decrypted = await nip04.decrypt(
                this.secretKeyBytes,
                this.connection.walletPubkey,
                event.content
              );
              const response = JSON.parse(decrypted) as NWCResponse<T>;
              resolve(response);
            } catch (error) {
              reject(new Error(`Failed to decrypt NWC response: ${error}`));
            }
          },
          oneose: () => {
            // End of stored events - keep waiting for new ones
          },
        }
      );

      // Publish the request
      relay.publish(signedEvent).catch((error: unknown) => {
        clearTimeout(timeout);
        sub.close();
        reject(new Error(`Failed to publish NWC request: ${error}`));
      });
    });
  }

  /**
   * Create a Lightning invoice (make_invoice)
   */
  async makeInvoice(
    amountSats: number,
    description?: string,
    expiry?: number
  ): Promise<NWCInvoice> {
    const amountMsats = amountSats * 1000;

    const response = await this.sendRequest<NWCInvoice>('make_invoice', {
      amount: amountMsats,
      description,
      expiry: expiry ?? 3600, // default 1 hour
    });

    if (response.error) {
      throw new Error(
        `NWC make_invoice failed: ${response.error.message} (${response.error.code})`
      );
    }

    if (!response.result) {
      throw new Error('NWC make_invoice returned empty result');
    }

    return response.result;
  }

  /**
   * Pay a Lightning invoice (pay_invoice)
   */
  async payInvoice(bolt11: string, amountMsats?: number): Promise<NWCInvoice> {
    const params: Record<string, unknown> = { invoice: bolt11 };
    if (amountMsats !== undefined) {
      params.amount = amountMsats;
    }

    const response = await this.sendRequest<NWCInvoice>('pay_invoice', params);

    if (response.error) {
      throw new Error(`NWC pay_invoice failed: ${response.error.message} (${response.error.code})`);
    }

    if (!response.result) {
      throw new Error('NWC pay_invoice returned empty result');
    }

    return response.result;
  }

  /**
   * Look up an invoice by payment hash
   */
  async lookupInvoice(paymentHash: string): Promise<NWCInvoice> {
    const response = await this.sendRequest<NWCInvoice>('lookup_invoice', {
      payment_hash: paymentHash,
    });

    if (response.error) {
      throw new Error(
        `NWC lookup_invoice failed: ${response.error.message} (${response.error.code})`
      );
    }

    if (!response.result) {
      throw new Error('NWC lookup_invoice returned empty result');
    }

    return response.result;
  }

  /**
   * Get wallet balance in sats
   */
  async getBalance(): Promise<number> {
    const response = await this.sendRequest<NWCBalanceResponse>('get_balance');

    if (response.error) {
      throw new Error(`NWC get_balance failed: ${response.error.message} (${response.error.code})`);
    }

    if (!response.result) {
      throw new Error('NWC get_balance returned empty result');
    }

    // Balance is in msats, convert to sats
    return Math.floor(response.result.balance / 1000);
  }

  /**
   * Get wallet info (supported methods, etc.)
   */
  async getInfo(): Promise<Record<string, unknown>> {
    const response = await this.sendRequest<Record<string, unknown>>('get_info');

    if (response.error) {
      throw new Error(`NWC get_info failed: ${response.error.message} (${response.error.code})`);
    }

    return response.result ?? {};
  }
}
