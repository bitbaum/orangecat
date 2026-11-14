import { Metadata } from 'next';
import { generateEntityMetadata } from '@/lib/seo/metadata';
import PublicEntityDetailPage, {
  fetchEntityForMetadata,
} from '@/components/public/PublicEntityDetailPage';
import { circleDetailConfig } from '@/components/public/detail-configs/circle';
import { notFoundTitle } from '@/config/not-found';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const entity = await fetchEntityForMetadata('circle', id, 'title, description');
  if (!entity) {
    return { title: notFoundTitle('circle') };
  }
  return generateEntityMetadata({
    type: 'circle',
    id,
    title: entity.title,
    description: entity.description,
  });
}

export default async function PublicCirclePage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEntityDetailPage id={id} config={circleDetailConfig} />;
}
