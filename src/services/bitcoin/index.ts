import {
  BitcoinTransaction,
  BitcoinWalletData,
  type MempoolAddressInfo,
  type BlockstreamAddressInfo,
  type MempoolTransaction,
  type BlockstreamTransaction,
} from '@/types/bitcoin';
import { getErrorMessage } from '@/types/common';
import { logger } from '@/utils/logger';
import { satsToBitcoin } from '@/services/currency';
import { BITCOIN_FETCH_TIMEOUT_MS } from '@/lib/wallets/constants';

/**
 * BITCOIN SERVICE - CLASS-BASED ARCHITECTURE WITH DEPENDENCY INJECTION
 *
 * CRITICAL FOR FINANCIAL PLATFORM:
 * - Handles Bitcoin address validation and wallet data fetching
 * - Supports multiple API providers with fallback
 * - Proper error handling for financial data
 * - Dependency injection for testability
 */

const API_TIMEOUT_MS = BITCOIN_FETCH_TIMEOUT_MS;

// Transaction input/output types for processing
interface TransactionInput {
  prevout?: {
    scriptpubkey_address?: string;
    value?: number;
  };
}

interface TransactionOutput {
  scriptpubkey_address?: string;
  value?: number;
}

interface RawTransaction {
  txid?: string;
  vin?: TransactionInput[];
  vout?: TransactionOutput[];
  status?: {
    confirmed?: boolean;
    block_time?: number;
  };
}

// Types for provider configuration
interface APIProvider {
  name: string;
  baseUrl: string;
  addressEndpoint: (address: string) => string;
  txsEndpoint: (address: string) => string;
  processBalance: (data: MempoolAddressInfo | BlockstreamAddressInfo) => number;
  processTransactions: (
    data: MempoolTransaction[] | BlockstreamTransaction[],
    address: string
  ) => BitcoinTransaction[];
}

// Types for fetch interface (for dependency injection)
interface FetchInterface {
  (url: string, options?: RequestInit): Promise<Response>;
}

/**
 * mempool.space and blockstream.info both serve the Esplora API, so a balance
 * and a transaction list are read the same way from either. These two readers
 * were written out once per provider — 60 identical lines — which is one place
 * for the satoshi arithmetic to be fixed and another for it to stay wrong.
 */
function processEsploraBalance(data: MempoolAddressInfo | BlockstreamAddressInfo): number {
  if (!data || !data.chain_stats) {
    return 0;
  }
  const funded = Number(data.chain_stats.funded_txo_sum) || 0;
  const spent = Number(data.chain_stats.spent_txo_sum) || 0;

  // Sanitize numbers to prevent Infinity/NaN
  const sanitizedFunded = isFinite(funded) ? funded : 0;
  const sanitizedSpent = isFinite(spent) ? spent : 0;

  return Math.max(0, sanitizedFunded - sanitizedSpent);
}

function processEsploraTransactions(
  data: MempoolTransaction[] | BlockstreamTransaction[],
  address: string
): BitcoinTransaction[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.slice(0, 10).map((rawTx): BitcoinTransaction => {
    const tx = rawTx as unknown as RawTransaction;
    let txType: 'incoming' | 'outgoing' = 'incoming';
    let valueInSatoshis = 0;

    const inputsFromAddress =
      tx.vin?.filter(
        (input: TransactionInput) =>
          input.prevout && input.prevout.scriptpubkey_address === address
      ) || [];
    const outputsToAddress =
      tx.vout?.filter((output: TransactionOutput) => output.scriptpubkey_address === address) || [];

    if (inputsFromAddress.length > 0) {
      txType = 'outgoing';
      let amountSentToOthers = 0;
      for (const output of tx.vout || []) {
        if (output.scriptpubkey_address !== address) {
          amountSentToOthers += Number(output.value) || 0;
        }
      }
      if (amountSentToOthers > 0) {
        valueInSatoshis = amountSentToOthers;
      } else {
        const totalValueFromInputs = inputsFromAddress.reduce(
          (sum: number, input: TransactionInput) => sum + (Number(input.prevout?.value) || 0),
          0
        );
        valueInSatoshis = totalValueFromInputs;
      }
    } else if (outputsToAddress.length > 0) {
      txType = 'incoming';
      valueInSatoshis = outputsToAddress.reduce(
        (sum: number, output: TransactionOutput) => sum + (Number(output.value) || 0),
        0
      );
    } else {
      valueInSatoshis = 0;
    }

    return {
      txid: tx.txid || 'unknown',
      value: satsToBitcoin(valueInSatoshis),
      status: tx.status?.confirmed ? 'confirmed' : 'pending',
      timestamp: tx.status?.block_time ? tx.status.block_time * 1000 : Date.now(),
      type: txType,
    };
  });
}

class BitcoinService {
  private static instance: BitcoinService;
  private fetchFn: FetchInterface;
  private providers: APIProvider[];

  static getInstance(): BitcoinService {
    if (!BitcoinService.instance) {
      BitcoinService.instance = new BitcoinService();
    }
    return BitcoinService.instance;
  }

  constructor(fetchImplementation?: FetchInterface) {
    // Only use global fetch if it's available and no implementation is provided
    this.fetchFn =
      fetchImplementation ||
      (typeof fetch !== 'undefined'
        ? fetch.bind(globalThis)
        : ((() => {
            throw new Error('Fetch implementation is required in this environment');
          }) as FetchInterface));
    this.providers = this.getAPIProviders();
  }

