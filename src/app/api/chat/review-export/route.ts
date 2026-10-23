/**
 * GET /api/chat/review-export?since=<ISO>&limit=50 — the day's Cat
 * conversations for the fleet's nightly reviewer (Loki), as chatkit's
 * ChatTranscript[]. Bearer CHAT_REVIEW_TOKEN; 401 otherwise, 503 while the
 * token is unset. Reads with the service role: the rows belong to many
 * people and leave here with no name, email, user or actor id.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiUnauthorized, apiServiceUnavailable, handleApiError } from '@/lib/api/standardResponse';
import {
  CHAT_REVIEW_PRODUCT,
  chatReviewScope,
  exportChatTranscripts,
  reviewExportWindow,
  verifyChatReviewToken,
} from '@/services/cat/chat-review-export';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const verdict = verifyChatReviewToken(request);
  if (verdict === 'unconfigured') {
    return apiServiceUnavailable('Chat review export not configured');
  }
  if (verdict === 'unauthorized') {
    return apiUnauthorized();
  }
  try {
    const transcripts = await exportChatTranscripts(
      createAdminClient(),
      reviewExportWindow(request.url)
    );
    // The fleet contract (chatkit 0.14, "The feedback loop") is the bare
    // object, the same from every product, so Loki's fetcher reads one shape;
    // the app's own {success, data} envelope stays on the app's own routes.
    return NextResponse.json(
      { product: CHAT_REVIEW_PRODUCT, scope: chatReviewScope(), transcripts },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
