/**
 * WALLET FORM COMPONENT
 * Add or edit a way to get paid. Optimized for a non-technical person: the ONLY
 * thing required is one payment handle, and the approachable option (a Lightning
 * address — works like an email) leads. On-chain / xpub and Nostr Wallet Connect
 * are demoted behind an "advanced" disclosure, and naming/categorizing is
 * optional (collapsed), so the happy path is "paste your Lightning address → Save".
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, Wallet, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { LIGHTNING_ADDRESS_PROVIDERS } from '@/config/wallet-providers';
import {
  WalletFormData,
  WALLET_CATEGORIES,
  WalletCategory,
  validateAddressOrXpub,
  classifyWalletInput,
  type WalletInputKind,
} from '@/types/wallet';
import type { WalletFormProps } from '../types';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { ReceiveVerdict } from './ReceiveVerdict';

/** Friendly label + hint for whatever the user pasted. */
const DETECTED: Record<Exclude<WalletInputKind, 'unknown'>, string> = {
  lightning: 'Lightning address',
  onchain: 'Bitcoin address',
  xpub: 'Bitcoin extended key',
  nwc: 'Wallet connection',
};

export function WalletForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  onFieldFocus,
  hasSavedConnection = false,
}: WalletFormProps) {
  const [formData, setFormData] = useState<WalletFormData>({
    label: initialData?.label || '',
    description: initialData?.description || '',
    address_or_xpub: initialData?.address_or_xpub || '',
    lightning_address: initialData?.lightning_address || '',
    nwc_connection_uri: initialData?.nwc_connection_uri || '',
    category: initialData?.category || 'general',
    category_icon: initialData?.category_icon,
    behavior_type: initialData?.behavior_type || 'general',
    goal_amount: initialData?.goal_amount,
    goal_currency: initialData?.goal_currency || 'USD',
    is_primary: initialData?.is_primary || false,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The advanced (technical) rails — reveal only if the user already has one
  // saved (editing) or explicitly asks for them.
  const [showAdvanced, setShowAdvanced] = useState(
    !!initialData?.address_or_xpub || !!initialData?.nwc_connection_uri || hasSavedConnection
  );
  const [showDetails, setShowDetails] = useState(false);
  const [showGetWallet, setShowGetWallet] = useState(false);

  // The whole point: paste ANYTHING your wallet gives you — a Lightning address,
  // a Bitcoin address, an xpub, or a wallet-connect link — and we route it to
  // the right field for you. No need to know which is which.
  const [walletInput, setWalletInput] = useState(
    initialData?.lightning_address ||
      initialData?.address_or_xpub ||
      initialData?.nwc_connection_uri ||
      ''
  );
  const detected = classifyWalletInput(walletInput);

  const handleWalletInput = (value: string) => {
    setWalletInput(value);
    const kind = classifyWalletInput(value);
    // Route to the matching receive field; clear the others so exactly one is set.
    // 'unknown' (still typing / unrecognized) clears all — submit then guides them.
    setFormData(fd => ({
      ...fd,
      lightning_address: kind === 'lightning' ? value.trim() : '',
      address_or_xpub: kind === 'onchain' || kind === 'xpub' ? value.trim() : '',
      nwc_connection_uri: kind === 'nwc' ? value.trim() : '',
    }));
  };

  const handleSubmit = async () => {
    setError(null);

    // Editing a wallet whose only handle is a saved connection: the secret is
    // never sent to the browser, so an empty input means "keep what's stored",
    // not "clear it". Omit the handle fields entirely so the server leaves them
    // untouched instead of nulling a working connection.
    const keepsSavedConnection = hasSavedConnection && !walletInput.trim();

    // The one hard requirement: a way to actually get paid.
    if (
      !keepsSavedConnection &&
      !formData.address_or_xpub?.trim() &&
      !formData.lightning_address?.trim() &&
      !formData.nwc_connection_uri?.trim()
    ) {
      setError(
        walletInput.trim()
          ? "Hmm, we couldn't recognize that. Paste a Lightning address (you@wallet.com), a Bitcoin address, or a nostr+walletconnect:// link — or tap “Don't have a wallet?” below."
          : 'Add your wallet so people can pay you — paste a Lightning address, a Bitcoin address, or a wallet-connect link.'
      );
      return;
    }

    if (
      formData.nwc_connection_uri?.trim() &&
      !formData.nwc_connection_uri.trim().startsWith('nostr+walletconnect://')
    ) {
      setError('NWC connection must start with nostr+walletconnect://');
      return;
    }

    if (formData.address_or_xpub?.trim()) {
      const validation = validateAddressOrXpub(formData.address_or_xpub);
      if (!validation.valid) {
        setError(apiErrorMessage(validation, 'Invalid address or xpub'));
        return;
      }
    }

    // Name and category are optional — default them so nothing blocks saving.
    const payload: WalletFormData = {
      ...formData,
      label: formData.label?.trim() || 'My wallet',
      category: formData.category || 'general',
      behavior_type: formData.behavior_type || 'general',
    };
    if (keepsSavedConnection) {
      delete payload.address_or_xpub;
      delete payload.lightning_address;
      delete payload.nwc_connection_uri;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save wallet');
      setIsSubmitting(false);
    }
  };

  const selectedCategory = WALLET_CATEGORIES[formData.category];

  return (
    <div className="rounded-lg border border-default bg-surface-raised p-4">
      <h4 className="mb-1 font-semibold text-fg-primary">
        {submitLabel === 'Save' ? 'Get paid in Bitcoin' : submitLabel}
      </h4>
      <p className="mb-4 text-sm text-fg-secondary">
        Add where you want the money to land. You can change this anytime.
      </p>

      {error && <div className="oc-error-surface mb-4 px-4 py-2">{error}</div>}

      {/* Smart "paste anything" input — auto-routes Lightning / on-chain / NWC. */}
      <div className="mb-4">
        <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg-primary">
          <Wallet className="h-4 w-4 text-bitcoinOrange" />
          Your wallet
        </label>
        <Input
          value={walletInput}
          onChange={e => handleWalletInput(e.target.value)}
          onFocus={() => onFieldFocus?.('lightningAddress')}
          placeholder="you@wallet.com  ·  bc1q…  ·  nostr+walletconnect://…"
          autoComplete="off"
        />
        {detected !== 'unknown' ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-status-positive">
            <Check className="h-3.5 w-3.5" />
            {DETECTED[detected]} detected
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-fg-secondary">
            Paste whatever your wallet gives you — a Lightning address (like an email for Bitcoin),
            a Bitcoin address, or a connection link. We&apos;ll sort out the rest.
          </p>
        )}

        <ReceiveVerdict detected={detected} value={walletInput} />

        <button
          type="button"
          onClick={() => setShowGetWallet(v => !v)}
          className="mt-2 text-xs font-medium text-accent-warm underline hover:text-accent-warm-hover"
        >
          Don&apos;t have a wallet? Get one free →
        </button>
        {showGetWallet && (
          <div className="mt-2 space-y-2 rounded-md border border-subtle bg-surface-base p-3 text-xs">
            <p className="text-fg-secondary">
              Pick one, create a free account, then copy your <strong>Lightning address</strong>{' '}
              back into the box above:
            </p>
            {/* Same list the Cat reads, so chat and form never recommend
                different wallets — see @/config/wallet-providers. */}
            {LIGHTNING_ADDRESS_PROVIDERS.map(provider => (
              <a
                key={provider.id}
                href={provider.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded border border-subtle px-2.5 py-1.5 text-fg-primary hover:border-strong"
              >
                <span>
                  <strong>{provider.name}</strong> — {provider.oneLiner}
                </span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 text-fg-tertiary" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Advanced rails: on-chain address / xpub + Nostr Wallet Connect */}
      <button
        type="button"
        onClick={() => setShowAdvanced(v => !v)}
        className="mb-2 flex items-center gap-1 text-xs font-medium text-fg-secondary hover:text-fg-primary"
      >
        {showAdvanced ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        Other ways to get paid (advanced)
      </button>
      {showAdvanced && (
        <div className="mb-4 space-y-4 border-l-2 border-subtle pl-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-fg-primary">
              On-chain Bitcoin address or extended key
            </label>
            <Input
              value={formData.address_or_xpub ?? ''}
              onChange={e => setFormData({ ...formData, address_or_xpub: e.target.value })}
              onFocus={() => onFieldFocus?.('addressOrXpub')}
              placeholder="bc1q…  or  zpub…"
            />
            <p className="mt-1.5 text-xs text-fg-secondary">
              Slower (~10 min to confirm), better for larger amounts. An extended key
              (xpub/ypub/zpub) auto-tracks new addresses; a single address also works.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-fg-primary">
              Nostr Wallet Connect
            </label>
            <Input
              type="password"
              value={formData.nwc_connection_uri || ''}
              onChange={e => setFormData({ ...formData, nwc_connection_uri: e.target.value })}
              onFocus={() => onFieldFocus?.('addressOrXpub')}
              placeholder="nostr+walletconnect://…"
              autoComplete="off"
            />
            <p className="mt-1.5 text-xs text-fg-secondary">
              Connect a wallet (Alby, Coinos, …) so payments settle automatically — the best
              experience if you have it. The connection secret is stored securely and never shown
              again.
            </p>
          </div>
        </div>
      )}

      {/* Optional: name, description, category, goal */}
      <button
        type="button"
        onClick={() => setShowDetails(v => !v)}
        className="mb-2 flex items-center gap-1 text-xs font-medium text-fg-secondary hover:text-fg-primary"
      >
        {showDetails ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        Name &amp; details (optional)
      </button>
      {showDetails && (
        <div className="mb-4 space-y-4 border-l-2 border-subtle pl-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-fg-primary">Wallet name</label>
            <Input
              value={formData.label}
              onChange={e => setFormData({ ...formData, label: e.target.value })}
              onFocus={() => onFieldFocus?.('label')}
              placeholder="e.g., Tips, Main wallet"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-fg-primary">Description</label>
            <Textarea
              value={formData.description ?? ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              onFocus={() => onFieldFocus?.('description')}
              placeholder="What this wallet is for…"
              rows={2}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-fg-primary">Category</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(WALLET_CATEGORIES) as WalletCategory[]).map(cat => {
                const catInfo = WALLET_CATEGORIES[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, category: cat, category_icon: catInfo.icon });
                      onFieldFocus?.('category');
                    }}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      formData.category === cat
                        ? 'border-bitcoinOrange bg-bitcoinOrange/5'
                        : 'border-strong hover:border-strong'
                    }`}
                  >
                    <div className="mb-1 text-2xl">{catInfo.icon}</div>
                    <div className="text-sm font-medium text-fg-primary">{catInfo.label}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-fg-secondary">{selectedCategory.description}</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-fg-primary">Funding goal</label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={formData.goal_amount || ''}
                onChange={e =>
                  setFormData({ ...formData, goal_amount: parseFloat(e.target.value) || undefined })
                }
                onFocus={() => onFieldFocus?.('goalAmount')}
                placeholder="1000"
                className="flex-1"
              />
              <select
                value={formData.goal_currency ?? ''}
                onChange={e => setFormData({ ...formData, goal_currency: e.target.value })}
                onFocus={() => onFieldFocus?.('goalCurrency')}
                className="rounded border px-3 py-2"
              >
                <option value="CHF">CHF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BTC">BTC</option>
              </select>
            </div>
          </div>

          {/* Primary wallet toggle (only meaningful when more than one exists) */}
          {initialData?.address_or_xpub && (
            <div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_primary || false}
                  onChange={e => setFormData({ ...formData, is_primary: e.target.checked })}
                  className="h-4 w-4 rounded border-strong text-bitcoinOrange focus:ring-ring"
                />
                <span className="text-sm font-medium">Show this one on my profile</span>
              </label>
              <p className="ml-6 mt-1 text-xs text-fg-secondary">
                The primary wallet is the one shown prominently on your profile.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  );
}
