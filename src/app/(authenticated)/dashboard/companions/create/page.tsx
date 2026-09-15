'use client';

import { EntityCreateEditPage } from '@/components/create/EntityCreateEditPage';
import { aiAssistantConfig } from '@/config/entity-configs';
import type { AIAssistantFormData } from '@/lib/validation';

export default function CreateAIAssistantPage() {
  return (
    <EntityCreateEditPage<AIAssistantFormData>
      entityType="ai_assistant"
      config={aiAssistantConfig}
    />
  );
}
