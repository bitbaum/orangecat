/**
 * GET /api/capital/[slug] — a product's Fund / Lend / Invest rails, public.
 *
 * Loki's roadmap and investors pages read this so the money behind a product
 * is shown in the open beside the road it pays for. Everything returned is
 * what a stranger could already read on the entities' own public pages; the
 * service reads through a sessionless client so RLS keeps it that way.
 */

import { apiNotFound, apiServiceUnavailable, apiSuccess } from '@/lib/api/standardResponse';
import { isCapitalSlug } from '@/config/capital';
import { loadOpenCapital } from '@/services/capital/open-capital';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isCapitalSlug(slug)) {
    return apiNotFound('No capital rails for that product');
  }
  const capital = await loadOpenCapital(slug);
  if (!capital) {
    return apiServiceUnavailable('Capital figures are unavailable right now.');
  }
  return apiSuccess(capital, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      // Read cross-origin by Loki's server and, potentially, its browser.
      'Access-Control-Allow-Origin': '*',
    },
  });
}
