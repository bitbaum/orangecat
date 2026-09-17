'use client';

/**
 * "Create a group wallet" card — collapsed button that expands into a form.
 * Extracted from GroupWallets.tsx to keep that component under 300 lines.
 * Owns its own form + submit state; calls onCreated after a successful POST.
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

const WALLET_PURPOSES = [
  { value: 'general', label: 'General' },
  { value: 'projects', label: 'Projects' },
  { value: 'investment', label: 'Investment' },
  { value: 'community', label: 'Community' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'savings', label: 'Savings' },
  { value: 'other', label: 'Other' },
] as const;

interface CreateWalletForm {
  name: string;
  description: string;
  purpose: string;
  bitcoin_address: string;
  lightning_address: string;
}

const EMPTY_FORM: CreateWalletForm = {
  name: '',
  description: '',
  purpose: 'general',
  bitcoin_address: '',
  lightning_address: '',
};

export function GroupWalletCreateForm({
  groupSlug,
  onCreated,
}: {
  groupSlug: string;
  onCreated?: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateWalletForm>(EMPTY_FORM);

  const reset = () => {
    setCreating(false);
    setForm(EMPTY_FORM);
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bitcoin_address && !form.lightning_address) {
      toast.error('Provide at least one Bitcoin or Lightning address');
      return;
    }
    try {
      setSubmitting(true);
      const response = await fetch(API_ROUTES.GROUPS.WALLETS(groupSlug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          purpose: form.purpose,
          bitcoin_address: form.bitcoin_address || undefined,
          lightning_address: form.lightning_address || undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(apiErrorMessage(error, 'Failed to create wallet'));
      }
      toast.success('Wallet created successfully');
      reset();
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create wallet');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {creating ? (
          <form onSubmit={handleCreateWallet} className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">New Wallet</h3>
              <Button type="button" size="sm" variant="ghost" onClick={reset}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Name <span className="text-status-negative">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Operations Treasury"
                className="w-full border border-default rounded-md px-3 py-2 text-sm bg-surface-page focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Purpose</label>
              <select
                value={form.purpose}
                onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                className="w-full border border-default rounded-md px-3 py-2 text-sm bg-surface-page focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {WALLET_PURPOSES.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                maxLength={500}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                className="w-full border border-default rounded-md px-3 py-2 text-sm bg-surface-page focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Bitcoin Address</label>
              <input
                type="text"
                value={form.bitcoin_address}
                onChange={e => setForm(f => ({ ...f, bitcoin_address: e.target.value }))}
                placeholder="bc1q… or xpub…"
                className="w-full border border-default rounded-md px-3 py-2 text-sm font-mono bg-surface-page focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Lightning Address</label>
              <input
                type="text"
                value={form.lightning_address}
                onChange={e => setForm(f => ({ ...f, lightning_address: e.target.value }))}
                placeholder="user@domain.com"
                className="w-full border border-default rounded-md px-3 py-2 text-sm font-mono bg-surface-page focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <p className="text-xs text-fg-secondary">At least one address is required.</p>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting || !form.name} className="flex-1">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Wallet
              </Button>
              <Button type="button" variant="outline" onClick={reset}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setCreating(true)} className="w-full" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create New Wallet
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
