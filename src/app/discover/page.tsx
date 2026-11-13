/**
 * /discover — browse and search everything public, rendered on the server.
 *
 * It used to be a client app that ran four to fourteen queries from the
 * browser on every keystroke, against three different engines, and threw the
 * search ranking away by re-sorting newest first. Now the URL decides what is
 * shown (services/discover/params.ts), one engine answers it
 * (services/discover/view.ts), and the HTML that arrives is the page — which
 * is also what search engines and AI crawlers read.
 */

import type { Metadata } from 'next';
import { DiscoverScreen } from '@/components/discover/DiscoverScreen';
import { pluralLabel } from '@/components/discover/DiscoverChips';
import { parseDiscoverParams } from '@/services/discover/params';
import { loadDiscoverView } from '@/services/discover/view';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q, type } = parseDiscoverParams(await searchParams);
  // A results page for one query is not a page worth indexing; the shelf is.
  if (q) {
    return { title: `“${q}” — Discover`, robots: { index: false, follow: true } };
  }
  // One kind's page is named for the kind, as its heading is.
  return type ? { title: `${pluralLabel(type)} — Discover` } : {};
}

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseDiscoverParams(await searchParams);
  const view = await loadDiscoverView(params);
  return <DiscoverScreen params={params} view={view} />;
}
