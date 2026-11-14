import { Metadata } from 'next';
import { generateEntityMetadata } from '@/lib/seo/metadata';
import PublicEntityDetailPage, {
  fetchEntityForMetadata,
} from '@/components/public/PublicEntityDetailPage';
import { productDetailConfig } from '@/components/public/detail-configs/product';
import { notFoundTitle } from '@/config/not-found';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchEntityForMetadata('product', id);
  if (!product) {
    return {
      title: notFoundTitle('product'),
      description: 'The product you are looking for does not exist.',
    };
  }
  return generateEntityMetadata({
    type: 'product',
    id,
    title: product.title,
    description: product.description,
  });
}

export default async function PublicProductPage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEntityDetailPage id={id} config={productDetailConfig} />;
}
