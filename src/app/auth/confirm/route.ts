import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/config/brand';
import { landingForSession } from '@/lib/auth/landingForSession';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null;
  // Decided once the email is confirmed (landingForSession): `next` if it is
  // our own path, else the Cat for a new account.
  const next = requestUrl.searchParams.get('next');

  if (token_hash && type) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      return NextResponse.redirect(`${SITE_URL}${await landingForSession(supabase, next)}`);
    }
  }

  // Provide more helpful error messages
  const errorMessage =
    'Email verification failed. The link may have expired or already been used. Please try signing in or request a new verification email.';
  return NextResponse.redirect(
    `${SITE_URL}/auth?error=${encodeURIComponent(errorMessage)}&showResend=true`
  );
}
