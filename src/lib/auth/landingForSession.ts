import { DATABASE_TABLES } from '@/config/database-tables';
import type { createServerClient } from '@/lib/supabase/server';
import { landingAfterSignIn } from './landing';

/**
 * landingAfterSignIn for a server route that has just created the session
 * (the Google/GitHub callback, the email confirmation link): it reads whether
 * the account is new from the account, not from the URL, so a returning person
 * signing in with Google is not greeted as new.
 */
export async function landingForSession(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  from: string | null
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return landingAfterSignIn({ from, isNewAccount: true, onboardingCompleted: undefined });
  }
  const { data: profile, error } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle<{ onboarding_completed: boolean | null }>();
  return landingAfterSignIn({
    from,
    isNewAccount: !!user.is_anonymous,
    // No row yet: the account was made a moment ago. A failed read says
    // nothing either way, and a returning person is the safer guess.
    onboardingCompleted: error ? undefined : (profile?.onboarding_completed ?? null),
  });
}
