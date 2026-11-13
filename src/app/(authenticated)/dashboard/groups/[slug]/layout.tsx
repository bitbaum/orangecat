import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: ENTITY_REGISTRY.group.name, template: '%s | OrangeCat' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
