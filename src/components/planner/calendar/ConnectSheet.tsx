'use client';

/**
 * Calendars kept elsewhere, both ways. Out: one private link that Apple
 * Calendar, Google Calendar or Outlook subscribes to, so OrangeCat entries
 * show on the phone. In: a calendar's own private iCal link, so its events
 * show here. No sign-in app on either side, so it works for every provider
 * today.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, X } from 'lucide-react';
import { Sheet } from '@bitbaum/chatkit/react';
import { API_ROUTES } from '@/config/api-routes';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { LinkedCalendar } from '@/services/planner/feeds';
import type { ShareLinks } from '@/services/planner/share';
import { CONNECT_COPY as C, GOOGLE_ADD_BY_URL, PROVIDERS, type ProviderId } from './connect-copy';

async function json<T>(res: Response): Promise<T | null> {
  const body = (await res.json().catch(() => null)) as { data?: T } | null;
  return res.ok ? (body?.data ?? null) : null;
}

const errorOf = async (res: Response) =>
  ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error
    ?.message ?? C.failed;

export function ConnectSheet({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** A calendar was linked or removed: the view reloads. */
  onChanged: () => void;
}) {
  const [links, setLinks] = useState<ShareLinks | null>(null);
  const [calendars, setCalendars] = useState<LinkedCalendar[]>([]);
  const [provider, setProvider] = useState<ProviderId>('google');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [share, linked] = await Promise.all([
      fetch(API_ROUTES.CALENDAR.SHARE).then(r => json<{ links: ShareLinks | null }>(r)),
      fetch(API_ROUTES.CALENDAR.LINKED).then(r => json<{ calendars: LinkedCalendar[] }>(r)),
    ]).catch(() => [null, null] as const);
    setLinks(share?.links ?? null);
    setCalendars(linked?.calendars ?? []);
  }, []);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  async function share(method: 'POST' | 'DELETE') {
    setBusy('share');
    const res = await fetch(API_ROUTES.CALENDAR.SHARE, { method }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      toast.error(C.failed);
      return;
    }
    setLinks(
      method === 'DELETE' ? null : ((await json<{ links: ShareLinks }>(res))?.links ?? null)
    );
  }

  async function copy(text: string) {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    toast.success(C.copied);
  }

  async function link() {
    setBusy('link');
    const res = await fetch(API_ROUTES.CALENDAR.LINKED, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, name: name || null }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      toast.error(res ? await errorOf(res) : C.failed);
      return;
    }
    const made = await json<{ calendar: LinkedCalendar; events: number }>(res);
    if (made) {
      toast.success(C.linked(made.calendar.name, made.events));
      setCalendars(c => [...c, made.calendar]);
    }
    setUrl('');
    setName('');
    onChanged();
  }

  async function unlink(cal: LinkedCalendar) {
    const res = await fetch(API_ROUTES.CALENDAR.LINKED_BY_ID(cal.id), { method: 'DELETE' }).catch(
      () => null
    );
    if (!res?.ok) {
      toast.error(C.failed);
      return;
    }
    setCalendars(c => c.filter(x => x.id !== cal.id));
    onChanged();
  }

  const chosen = PROVIDERS.find(p => p.id === provider) ?? PROVIDERS[0];
  const section = 'flex flex-col gap-3 rounded-2xl border border-default bg-surface-base p-4';
  return (
    <Sheet open={open} onClose={onClose} title={C.title} closeLabel={C.close}>
      <div className="flex flex-col gap-4 p-4">
        <section className={section} aria-labelledby="cal-out">
          <h2 id="cal-out" className="mb-0 text-base font-semibold text-fg-primary">
            {C.outTitle}
          </h2>
          <p className="mb-0 text-sm text-fg-secondary">{C.outBody}</p>
          {!links ? (
            <Button
              type="button"
              variant="primary"
              disabled={busy !== null}
              onClick={() => void share('POST')}
            >
              {C.outOn}
            </Button>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button href={links.webcal} variant="primary">
                  {C.apple}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void copy(links.https);
                    window.open(GOOGLE_ADD_BY_URL, '_blank', 'noopener');
                  }}
                >
                  {C.google}
                </Button>
              </div>
              <p className="mb-0 text-xs text-fg-tertiary">{C.googleHint}</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-surface-raised px-2 py-2 text-xs text-fg-secondary">
                  {links.https}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copy(links.https)}
                >
                  {C.copy}
                </Button>
              </div>
              <p className="mb-0 text-xs text-fg-tertiary">{C.outPrivate}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void share('POST')}
                  title={C.renewHint}
                >
                  {C.renew}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void share('DELETE')}
                >
                  {C.off}
                </Button>
              </div>
            </>
          )}
        </section>

        <section className={section} aria-labelledby="cal-in">
          <h2 id="cal-in" className="mb-0 text-base font-semibold text-fg-primary">
            {C.inTitle}
          </h2>
          <p className="mb-0 text-sm text-fg-secondary">{C.inBody}</p>
          {calendars.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {calendars.map(cal => (
                <li
                  key={cal.id}
                  className="flex items-center gap-2 rounded-xl border border-subtle px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg-primary">{cal.name}</span>
                    <span className="block truncate text-xs text-fg-tertiary">
                      {cal.lastError ? `${C.notRead} ${cal.lastError}` : cal.hint}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={C.remove(cal.name)}
                    onClick={() => void unlink(cal)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-tertiary hover:bg-surface-raised hover:text-fg-primary"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div
            className="grid grid-cols-4 gap-1 rounded-xl bg-surface-raised p-1"
            role="radiogroup"
            aria-label="Where it is kept"
          >
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === provider}
                onClick={() => setProvider(p.id)}
                className={`min-h-11 rounded-lg text-sm ${
                  p.id === provider
                    ? 'bg-surface-base font-medium text-fg-primary shadow-sm'
                    : 'text-fg-secondary'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <p className="mb-0 text-sm text-fg-secondary">{chosen.steps}</p>
          {chosen.open && (
            <a
              href={chosen.open.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-fg-primary underline underline-offset-2"
            >
              {chosen.open.label}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder={C.paste}
            aria-label={C.paste}
            inputMode="url"
            autoComplete="off"
          />
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={C.name}
            aria-label={C.name}
            maxLength={80}
          />
          <Button
            type="button"
            variant="primary"
            disabled={busy !== null || url.trim().length < 10}
            onClick={() => void link()}
          >
            {busy === 'link' ? C.linking : C.link}
          </Button>
        </section>
      </div>
    </Sheet>
  );
}
