import { Metadata } from 'next';
import { generateEntityMetadata } from '@/lib/seo/metadata';
import PublicEntityDetailPage, {
  fetchEntityForMetadata,
} from '@/components/public/PublicEntityDetailPage';
import { investmentDetailConfig } from '@/components/public/detail-configs/investment';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const investment = await fetchEntityForMetadata(
    'investment',
    id,
    'title, description',
    investmentDetailConfig.visibilityFilter
  );
  if (!investment) {
    return {
      title: 'Investment Not Found',
      description: 'The investment you are looking for does not exist.',
    };
  }
  return generateEntityMetadata({
    type: 'investment',
    id,
    title: investment.title,
    description: investment.description,
  });
}

export default async function PublicInvestmentPage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEntityDetailPage id={id} config={investmentDetailConfig} />;
}
