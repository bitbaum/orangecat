'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Key,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  aiProviders,
  getAIProvider,
  keyableProviders,
  validateApiKeyFormat,
  wiredProviders,
} from '@/data/aiProviders';
import { ROUTES } from '@/config/routes';

interface AIKeyAddFormProps {
  onAdd: (data: { provider: string; apiKey: string; keyName: string }) => Promise<void>;
  onCancel: () => void;
  onFieldFocus?: (field: string | null) => void;
}

type FormState = 'idle' | 'submitting' | 'success';

// Derived from the provider SSOT: direct (non-local) providers not yet wired.
const wiredIds = new Set(wiredProviders.map(p => p.id));
const unwiredDirectNames = aiProviders
  .filter(p => p.type === 'direct' && !wiredIds.has(p.id))
  .map(p => p.name)
  .join(' + ');

export function AIKeyAddForm({ onAdd, onCancel, onFieldFocus }: AIKeyAddFormProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [keyName, setKeyName] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successProviderId, setSuccessProviderId] = useState<string | null>(null);

  const provider = getAIProvider(selectedProvider);
  const successProvider = successProviderId ? getAIProvider(successProviderId) : null;

  const resetForm = (keepProvider = true) => {
    setApiKey('');
    setKeyName('');
    setError(null);
    setShowKey(false);
    setFormState('idle');
    setSuccessProviderId(null);
    if (!keepProvider) {
      setSelectedProvider('openrouter');
    }
  };

  const handleSubmit = async () => {
    if (!apiKey || !provider) {
      return;
    }

    const validation = validateApiKeyFormat(selectedProvider, apiKey);
    if (!validation.valid) {
      setError(validation.message || 'Invalid API key format');
      return;
    }

    setFormState('submitting');
    setError(null);

    try {
      await onAdd({
        provider: selectedProvider,
        apiKey,
        keyName: keyName || `${provider.name} Key`,
      });
      setSuccessProviderId(selectedProvider);
      setApiKey('');
      setKeyName('');
      setFormState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add key');
      setFormState('idle');
    }
  };

  if (formState === 'success' && successProvider) {
    return (
      <Card className="border-status-positive/30 bg-status-positive-subtle">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-surface-page p-2">
              <CheckCircle className="h-6 w-6 text-status-positive" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-fg-primary">
                Connected to {successProvider.name}
              </h3>
              <p className="mt-1 text-sm text-fg-primary">
                Cat is now routing every message through your {successProvider.name} key. You pay{' '}
                {successProvider.name} directly — OrangeCat never sees your bill, never marks it up.
              </p>
              <p className="mt-2 text-xs text-fg-secondary">
                <Sparkles className="mr-1 inline h-3 w-3" aria-hidden="true" />
                The freedom architecture: your provider, your bill, your choice. Always.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={() => resetForm()}>
              Add another key
            </Button>
            <Link href={ROUTES.DASHBOARD.CAT}>
              <Button variant="accent" size="sm">
                <Sparkles className="mr-2 h-4 w-4" />
                Start chatting
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isSubmitting = formState === 'submitting';

  return (
    <Card className="border-subtle bg-surface-raised/40/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Add API Key</CardTitle>
        <CardDescription>Add your API key from your chosen provider</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-fg-primary mb-2">Provider</label>
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            onFocus={() => onFieldFocus?.('provider')}
            onBlur={() => onFieldFocus?.(null)}
          >
            {keyableProviders.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProvider(p.id)}
                className={cn(
                  'p-3 rounded-lg border-2 text-left transition-all',
                  selectedProvider === p.id
                    ? 'border-fg-primary bg-surface-raised/40'
                    : 'border-default hover:border-strong dark:hover:border-default'
                )}
              >
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-fg-secondary">{p.type}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-fg-secondary">
            Want Claude or Gemini? Add an <strong className="text-fg-primary">OpenRouter</strong>{' '}
            key — one key fronts all 200+ models. Direct {unwiredDirectNames} support is on the
            roadmap. A <strong className="text-fg-primary">Replicate</strong> key is different: it
            renders video and music in the Studio, and never answers chat.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-primary mb-1">
            Key Name (optional)
          </label>
          <Input
            value={keyName}
            onChange={e => setKeyName(e.target.value)}
            placeholder={`e.g., ${provider?.name || 'My'} Key for OrangeCat`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-primary mb-1">API Key</label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => {
                setApiKey(e.target.value);
                setError(null);
              }}
              onFocus={() => onFieldFocus?.('apiKey')}
              onBlur={() => onFieldFocus?.(null)}
              placeholder={provider?.apiKeyExample || 'sk-...'}
              className="pr-20"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-fg-secondary hover:text-fg-primary"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {provider && (
            <p className="mt-1 text-xs text-fg-secondary">
              Get your key at{' '}
              <a
                href={provider.apiKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg-primary hover:underline inline-flex items-center gap-1"
              >
                {provider.name}
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          )}
        </div>

        {error && (
          <div className="oc-error-surface flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-status-negative mt-0.5 flex-shrink-0" />
            <p className="text-sm text-status-negative/80">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!apiKey || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validating…
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2" />
                Add Key
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
