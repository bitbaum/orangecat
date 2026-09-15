import { Metadata } from 'next';
import { generateEntityMetadata } from '@/lib/seo/metadata';
import PublicEntityDetailPage, {
  fetchEntityForMetadata,
} from '@/components/public/PublicEntityDetailPage';
import { aiAssistantDetailConfig } from '@/components/public/detail-configs/ai-assistant';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const entity = await fetchEntityForMetadata('ai_assistant', id, 'title, description, avatar_url');
  if (!entity) {
    return { title: 'AI Assistant Not Found' };
  }
  return generateEntityMetadata({
    type: 'ai_assistant',
    id,
    title: entity.title,
    description: entity.description,
    imageUrl: entity.avatar_url,
  });
}

export default async function PublicAIAssistantPage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEntityDetailPage id={id} config={aiAssistantDetailConfig} />;
}
