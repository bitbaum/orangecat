/**
 * ADD KEY STEP COMPONENT
 * Fourth step - enter and validate API key
 */

import { Layers, CheckCircle, Shield, Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { aiOnboardingContent } from '@/lib/ai-guidance';

interface AddKeyStepProps {
  provider:
    | {
        name: string;
        apiKeyExample?: string;
      }
    | undefined;
  apiKey: string;
  keyName: string;
  keyValidation: { valid: boolean; message?: string } | null;
  keyAdded: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onApiKeyChange: (value: string) => void;
  onKeyNameChange: (value: string) => void;
  onAddKey: () => Promise<void>;
}

export function AddKeyStep({
  provider,
  apiKey,
  keyName,
  keyValidation,
  keyAdded,
  isSubmitting,
  submitError,
  onApiKeyChange,
  onKeyNameChange,
  onAddKey,
}: AddKeyStepProps) {
  return (
    <div className="space-y-6">
      {/* Key Input Form */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Provider Display */}
          {provider && (
            <div className="flex items-center gap-3 p-3 bg-surface-raised rounded-lg">
              <div className="w-10 h-10 bg-surface-base rounded-lg flex items-center justify-center border border-subtle">
                <Layers className="w-5 h-5 text-fg-primary" />
              </div>
              <div>
                <p className="font-medium">{provider.name}</p>
                <p className="text-xs text-fg-secondary">
                  Key format:{' '}
                  <code className="bg-surface-raised px-1 rounded">{provider.apiKeyExample}</code>
                </p>
              </div>
            </div>
          )}

          {/* Key Name Input */}
          <div>
            <label className="block text-sm font-medium text-fg-primary mb-1">
              Key Name (optional)
            </label>
            <Input
              type="text"
              placeholder={`${provider?.name || 'API'} Key`}
              value={keyName}
              onChange={e => onKeyNameChange(e.target.value)}
              disabled={keyAdded}
            />
            <p className="text-xs text-fg-secondary mt-1">
              A friendly name to identify this key later
            </p>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-fg-primary mb-1">
              API Key <span className="text-status-negative">*</span>
            </label>
            <Input
              type="password"
              placeholder={provider?.apiKeyExample || 'sk-...'}
              value={apiKey}
              onChange={e => onApiKeyChange(e.target.value)}
              disabled={keyAdded}
              className={cn(
                keyValidation &&
                  !keyValidation.valid &&
                  'border-status-negative/40 focus:border-status-negative'
              )}
            />
            {keyValidation && !keyValidation.valid && (
              <p className="text-xs text-status-negative mt-1">{keyValidation.message}</p>
            )}
            {keyValidation?.valid && (
              <p className="text-xs text-status-positive mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Key format looks correct
              </p>
            )}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="oc-error-surface">
              <p className="text-sm">{submitError}</p>
            </div>
          )}

          {/* Success Message */}
          {keyAdded && (
            <div className="p-3 bg-status-positive-subtle border border-status-positive/20 rounded-lg">
              <div className="flex items-center gap-2 text-status-positive">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Key added successfully!</span>
              </div>
              <p className="text-sm text-status-positive mt-1">
                Your key has been encrypted and saved securely.
              </p>
            </div>
          )}

          {/* Add Key Button */}
          {!keyAdded && (
            <Button
              onClick={onAddKey}
              disabled={!apiKey || !keyValidation?.valid || isSubmitting}
              variant="accent"
              className="w-full"
            >
              {isSubmitting ? 'Adding Key...' : 'Add API Key'}
            </Button>
          )}
        </div>
      </Card>

      {/* Security Info */}
      <div className="bg-surface-raised/40 border border-subtle rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-fg-primary mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-fg-primary mb-1">
              {aiOnboardingContent.addKey.whyTitle}
            </h4>
            <p className="text-sm text-fg-primary">{aiOnboardingContent.addKey.whyContent}</p>
          </div>
        </div>
      </div>

      {/* Encryption Details */}
      <div className="flex flex-wrap gap-3">
        {aiOnboardingContent.addKey.tips?.map((tip, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-2 bg-surface-raised rounded-full"
          >
            <Lock className="w-4 h-4 text-fg-secondary" />
            <span className="text-sm text-fg-secondary">{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
