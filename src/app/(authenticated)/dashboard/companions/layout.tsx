import type { Metadata } from 'next';

import { ENTITY_REGISTRY } from '@/config/entity-registry';

export const metadata: Metadata = {
  title: { default: ENTITY_REGISTRY.ai_assistant.namePlural, template: '%s | OrangeCat' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
