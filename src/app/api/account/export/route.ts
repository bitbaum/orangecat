/**
 * GET /api/account/export — download the person's data as JSON (data controls).
 *
 * GDPR / Swiss-DSG "export my data". What the file holds, and what it leaves
 * out on purpose, is decided in one place: exportAccount
 * (src/domain/account/exportAccount.ts), which also writes the manifest.
 * Reads go through the request-scoped (RLS) client.
 */

import { apiRateLimited, handleApiError } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { ACCOUNT_EXPORT_FILENAME } from '@/config/api-routes';
import { exportAccount } from '@/domain/account/exportAccount';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;

  // Heavy read — use the stricter write-tier limit to prevent hammering.
  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many export requests. Please slow down.', retryAfterSeconds(rl));
  }

  try {
    const payload = await exportAccount(supabase, user.id);

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${ACCOUNT_EXPORT_FILENAME}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
});
