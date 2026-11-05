import { NextRequest } from 'next/server';
import { compose } from '@/lib/api/compose';
import { withRateLimit } from '@/lib/api/withRateLimit';
import { withRequestId } from '@/lib/api/withRequestId';
import { apiError, apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import {
  IMPORT_MAX_BYTES,
  importSourceAllowed,
  parseImportedArticle,
} from '@/services/articles/import-source';

// GET /api/articles/import?url=<fleet article JSON>
//
// The composer cannot read a sister product's JSON directly (another origin),
// so the server reads it: fleet hosts only, over HTTPS, bounded in time and
// size, and the shape is checked before anything reaches the editor.
export const GET = compose(
  withRequestId(),
  withRateLimit('read')
)(async (request: NextRequest) => {
  try {
    const raw = new URL(request.url).searchParams.get('url') ?? '';
    const source = importSourceAllowed(raw);
    if (!source) {
      return apiError(
        'Articles can be imported from fleet sites only.',
        'IMPORT_HOST_NOT_ALLOWED',
        400
      );
    }
    const response = await fetch(source, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!response.ok) {
      return apiError('That article could not be read.', 'IMPORT_UNREADABLE', 502);
    }
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > IMPORT_MAX_BYTES) {
      return apiError('That article is too large to import.', 'IMPORT_TOO_LARGE', 413);
    }
    const text = await response.text();
    if (text.length > IMPORT_MAX_BYTES) {
      return apiError('That article is too large to import.', 'IMPORT_TOO_LARGE', 413);
    }
    const article = parseImportedArticle(JSON.parse(text), source.hostname);
    if (!article) {
      return apiError('That link is not an article.', 'IMPORT_NOT_ARTICLE', 422);
    }
    return apiSuccess(article);
  } catch (error) {
    return handleApiError(error);
  }
});
