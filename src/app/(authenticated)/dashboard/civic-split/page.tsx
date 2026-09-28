import type { Metadata } from 'next';
import { CIVIC_SPLIT_COPY } from '@/config/civic-split';
import { CivicSplitScreen } from '@/components/civic-split/CivicSplitScreen';

export const metadata: Metadata = {
  title: CIVIC_SPLIT_COPY.title,
  description: CIVIC_SPLIT_COPY.question,
};

export default function CivicSplitPage() {
  return <CivicSplitScreen />;
}
