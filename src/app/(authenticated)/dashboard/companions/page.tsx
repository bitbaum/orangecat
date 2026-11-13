'use client';

import EntityDashboardPage from '@/components/entity/EntityDashboardPage';
import { aiAssistantEntityConfig } from '@/config/entities/ai-assistants';
import type { AIAssistant } from '@/types/database';

export default function AIAssistantsDashboardPage() {
  return (
    <EntityDashboardPage<AIAssistant>
      config={aiAssistantEntityConfig}
      title={`My ${aiAssistantEntityConfig.namePlural}`}
      description="Beings with their own voice that remember whoever talks to them"
      createButtonLabel="Create a companion"
    />
  );
}
