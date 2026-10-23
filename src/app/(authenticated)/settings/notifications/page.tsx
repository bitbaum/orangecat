'use client';

/**
 * Notification settings page.
 *
 * Surfaces the 5 category toggles + digest frequency from
 * NotificationPreferences. The GET/PUT API + schema have shipped since
 * 2026-03-27 (src/app/api/notifications/preferences/route.ts +
 * src/types/notification-preferences.ts); only the UI was missing —
 * the emailService's unsubscribe links pointed at /settings as a
 * fallback while the dedicated page didn't exist (open follow-up since
 * 2026-03 — this commit closes that loop).
 *
 * Per-type overrides (sparse map) are intentionally NOT surfaced here:
 * the 5 category toggles cover 99% of intent; an "advanced" panel can
 * land when a real user asks for finer control.
 *
 * Created: 2026-06-04
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, Loader2, LogIn } from 'lucide-react';
import { useRequireAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import Loading from '@/components/Loading';
import Button from '@/components/ui/Button';
import { logger } from '@/utils/logger';
import type { DigestFrequency, NotificationPreferences } from '@/types/notification-preferences';
import { CATEGORIES, DIGEST_OPTIONS } from '@/config/notification-settings';
import { formatClockTime } from '@/utils/locale';

/**
 * "Daily" is not offered, because nothing sends a daily digest: the only job
 * that reads this column is the weekly one, and it selected `= 'weekly'` — so
 * choosing Daily, the more engaged answer, silently meant NO digest at all.
 * Rows that already say 'daily' are now included by the weekly job (see
 * api/cron/weekly-digest) rather than being ignored, and this control shows
 * them as Weekly, which is what they will actually receive.
 */
/** A legacy 'daily' row receives the weekly digest, so show it as Weekly. */
function displayedDigest(value: DigestFrequency): DigestFrequency {
  return value === 'daily' ? 'weekly' : value;
}

export default function NotificationSettingsPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const savingRef = useRef(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    setLoading(true);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API_ROUTES.NOTIFICATIONS.PREFERENCES, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(`Failed to load (${res.status})`);
        }
        const json = (await res.json()) as { data: NotificationPreferences };
        if (!cancelled) {
          setPrefs(json.data);
          setLoading(false);
        }
      } catch (err) {
        logger.error('Failed to load notification preferences', { err });
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loadAttempt]);

  // Auto-save on every change — optimistic, reverting if the server rejects.
  // No "Save" button to forget (the old flow silently lost unsaved toggles).
  const persist = useCallback(
    async (next: NotificationPreferences, prev: NotificationPreferences) => {
      if (savingRef.current) {
        return;
      }
      savingRef.current = true;
      setPrefs(next); // optimistic
      setSaving(true);
      setError(null);
      setSavedAt(null);
      try {
        const body = {
          economic_emails: next.economic_emails,
          social_emails: next.social_emails,
          group_emails: next.group_emails,
          progress_emails: next.progress_emails,
          reengagement_emails: next.reengagement_emails,
          digest_frequency: next.digest_frequency,
        };
        const res = await fetch(API_ROUTES.NOTIFICATIONS.PREFERENCES, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errBody?.error || `Failed to save (${res.status})`);
        }
        const json = (await res.json()) as { data: NotificationPreferences };
        setPrefs(json.data);
        setSavedAt(formatClockTime(new Date()));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
        setPrefs(prev); // revert so the UI never lies about what's saved
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    []
  );

  function setToggle(key: (typeof CATEGORIES)[number]['key'], value: boolean) {
    if (!prefs) {
      return;
    }
    void persist({ ...prefs, [key]: value }, prefs);
  }

  function setDigest(value: DigestFrequency) {
    if (!prefs) {
      return;
    }
    void persist({ ...prefs, digest_frequency: value }, prefs);
  }

  if (authLoading) {
    return <Loading fullScreen message="Loading notifications..." />;
  }

  if (!user) {
    const returnTo = `${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(ROUTES.SETTINGS_NOTIFICATIONS)}`;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-subtle bg-surface-raised/30">
          <Bell className="h-5 w-5 text-fg-secondary" />
        </div>
        <h1 className="text-xl font-semibold text-fg-primary">Sign in to manage notifications</h1>
        <p className="mt-2 text-sm text-fg-secondary">
          Pick which emails you receive and how often you get the digest.
        </p>
        <Button href={returnTo} className="mt-6">
          <LogIn className="mr-1.5 h-4 w-4" />
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-fg-secondary">
        Transactional emails (auth, security) are always sent. Everything else is in your hands.
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-status-negative/30 bg-status-negative/5 px-3 py-2 text-sm text-status-negative"
        >
          {error}
          {!prefs && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLoadAttempt(n => n + 1)}
            >
              Retry loading preferences
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-subtle p-6 text-sm text-fg-secondary">
          Loading your preferences…
        </div>
      ) : prefs ? (
        <>
          <section className="rounded-lg border border-subtle">
            <div className="border-b border-subtle px-4 py-3">
              <h2 className="text-sm font-medium text-fg-primary">Categories</h2>
              <p className="mt-0.5 text-xs text-fg-secondary">
                Toggle whole families of emails on or off.
              </p>
            </div>
            <ul className="divide-y divide-border-subtle">
              {CATEGORIES.map(cat => (
                <li key={cat.key} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div
                      id={`notification-${cat.key}-label`}
                      className="text-sm font-medium text-fg-primary"
                    >
                      {cat.label}
                    </div>
                    <p
                      id={`notification-${cat.key}-description`}
                      className="mt-0.5 text-xs text-fg-secondary"
                    >
                      {cat.description}
                    </p>
                  </div>
                  <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-end gap-2 text-sm text-fg-secondary">
                    <input
                      type="checkbox"
                      aria-labelledby={`notification-${cat.key}-label`}
                      aria-describedby={`notification-${cat.key}-description`}
                      disabled={saving}
                      checked={prefs[cat.key]}
                      onChange={e => setToggle(cat.key, e.target.checked)}
                      className="h-4 w-4"
                    />
                    {prefs[cat.key] ? 'On' : 'Off'}
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-subtle p-4">
            <h2 className="text-sm font-medium text-fg-primary">Digest frequency</h2>
            <p className="mt-0.5 text-xs text-fg-secondary">
              How often to receive a summary of activity you missed.
            </p>
            <div
              role="radiogroup"
              aria-label="Digest frequency"
              className="mt-3 flex flex-wrap gap-2"
            >
              {DIGEST_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2.5 text-sm min-h-11 focus-within:ring-2 focus-within:ring-ring ${
                    displayedDigest(prefs.digest_frequency) === opt.value
                      ? 'border-interactive/60 bg-surface-raised/40 text-fg-primary'
                      : 'border-subtle text-fg-secondary hover:bg-surface-raised/20'
                  }`}
                >
                  <input
                    type="radio"
                    disabled={saving}
                    name="digest"
                    value={opt.value}
                    checked={displayedDigest(prefs.digest_frequency) === opt.value}
                    onChange={() => setDigest(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </section>

          <div
            role="status"
            className="flex items-center justify-end gap-2 text-sm text-fg-secondary"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : savedAt ? (
              <>
                <Check className="h-3.5 w-3.5 text-status-positive" /> Saved {savedAt}
              </>
            ) : (
              <span>Changes save automatically</span>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
