'use client';

/**
 * "Your Loki account runs on an xAI key. Add the same key here."
 *
 * The two products share one person and did not share what they knew about
 * that person's keys (services/ai/keys-elsewhere). Shown only when Loki holds
 * a key for a provider the Cat can use and this account has none for it. The
 * key itself is never fetched: the person pastes it in the form below.
 */
import { useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import type { KeyElsewhere } from '@/services/ai/keys-elsewhere';

export function KeysOnLokiHint() {
  const [keys, setKeys] = useState<KeyElsewhere[]>([]);

  useEffect(() => {
    let live = true;
    fetch(API_ROUTES.USER.API_KEYS_ELSEWHERE, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        const found = json?.data?.loki;
        if (live && Array.isArray(found)) {
          setKeys(found as KeyElsewhere[]);
        }
      })
      // A suggestion that cannot load is no suggestion; nothing to report.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (keys.length === 0) {
    return null;
  }
  return (
    <ul className="mt-4 space-y-2" aria-label="Keys you have on Loki">
      {keys.map(key => (
        <li
          key={key.provider}
          className="rounded-md border border-default bg-surface-raised p-3 text-sm text-fg-primary"
        >
          <p className="mb-0">
            Your Loki account runs on a {key.name} key{key.keyHint ? ` (${key.keyHint})` : ''}. Add
            the same key here and Cat runs on it too, instead of the shared free pool.
          </p>
          {key.apiKeyUrl && (
            <a
              href={key.apiKeyUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Open your {key.name} keys
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
