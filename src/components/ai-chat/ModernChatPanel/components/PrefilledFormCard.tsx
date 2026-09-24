/**
 * PREFILLED FORM CARD — inline entity artifact.
 *
 * The Cat drafts an entity (product, service, project, …) via prefill_entity_form.
 * This card is the "artifact": the user can tweak the key fields and **publish or
 * save it as a draft right here in the chat** — no bounce to a separate form.
 *
 * Why post to the entity API (config.apiEndpoint) rather than the create_* Cat
 * action handler: the API path is the SAME one the create form uses, so price is
 * stored in the user's currency (the naive action handler hardcodes currency=BTC
 * and would mis-store "60 CHF" as 60 BTC) and full server-side validation applies.
 *
 * "Open full form" remains as a graceful fallback for advanced fields or when
 * inline publish fails validation.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, Check, Loader2 } from 'lucide-react';
import { STORAGE_KEYS } from '@/config/storage-keys';
import { ENTITY_REGISTRY, isValidEntityType, type EntityType } from '@/config/entity-registry';
import { resolvePublishStatus } from '@/config/entity-status';
import { ENTITY_STATUS } from '@/config/database-constants';
import { SellerWalletBanner } from '@/components/payment/SellerWalletBanner';
import { ChangeThisLink } from '@/components/feedback/ChangeThisLink';
import { useAuth } from '@/hooks/useAuth';
import { useSellerPaymentMethods } from '@/hooks/useSellerPaymentMethods';
import type { PrefillProposal } from '../types';

const EDITABLE_KEYS = ['title', 'name', 'description', 'price', 'price_btc', 'currency'];

const PREVIEW_LABELS: Record<string, string> = {
  category: 'Category',
  tags: 'Tags',
  location: 'Location',
  duration_minutes: 'Duration',
  target_btc: 'Goal',
  goal_amount: 'Goal',
  start_date: 'Starts',
  end_date: 'Ends',
  product_type: 'Type',
};

interface PrefilledFormCardProps {
  proposal: PrefillProposal;
}

type Phase = 'idle' | 'saving' | 'done' | 'error';

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function PrefilledFormCard({ proposal }: PrefilledFormCardProps) {
  const router = useRouter();
  const { entityType, sourceDescription, data } = proposal;

  const valid = isValidEntityType(entityType);
  const meta = valid ? ENTITY_REGISTRY[entityType as EntityType] : null;

  const present = (v: unknown): boolean => v !== null && v !== undefined && v !== '';
  const [title, setTitle] = useState(String(data.title ?? data.name ?? ''));
  const [description, setDescription] = useState(String(data.description ?? ''));
  const hasPrice = present(data.price) || present(data.price_btc);
  const [price, setPrice] = useState(
    present(data.price) ? String(data.price) : present(data.price_btc) ? String(data.price_btc) : ''
  );
  const currency = typeof data.currency === 'string' ? data.currency : undefined;

  const [phase, setPhase] = useState<Phase>('idle');
  const [published, setPublished] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Soft-nudge (C-2): if the just-published entity takes payments but the owner
  // has no wallet, it's live-but-unpayable. Warn them (self-gating banner).
  // Hooks run before the early return below so ordering stays stable.
  const { user } = useAuth();
  const receivesPayments = !!meta?.paymentPattern && meta.paymentPattern !== 'none';
  const { hasWallet } = useSellerPaymentMethods(receivesPayments ? (user?.id ?? null) : null);

  if (!valid || !meta) {
    return null;
  }

  const extraFields = Object.entries(data).filter(([k, v]) => {
    if (EDITABLE_KEYS.includes(k)) {
      return false;
    }
    if (v === null || v === undefined || v === '') {
      return false;
    }
    if (Array.isArray(v) && v.length === 0) {
      return false;
    }
    return true;
  });

  const buildPayload = (status: string): Record<string, unknown> => {
    const payload: Record<string, unknown> = { ...data, status };
    payload.title = title.trim();
    payload.description = description.trim() || undefined;
    if (hasPrice) {
      const n = parseFloat(price);
      if (!isNaN(n)) {
        payload.price = n;
      }
    }
    if (currency) {
      payload.currency = currency;
    }
    return payload;
  };

  const submit = async (publish: boolean) => {
    setPhase('saving');
    setErrorMsg(null);
    try {
      // 1. Create. The entity create API always persists a DRAFT (status in the
      //    body is ignored on create), so publishing is a second step.
      const res = await fetch(meta.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(buildPayload(ENTITY_STATUS.DRAFT)),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const msg =
          json?.error?.message ||
          (typeof json?.error === 'string' ? json.error : null) ||
          `Couldn't create this — try "Open full form".`;
        setErrorMsg(msg);
        setPhase('error');
        return;
      }

      // 2. Publish: flip the draft to its per-type live status via the update
      //    endpoint. Only claim "published" if this actually succeeds (honest state).
      const id = json.data?.id as string | undefined;
      setPublishedId(id ?? null);
      let didPublish = false;
      if (publish && id) {
        const liveStatus = isValidEntityType(entityType)
          ? resolvePublishStatus(entityType as EntityType, ENTITY_STATUS.ACTIVE)
          : ENTITY_STATUS.ACTIVE;
        const pubRes = await fetch(`${meta.apiEndpoint}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(buildPayload(liveStatus)),
        });
        const pubJson = await pubRes.json().catch(() => null);
        didPublish = pubRes.ok && pubJson?.success === true;
      }

      setPublished(didPublish);
      setPhase('done');
    } catch {
      setErrorMsg('Network error — try "Open full form".');
      setPhase('error');
    }
  };

  const openInForm = () => {
    if (typeof window !== 'undefined') {
      try {
        const merged = {
          ...data,
          title,
          description,
          ...(hasPrice && !isNaN(parseFloat(price)) ? { price: parseFloat(price) } : {}),
        };
        window.localStorage.setItem(
          STORAGE_KEYS.ENTITY_PREFILL(entityType as EntityType),
          JSON.stringify(merged)
        );
      } catch {
        /* localStorage unavailable; the form will start empty */
      }
    }
    router.push(meta.createPath);
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (phase === 'done') {
    // C-4: once published, link to the entity's PUBLIC page (not the owner list)
    // so the creator immediately sees the live, shareable result of the loop.
    const publicUrl =
      published && publishedId && meta.publicBasePath
        ? `${meta.publicBasePath}/${publishedId}`
        : null;
    return (
      <div className="mt-3 rounded-md border border-subtle bg-surface-raised/30 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-status-positive">
            <Check className="h-3 w-3 text-fg-inverted" />
          </span>
          <span className="text-sm font-semibold text-fg-primary">
            {published ? `${meta.name} published` : `Draft saved`}: {title}
          </span>
        </div>
        {/* Payable state: reassure when ready, nudge to connect a wallet when not.
            SellerWalletBanner self-gates (renders nothing once a wallet exists). */}
        {published && receivesPayments && hasWallet && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-status-positive">
            <Check className="h-3 w-3" /> Ready to receive payments
          </p>
        )}
        {published && receivesPayments && !hasWallet && (
          <div className="mt-3">
            <SellerWalletBanner isOwner hasWallet={hasWallet} />
          </div>
        )}
        {/* C-4: lead with the public, shareable page; keep the owner list secondary. */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-fg-primary px-4 py-2 text-sm font-medium text-fg-inverted transition-colors hover:bg-fg-primary/90"
            >
              View public page
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={() => router.push(meta.basePath)}
            className={
              publicUrl
                ? 'inline-flex min-h-11 items-center text-sm font-medium text-fg-secondary hover:text-fg-primary'
                : 'inline-flex min-h-11 items-center gap-1.5 rounded-md bg-fg-primary px-4 py-2 text-sm font-medium text-fg-inverted transition-colors hover:bg-fg-primary/90'
            }
          >
            Open your {meta.namePlural.toLowerCase()}
            {!publicUrl && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  const saving = phase === 'saving';

  return (
    <div
      data-loki-target="cat-draft-card"
      role="group"
      aria-label={`Draft ${meta.name.toLowerCase()}`}
      className="mt-3 rounded-md border border-subtle bg-surface-raised/30 p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-fg-primary" />
        <span className="text-sm font-semibold text-fg-primary">
          Draft {meta.name.toLowerCase()}
        </span>
        <ChangeThisLink
          subject="this draft card"
          surface="cat-draft-card"
          className="-my-3 ml-auto"
        />
      </div>
      {sourceDescription && (
        <p className="mb-3 text-xs italic text-fg-secondary">
          From: &ldquo;
          {sourceDescription.length > 160
            ? sourceDescription.slice(0, 160) + '…'
            : sourceDescription}
          &rdquo;
        </p>
      )}

      {/* Editable core fields — tweak inline, no form bounce */}
      <div className="space-y-2.5">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-fg-tertiary">Title</span>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded-md border border-subtle bg-surface-base px-3 py-2 text-sm text-fg-primary focus:border-fg-primary focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-fg-tertiary">Description</span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={saving}
            rows={2}
            className="mt-1 w-full resize-y rounded-md border border-subtle bg-surface-base px-3 py-2 text-sm text-fg-primary focus:border-fg-primary focus:outline-none"
          />
        </label>
        {hasPrice && (
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-fg-tertiary">Price</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={price}
                onChange={e => setPrice(e.target.value)}
                disabled={saving}
                className="w-40 rounded-md border border-subtle bg-surface-base px-3 py-2 text-sm text-fg-primary focus:border-fg-primary focus:outline-none"
              />
              {currency && <span className="text-sm text-fg-secondary">{currency}</span>}
            </div>
          </label>
        )}
      </div>

      {/* Remaining fields the Cat inferred (read-only preview) */}
      {extraFields.length > 0 && (
        <dl className="mt-3 space-y-1.5 text-sm">
          {extraFields.slice(0, 5).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="w-28 flex-shrink-0 text-xs uppercase tracking-wide text-fg-tertiary">
                {PREVIEW_LABELS[key] ?? key.replace(/_/g, ' ')}
              </dt>
              <dd className="flex-1 text-fg-secondary">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {errorMsg && <p className="mt-3 text-xs text-status-negative">{errorMsg}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={saving || !title.trim()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-fg-primary px-4 py-2 text-sm font-medium text-fg-inverted transition-colors hover:bg-fg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Publish
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={saving || !title.trim()}
          className="inline-flex min-h-11 items-center rounded-md border border-default px-4 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={openInForm}
          disabled={saving}
          className="inline-flex min-h-11 items-center text-sm font-medium text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline disabled:opacity-50"
        >
          Open full form
        </button>
      </div>
    </div>
  );
}