  private getAPIProviders(): APIProvider[] {
    return [
      {
        name: 'mempool.space',
        baseUrl: 'https://mempool.space/api',
        addressEndpoint: (address: string) => `/address/${address}`,
        txsEndpoint: (address: string) => `/address/${address}/txs`,
        processBalance: processEsploraBalance,
        processTransactions: processEsploraTransactions,
      },
      {
        name: 'blockstream.info',
        baseUrl: 'https://blockstream.info/api',
        addressEndpoint: (address: string) => `/address/${address}`,
        txsEndpoint: (address: string) => `/address/${address}/txs`,
        processBalance: processEsploraBalance,
        processTransactions: processEsploraTransactions,
      },
    ];
  }

  // Helper function to fetch with timeout
  private async fetchWithTimeout(url: string, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.fetchFn(url, { signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  // Clean Bitcoin address from URI if needed
  cleanBitcoinAddress(address: string): string {
    if (!address) {
      return '';
    }
    return address.startsWith('bitcoin:') ? address.split('?')[0].replace('bitcoin:', '') : address;
  }

  // Get balance for a Bitcoin address
  async getBalance(
    address: string
  ): Promise<{ confirmed: number; unconfirmed: number; total: number; error?: string }> {
    try {
      const walletData = await this.fetchBitcoinWalletData(address);
      const confirmed = Number(walletData.balance) || 0;
      const unconfirmed = 0; // FUTURE: Track unconfirmed balance — requires mempool API integration (e.g. mempool.space) to surface pending transactions
      return {
        confirmed,
        unconfirmed,
        total: confirmed + unconfirmed,
      };
    } catch (error: unknown) {
      return {
        confirmed: 0,
        unconfirmed: 0,
        total: 0,
        error: getErrorMessage(error),
      };
    }
  }

  // Get transactions for a Bitcoin address
  async getTransactions(address: string): Promise<BitcoinTransaction[]> {
    try {
      const walletData = await this.fetchBitcoinWalletData(address);
      return walletData.transactions;
    } catch (error: unknown) {
      logger.error('Error fetching transactions:', getErrorMessage(error), 'Bitcoin');
      return [];
    }
  }

  // Fetch wallet data with failover between different providers
  async fetchBitcoinWalletData(address: string): Promise<BitcoinWalletData> {
    const cleanAddress = this.cleanBitcoinAddress(address);

    // Validate address before making API calls
    if (!cleanAddress) {
      throw new Error('Invalid or empty Bitcoin address');
    }

    // Basic Bitcoin address validation
    const bitcoinAddressRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/;
    if (!bitcoinAddressRegex.test(cleanAddress)) {
      throw new Error('Invalid Bitcoin address format');
    }

    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        const addressUrl = `${provider.baseUrl}${provider.addressEndpoint(cleanAddress)}`;
        const addressResponse = await this.fetchWithTimeout(addressUrl, API_TIMEOUT_MS);

        if (!addressResponse || !addressResponse.ok) {
          const errorText = addressResponse ? await addressResponse.text() : 'No response';
          logger.warn(
            `API Error from ${provider.name} (Address - ${addressResponse?.status || 'unknown'}): ${errorText}`,
            undefined,
            'Bitcoin'
          );
          lastError = new Error(
            `Provider ${provider.name} address fetch failed: ${addressResponse?.status || 'unknown'}`
          );
          continue;
        }

        const addressData = await addressResponse.json();
        const balanceInSatoshis = provider.processBalance(addressData);

        const txsUrl = `${provider.baseUrl}${provider.txsEndpoint(cleanAddress)}`;
        const txsResponse = await this.fetchWithTimeout(txsUrl, API_TIMEOUT_MS);

        if (!txsResponse || !txsResponse.ok) {
          const errorText = txsResponse ? await txsResponse.text() : 'No response';
          logger.warn(
            `API Error from ${provider.name} (Transactions - ${txsResponse?.status || 'unknown'}): ${errorText}`,
            undefined,
            'Bitcoin'
          );
          lastError = new Error(
            `Provider ${provider.name} transactions fetch failed: ${txsResponse?.status || 'unknown'}`
          );
          continue;
        }

        const txsData = await txsResponse.json();
        const transactions = provider.processTransactions(txsData, cleanAddress);

        return {
          balance: satsToBitcoin(balanceInSatoshis),
          address: cleanAddress,
          transactions,
          network: 'mainnet' as const,
          lastUpdated: new Date().toISOString(),
        };
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        logger.error(`Error with provider ${provider.name}:`, errorMessage, 'Bitcoin');
        lastError = error instanceof Error ? error : new Error(errorMessage);
        // Continue to next provider
      }
    }

    logger.error(
      `Failed to fetch wallet data for ${cleanAddress} from all providers`,
      { error: getErrorMessage(lastError) },
      'Bitcoin'
    );
    throw (
      lastError ||
      new Error('Failed to fetch wallet data from any provider for address: ' + cleanAddress)
    );
  }

  // Get mempool.space transaction URL
  getTransactionUrl(txid: string): string {
    return `https://mempool.space/tx/${txid}`;
  }

  // Get mempool.space address URL
  getAddressUrl(address: string): string {
    return `https://mempool.space/address/${this.cleanBitcoinAddress(address)}`;
  }
}

const bitcoinService = BitcoinService.getInstance();

export const fetchBitcoinWalletData = (address: string) =>
  bitcoinService.fetchBitcoinWalletData(address);
