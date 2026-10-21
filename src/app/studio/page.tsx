import type { Metadata } from 'next';
import { CreativeStudio } from '@/components/studio/CreativeStudio';
export const metadata: Metadata = {
  title: 'The Studio — start with a feeling',
  description:
    'Turn a memory, feeling or scene into music, writing or artistic direction. Create and revise together.',
};
export default function StudioPage() {
  return <CreativeStudio />;
}
