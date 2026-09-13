# @orangecat/sdk

Official TypeScript SDK for the **OrangeCat platform API (v1)**. Built for
sibling products (Loki, hirn.li), third-party integrations, and
internal automation that lives outside the OrangeCat Next.js app.

> Authoritative machine-readable contract: **https://orangecat.ch/api/v1/openapi.json**
> Conventions (versioning, errors, idempotency, rate limits):
> [`docs/api/CONVENTIONS.md`](../../docs/api/CONVENTIONS.md) in the OrangeCat repo.

## Install

```bash
npm install @orangecat/sdk
```

Requires Node ≥ 18 (for global `fetch` and `crypto.getRandomValues`).

## Quick start

```ts
import { OrangeCatClient } from '@orangecat/sdk';

const orangecat = new OrangeCatClient({
  apiKey: process.env.ORANGECAT_API_KEY!,
  // baseUrl defaults to https://orangecat.ch
});

// Confirm the server speaks v1 (recommended at process startup).
const discovery = await orangecat.discovery();
if (discovery.version !== 'v1') {
  throw new Error(`Server speaks ${discovery.version}, this SDK speaks v1`);
}

// Create a service on behalf of the actor bound to your key.
const service = await orangecat.services.create({
  title: 'Claude Max',
  description: 'Loki user subscription',
  category: 'subscription',
  fixed_price: 0.001,
  currency: 'BTC',
});
```

## Authentication

Mint an integration key at **/settings/integrations** in your OrangeCat
account. Format: `ock_<48-hex>`. Keys are bound to a single actor (personal
or group) at mint time — every request authenticates as that actor. Treat
the key like a password: it's shown once and we only store the SHA-256
hash.

```bash
# .env
ORANGECAT_API_KEY=ock_…
```

## Resources

Each of the nine v1 entity types (`products`, `services`, `projects`,
`causes`, `events`, `loans`, `investments`, `assets`, `wishlists`)
exposes the same three methods:

```ts
// Create one entity. Integration-key auth attributes ownership to the
// key's bound actor; the body actor_id field is ignored.
const product = await orangecat.products.create({ title: 'My product', price: 0.0001 });

// List entities. Integration-key auth scopes to the bound actor.
// Sessions return the caller's rows. Anonymous returns public rows.
const products = await orangecat.products.list({ limit: 20, offset: 0 });

// Get one entity by id. Throws OrangeCatError code='not_found' when
// the id doesn't exist OR isn't visible to the caller (same envelope
// either way so probers cannot distinguish — see docs §6).
const one = await orangecat.products.get(product.id);
```

Update + delete arrive when the server exposes PUT/DELETE under v1.

## Error handling

Every failure surfaces as `OrangeCatError`. Branch on `error.code`
(stable, machine-readable), never on `error.message`.

```ts
import { OrangeCatClient, OrangeCatError } from '@orangecat/sdk';

try {
  await orangecat.products.create({ title: 'My product', price: 0.0001 });
} catch (err) {
  if (err instanceof OrangeCatError) {
    switch (err.code) {
      case 'unauthorized':
        // refresh key
        break;
      case 'rate_limited':
        // honour err.retryAfter (seconds) — the SDK already retried
        // internally up to maxRetries
        break;
      case 'validation_error':
        console.error('Bad request', err.details);
        break;
      default:
        throw err;
    }
  } else {
    throw err;
  }
}
```

Error codes mirror `docs/api/CONVENTIONS.md` §3:
`unauthorized` `forbidden` `validation_error` `not_found` `conflict`
`rate_limited` `internal_error` `network_error` `timeout` `unknown`.

## Reliability features (built in by default)

| Feature             | Behaviour                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Timeout**         | 20 s per request (matches Loki's `useFetch`). Override per call with `{ timeoutMs }`.                                                                                                                                                             |
| **Retries**         | Up to 3 retries on transient failures (network, 5xx, 429). Exponential backoff with jitter, honours `Retry-After`. Override with `{ maxRetries }`.                                                                                                      |
| **Idempotency-Key** | Auto-generated on every mutating request (`ock_idem_<32-hex>`). Override with `{ idempotencyKey }` if you have your own dedup key. Server-side dedup is planned — the SDK ships the header today so retries are forward-compatible the moment it lands. |
| **Authorization**   | Sends both `X-OrangeCat-Key` and `Authorization: Bearer` headers so it works against any gateway.                                                                                                                                                       |
| **User-Agent**      | `@orangecat/sdk/<version> (node/<version>)` — server logs attribute traffic.                                                                                                                                                                            |
| **AbortSignal**     | Pass `{ signal }` to compose with your own cancellation.                                                                                                                                                                                                |

## Configuration

```ts
new OrangeCatClient({
  apiKey: 'ock_…', // required
  baseUrl: 'https://…', // default: 'https://orangecat.ch'
  timeoutMs: 20_000, // default: 20_000
  maxRetries: 3, // default: 3
  fetch: customFetch, // default: globalThis.fetch
  userAgent: 'my-app/1.0', // default: '@orangecat/sdk/<version> (node/<version>)'
});
```

## Versioning

This SDK targets **v1** of the OrangeCat API. The SDK's own version
follows semver:

- **patch** (`0.1.0` → `0.1.1`): bug fixes, never breaks consumers
- **minor** (`0.1.0` → `0.2.0`): new methods, new optional fields
- **major** (`0.x.y` → `1.0.0`): targeting a new API version, e.g. v2

When OrangeCat ships `/api/v2/`, this SDK will continue supporting v1 for
at least 12 months and a separate major version targets v2.

## License

UNLICENSED (proprietary). Contact integrations@orangecat.ch for terms.

## Status

**Pre-1.0 — interfaces may shift.** First stable: 1.0.0 ships alongside
Loki's first production use of the SDK.
