import { Metadata } from 'next';
import { generateEntityMetadata } from '@/lib/seo/metadata';
import PublicEntityDetailPage, {
  fetchEntityForMetadata,
} from '@/components/public/PublicEntityDetailPage';
import { causeDetailConfig } from '@/components/public/detail-configs/cause';
import { notFoundTitle } from '@/config/not-found';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const cause = await fetchEntityForMetadata('cause', id, 'title, description');
  if (!cause) {
    return {
      title: notFoundTitle('cause'),
      description: 'The cause you are looking for does not exist.',
    };
  }
  return generateEntityMetadata({
    type: 'cause',
    id,
    title: cause.title,
    description: cause.description,
  });
}

export default async function PublicCausePage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEntityDetailPage id={id} config={causeDetailConfig} />;
}
