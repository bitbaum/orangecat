/**
 * A GET whose connection can only ever reach a public address.
 *
 * checkPublicUrl (ssrfGuard.ts) resolves a hostname and checks the answer,
 * but the request then resolves it again, so a name that answers a public
 * address to the check and a private one to the request (DNS rebinding) gets
 * through: its header says so and accepts the risk. Here the check is the
 * request's own lookup: every address the connection could use is checked,
 * and the socket connects only to one that passed. Only the default ports,
 * no redirect followed, the body never read.
 */
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { isPrivateAddress } from './private-address';

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void;

/** A lookup that fails when the name resolves to any private or reserved address. */
export function publicOnlyLookup(
  hostname: string,
  options: { all?: boolean } | number | undefined,
  callback: LookupCallback
): void {
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) {
      callback(err, []);
      return;
    }
    if (addresses.length === 0 || addresses.some(a => isPrivateAddress(a.address))) {
      const refused = Object.assign(new Error('resolves to a private or reserved address'), {
        code: 'EPRIVATEADDR',
      });
      callback(refused, []);
      return;
    }
    if (typeof options === 'object' && options?.all) {
      callback(null, addresses);
      return;
    }
    callback(null, addresses[0].address, addresses[0].family);
  });
}

export class PinnedGetRefused extends Error {}

/** GET the URL and resolve to its status code. Rejects on a refused target, a network error or the timeout. */
export function pinnedGetStatus(rawUrl: string, timeoutMs: number): Promise<number> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return Promise.reject(new PinnedGetRefused('not a valid URL'));
  }
  const https = url.protocol === 'https:';
  if (!https && url.protocol !== 'http:') {
    return Promise.reject(new PinnedGetRefused('only http(s) URLs are allowed'));
  }
  if (url.port && url.port !== (https ? '443' : '80')) {
    return Promise.reject(new PinnedGetRefused('only the default port is asked'));
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isPrivateAddress(host)) {
    return Promise.reject(new PinnedGetRefused('IP address is private or reserved'));
  }
  return new Promise<number>((resolve, reject) => {
    const req = (https ? httpsRequest : httpRequest)(
      url,
      {
        method: 'GET',
        headers: { accept: 'text/html,*/*', 'user-agent': 'OrangeCat live check' },
        lookup: publicOnlyLookup as never,
        timeout: timeoutMs,
      },
      res => {
        resolve(res.statusCode ?? 0);
        res.destroy();
      }
    );
    req.on('timeout', () =>
      req.destroy(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
    );
    req.on('error', reject);
    req.end();
  });
}

export interface PinnedText {
  status: number;
  contentType: string;
  text: string;
  /** The address the body finally came from, after redirects. */
  url: string;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/**
 * GET the URL and read its body as text, from public addresses only, through
 * the same pinned lookup. Follows up to `maxRedirects` redirects, each one
 * checked again (a calendar host often answers from another server). Stops
 * reading past `maxBytes` and rejects: a calendar file, not a download.
 */
export async function pinnedGetText(
  rawUrl: string,
  opts: { timeoutMs: number; maxBytes: number; maxRedirects?: number; accept?: string }
): Promise<PinnedText> {
  let current = rawUrl;
  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    const answer = await getOnce(current, opts);
    if (!REDIRECTS.has(answer.status) || !answer.location) {
      return { ...answer, url: current };
    }
    current = new URL(answer.location, current).toString();
  }
  throw new PinnedGetRefused('too many redirects');
}

function getOnce(
  rawUrl: string,
  opts: { timeoutMs: number; maxBytes: number; accept?: string }
): Promise<{ status: number; contentType: string; text: string; location: string | null }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return Promise.reject(new PinnedGetRefused('not a valid URL'));
  }
  const https = url.protocol === 'https:';
  if (!https && url.protocol !== 'http:') {
    return Promise.reject(new PinnedGetRefused('only http(s) URLs are allowed'));
  }
  if (url.port && url.port !== (https ? '443' : '80')) {
    return Promise.reject(new PinnedGetRefused('only the default port is asked'));
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isPrivateAddress(host)) {
    return Promise.reject(new PinnedGetRefused('IP address is private or reserved'));
  }
  return new Promise((resolve, reject) => {
    const req = (https ? httpsRequest : httpRequest)(
      url,
      {
        method: 'GET',
        headers: { accept: opts.accept ?? '*/*', 'user-agent': 'OrangeCat calendar' },
        lookup: publicOnlyLookup as never,
        timeout: opts.timeoutMs,
      },
      res => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === 'string' ? res.headers.location : null;
        const contentType = String(res.headers['content-type'] ?? '');
        if (REDIRECTS.has(status)) {
          res.destroy();
          resolve({ status, contentType, text: '', location });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > opts.maxBytes) {
            res.destroy();
            reject(new PinnedGetRefused('the answer is larger than allowed'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () =>
          resolve({ status, contentType, text: Buffer.concat(chunks).toString('utf8'), location })
        );
        res.on('error', reject);
      }
    );
    req.on('timeout', () =>
      req.destroy(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
    );
    req.on('error', reject);
    req.end();
  });
}
