import { Metadata } from 'next';
import { generateEntityMetadata } from '@/lib/seo/metadata';
import PublicEntityDetailPage, {
  fetchEntityForMetadata,
} from '@/components/public/PublicEntityDetailPage';
import { loanDetailConfig } from '@/components/public/detail-configs/loan';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const loan = await fetchEntityForMetadata(
    'loan',
    id,
    'title, description, original_amount, currency',
    loanDetailConfig.visibilityFilter
  );

  if (!loan) {
    return {
      title: 'Loan Not Found',
      description: 'The loan you are looking for does not exist.',
    };
  }

  const description = loan.description || `${loan.title} - Peer-to-peer Bitcoin loan on OrangeCat.`;
  return generateEntityMetadata({ type: 'loan', id, title: loan.title, description });
}

export default async function PublicLoanDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEntityDetailPage id={id} config={loanDetailConfig} />;
}
