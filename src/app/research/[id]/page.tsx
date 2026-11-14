import { Metadata } from 'next';
import { generateEntityMetadata } from '@/lib/seo/metadata';
import PublicEntityDetailPage, {
  fetchEntityForMetadata,
} from '@/components/public/PublicEntityDetailPage';
import { researchDetailConfig } from '@/components/public/detail-configs/research';
import { notFoundTitle } from '@/config/not-found';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const entity = await fetchEntityForMetadata('research', id, 'title, description');
  if (!entity) {
    return { title: notFoundTitle('research') };
  }
  return generateEntityMetadata({
    type: 'research',
    id,
    title: entity.title,
    description: entity.description,
  });
}

export default async function PublicResearchPage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEntityDetailPage id={id} config={researchDetailConfig} />;
}
