/**
 * CHAT HEADER COMPONENT
 * Header with title, model selector, and actions
 */

import { useRouter } from 'next/navigation';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import { Trash2, Settings2 } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { ModelSelector } from './ModelSelector';
import { QuotaMeter } from './QuotaMeter';
import type { CatQuota } from '../hooks/useCatQuota';

interface ChatHeaderProps {
  selectedModel: string;
  onModelSelect: (model: string) => void;
  isLoading: boolean;
  hasMessages: boolean;
  onClearChat: () => void;
  quota?: CatQuota | null;
}

export function ChatHeader({
  selectedModel,
  onModelSelect,
  isLoading,
  hasMessages,
  onClearChat,
  quota = null,
}: ChatHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-subtle bg-surface-raised">
          <BrandMarkIcon size={20} className="text-fg-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-fg-primary">Cat</h1>
          <p className="text-xs text-fg-secondary">Saved to your history · clear anytime</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <QuotaMeter quota={quota} />
        <ModelSelector
          selectedModel={selectedModel}
          onSelect={onModelSelect}
          disabled={isLoading}
        />

        {hasMessages && (
          <button
            onClick={onClearChat}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg-primary"
            aria-label="Clear chat"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={() => router.push(ROUTES.SETTINGS_AI)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg-primary"
          aria-label="AI settings"
          title="AI Settings"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
