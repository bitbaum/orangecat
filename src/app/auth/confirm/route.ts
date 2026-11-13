import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/config/brand';
import { ROUTES } from '@/config/routes';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
  // Default to Cat page — the primary interface for new users after email confirmation
  const rawNext = requestUrl.searchParams.get('next') ?? ROUTES.DASHBOARD.CAT_WELCOME;
  // Only allow internal paths (must start with /) to prevent open redirect attacks
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : ROUTES.DASHBOARD.CAT_WELCOME;

  if (token_hash && type) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Email confirmed — redirect to Cat, the primary interface
      return NextResponse.redirect(`${SITE_URL}${next}`);
    }
  }

  // A code, not a sentence: the page shows fixed copy for it (auth/url-error).
  return NextResponse.redirect(`${SITE_URL}/auth?error=link_expired&showResend=true`);
}
