/**
 * GET KEY STEP COMPONENT
 * Third step - instructions for obtaining API key
 */

import { Key, ExternalLink, Copy, Check, AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { aiOnboardingContent } from '@/lib/ai-guidance';
import { APP_NAME } from '@/config/brand';

interface GetKeyStepProps {
  provider:
    | {
        name: string;
        type: string;
        apiKeyPrefix?: string;
        apiKeyUrl: string;
      }
    | undefined;
  copiedUrl: boolean;
  onCopyUrl: (url: string) => Promise<void>;
}

const TYPE_LABEL: Record<string, string> = {
  aggregator: 'Aggregator',
  direct: 'Direct provider',
  local: 'Local (runs on your machine)',
};

export function GetKeyStep({ provider, copiedUrl, onCopyUrl }: GetKeyStepProps) {
  if (!provider) {
    return (
      <div className="text-center py-8 text-fg-secondary">Please select a provider first.</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider Info */}
      <Card className="p-6 bg-surface-base">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-surface-raised rounded-lg flex items-center justify-center">
            <Key className="w-6 h-6 text-fg-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{provider.name}</h3>
            <p className="text-sm text-fg-secondary">
              {TYPE_LABEL[provider.type] ?? provider.type}
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 p-3 bg-surface-raised/50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-fg-primary text-fg-inverted flex items-center justify-center text-sm font-medium flex-shrink-0">
              1
            </div>
            <div>
              <p className="text-sm font-medium">Visit {provider.name}</p>
              <p className="text-xs text-fg-secondary">Create an account if you do not have one</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-surface-raised/50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-fg-primary text-fg-inverted flex items-center justify-center text-sm font-medium flex-shrink-0">
              2
            </div>
            <div>
              <p className="text-sm font-medium">Go to API Keys page</p>
              <p className="text-xs text-fg-secondary">Usually under Settings or Account</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-surface-raised/50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-fg-primary text-fg-inverted flex items-center justify-center text-sm font-medium flex-shrink-0">
              3
            </div>
            <div>
              <p className="text-sm font-medium">Create a new API key</p>
              <p className="text-xs text-fg-secondary">
                Name it &ldquo;{APP_NAME}&rdquo; for easy identification
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-surface-raised/50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-fg-primary text-fg-inverted flex items-center justify-center text-sm font-medium flex-shrink-0">
              4
            </div>
            <div>
              <p className="text-sm font-medium">Copy your key</p>
              <p className="text-xs text-fg-secondary">
                Keys start with{' '}
                <code className="bg-surface-raised px-1 rounded">
                  {provider.apiKeyPrefix || 'sk-'}
                </code>
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <Button onClick={() => window.open(provider.apiKeyUrl, '_blank')} variant="primary">
            Open {provider.name}
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="outline" onClick={() => onCopyUrl(provider.apiKeyUrl)}>
            {copiedUrl ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Security Warnings */}
      <div className="space-y-3">
        {aiOnboardingContent.getKey.warnings?.map((warning, index) => (
          <div key={index} className="oc-error-surface flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{warning}</span>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="bg-surface-raised/40 border border-subtle rounded-lg p-4">
        <h4 className="font-semibold text-fg-primary mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Security Tips
        </h4>
        <ul className="space-y-1">
          {aiOnboardingContent.getKey.tips?.map((tip, index) => (
            <li key={index} className="text-sm text-fg-primary flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
