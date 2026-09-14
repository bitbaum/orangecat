'use client';

import { Key, Star, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getAIProvider } from '@/data/aiProviders';
import { BADGE_COLORS } from '@/config/badge-colors';
import { UserApiKey } from './AIKeyManager';

/** The host is the part a person recognises; the path is noise on a card. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

interface AIKeyCardProps {
  apiKey: UserApiKey;
  isLoading: boolean;
  onSetPrimary: (id: string) => void;
  onDelete: (key: UserApiKey) => void;
}

export function AIKeyCard({ apiKey: key, isLoading, onSetPrimary, onDelete }: AIKeyCardProps) {
  const keyProvider = getAIProvider(key.provider);

  return (
    <Card variant="minimal" className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              key.is_valid ? 'bg-status-positive-subtle' : 'bg-status-negative-subtle'
            )}
          >
            <Key
              className={cn(
                'w-5 h-5',
                key.is_valid ? 'text-status-positive' : 'text-status-negative'
              )}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{key.key_name}</span>
              {key.is_primary && (
                <Badge className="bg-surface-raised text-fg-primary border-subtle">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  Primary
                </Badge>
              )}
              {key.is_valid ? (
                <Badge className={BADGE_COLORS.success}>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Valid
                </Badge>
              ) : (
                <Badge className={BADGE_COLORS.error}>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Invalid
                </Badge>
              )}
            </div>
            <div className="text-sm text-fg-secondary flex flex-wrap items-center gap-2">
              <span>{keyProvider?.name || key.provider}</span>
              {key.base_url && (
                <>
                  <span>•</span>
                  <span className="font-mono">{hostOf(key.base_url)}</span>
                </>
              )}
              {key.default_model && (
                <>
                  <span>•</span>
                  <span className="font-mono">{key.default_model}</span>
                </>
              )}
              <span>•</span>
              <span className="font-mono">
                {key.key_hint.startsWith('...') ? `****${key.key_hint}` : key.key_hint}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!key.is_primary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetPrimary(key.id)}
              disabled={isLoading}
              title="Set as primary"
            >
              <Star className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(key)}
            className="text-status-negative hover:text-status-negative/80 hover:bg-status-negative/10"
            title="Delete key"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
