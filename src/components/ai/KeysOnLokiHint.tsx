'use client';

/**
 * "Loki already has your xAI key. Use it for your bots here too?"
 *
 * The two products share one person and did not share what they knew about
 * that person's keys (services/ai/keys-elsewhere). Shown only when Loki holds
 * a key for a provider this account has none for. The key is never fetched
 * and never copied: one tap switches it on, and Loki then answers this
 * person's bots with it. Where Loki cannot do that, the person is pointed at
 * the form below.
 */
import { useCallback, useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import type { KeyElsewhere } from '@/services/ai/keys-elsewhere';

export function KeysOnLokiHint() {
  const [keys, setKeys] = useState<KeyElsewhere[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

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

  const turn = useCallback(async (provider: string, on: boolean) => {
    setBusy(provider);
    setProblem(null);
    try {
      const res = await fetch(API_ROUTES.USER.API_KEYS_ELSEWHERE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, on }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setProblem(
          (typeof json?.error === 'string' ? json.error : json?.error?.message) ||
            'That did not work. Try again in a moment.'
        );
        return;
      }
      setKeys(list => list.map(k => (k.provider === provider ? { ...k, shared: on } : k)));
    } catch {
      setProblem('That did not work. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  }, []);

  if (keys.length === 0) {
    return null;
  }
  return (
    <ul className="mt-4 space-y-2" aria-label="Keys you have on Loki">
      {keys.map(key => {
        const hint = key.keyHint ? ` (${key.keyHint})` : '';
        return (
          <li
            key={key.provider}
            className="rounded-md border border-default bg-surface-raised p-3 text-sm text-fg-primary"
          >
            {key.shared ? (
              <p className="mb-0">
                Your bots here answer on your {key.name} key from Loki{hint}. The key stays on Loki.
              </p>
            ) : key.canShare ? (
              <p className="mb-0">
                Loki already has your {key.name} key{hint}. Use it for your bots here too? The key
                stays on Loki and is not copied.
              </p>
            ) : (
              <p className="mb-0">
                Loki already has your {key.name} key{hint}. Add the same key here and Cat runs on it
                too, instead of the shared free pool.
              </p>
            )}
            {key.canShare ? (
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                disabled={busy === key.provider}
                onClick={() => turn(key.provider, !key.shared)}
              >
                {key.shared ? `Stop using my ${key.name} key` : `Use my ${key.name} key here`}
              </Button>
            ) : (
              key.apiKeyUrl && (
                <a
                  href={key.apiKeyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  Open your {key.name} keys
                </a>
              )
            )}
          </li>
        );
      })}
      {problem && (
        <li role="alert" className="text-sm text-fg-secondary">
          {problem}
        </li>
      )}
    </ul>
  );
}
