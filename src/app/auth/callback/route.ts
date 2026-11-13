import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { SITE_URL } from '@/config/brand';
import { landingForSession } from '@/lib/auth/landingForSession';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // Where to go is decided after the session exists (landingForSession):
  // `next` if it is our own path, else the Cat for a new account and the
  // dashboard for a returning one.
  const next = requestUrl.searchParams.get('next');

  if (code) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        return NextResponse.redirect(
          `${SITE_URL}/auth?error=${encodeURIComponent('Authentication failed. Please try again.')}`
        );
      }

      return NextResponse.redirect(`${SITE_URL}${await landingForSession(supabase, next)}`);
    } catch {
      return NextResponse.redirect(
        `${SITE_URL}/auth?error=${encodeURIComponent('An unexpected error occurred during authentication')}`
      );
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${SITE_URL}/auth?error=${encodeURIComponent('No code provided')}`);
}
