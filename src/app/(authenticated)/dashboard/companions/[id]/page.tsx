import PublicEntityDetailPage from '@/components/public/PublicEntityDetailPage';
import { aiAssistantDetailConfig } from '@/components/public/detail-configs/ai-assistant';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * AI-assistant detail (owner / dashboard).
 *
 * Renders the SAME layout visitors see (PublicEntityDetailPage) plus the owner
 * manage bar. Config shared with the public route via aiAssistantDetailConfig (SSOT).
 */
export default async function AIAssistantDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEntityDetailPage id={id} config={aiAssistantDetailConfig} />;
}
