'use client';

import EntityDashboardPage from '@/components/entity/EntityDashboardPage';
import { aiAssistantEntityConfig } from '@/config/entities/ai-assistants';
import type { AIAssistant } from '@/types/database';

export default function AIAssistantsDashboardPage() {
  return (
    <EntityDashboardPage<AIAssistant>
      config={aiAssistantEntityConfig}
      title="My companions"
      description="Build and monetize autonomous AI services powered by your expertise"
      createButtonLabel="Create a companion"
    />
  );
}
