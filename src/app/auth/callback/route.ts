import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { SITE_URL } from '@/config/brand';
import { ROUTES } from '@/config/routes';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // Default to Cat page — primary interface for new users
  // Only allow internal paths (must start with /) to prevent open redirect attacks
  const rawNext = requestUrl.searchParams.get('next') || ROUTES.DASHBOARD.CAT_WELCOME;
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : ROUTES.DASHBOARD.CAT_WELCOME;

  if (code) {
    try {
      const supabase = await createServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        return NextResponse.redirect(`${SITE_URL}/auth?error=failed`);
      }

      // Successfully authenticated, redirect to Cat — the primary interface
      return NextResponse.redirect(`${SITE_URL}${next}`);
    } catch {
      return NextResponse.redirect(`${SITE_URL}/auth?error=failed`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${SITE_URL}/auth?error=failed`);
}
