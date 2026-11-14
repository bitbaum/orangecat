import { Metadata } from 'next';
import { generateEntityMetadata } from '@/lib/seo/metadata';
import PublicEntityDetailPage, {
  fetchEntityForMetadata,
} from '@/components/public/PublicEntityDetailPage';
import { assetDetailConfig } from '@/components/public/detail-configs/asset';
import { notFoundTitle } from '@/config/not-found';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const asset = await fetchEntityForMetadata('asset', id, 'title, description');
  if (!asset) {
    return {
      title: notFoundTitle('asset'),
      description: 'The asset you are looking for does not exist.',
    };
  }
  return generateEntityMetadata({
    type: 'asset',
    id,
    title: asset.title,
    description: asset.description,
  });
}

export default async function PublicAssetPage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEntityDetailPage id={id} config={assetDetailConfig} />;
}
