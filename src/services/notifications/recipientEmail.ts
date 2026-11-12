/**
 * Where a person's email goes: one answer for every notification path.
 *
 * In order: the contact address the person chose, then their account
 * address. An identity (ADR-0014) has neither it can read: its account sits
 * on an undeliverable `.invalid` address. Mail for an identity therefore goes
 * to the account that holds it, which is the same person, so payments,
 * bookings and messages on an identity still reach them. The holder's
 * address goes nowhere else: it is only ever the recipient.
 *
 * Three copies of the first two steps lived in the email service, the
 * dispatcher and the seller notification; each mailed `.invalid` addresses.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { isUnreachableEmail } from '@/config/identities';
import { looseClient } from '@/lib/supabase/untyped';

export interface RecipientEmail {
  email: string;
  /** The name to greet: the person as they appear in the account the mail is about. */
  displayName: string | null;
}

async function ownAddress(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: profile } = await looseClient(admin)
    .from(DATABASE_TABLES.PROFILES)
    .select('contact_email')
    .eq('id', userId)
    .maybeSingle();
  const contact = (profile?.contact_email as string | null | undefined)?.trim() || null;
  if (contact && !isUnreachableEmail(contact)) {
    return contact;
  }
  const { data } = await admin.auth.admin.getUserById(userId);
  const account = data?.user?.email ?? null;
  return account && !isUnreachableEmail(account) ? account : null;
}

/**
 * The address to mail about `userId`, or null when there is none to use.
 * Reads private columns (contact_email, the account address, identity links),
 * so it takes the service-role client itself rather than trusting a caller's.
 */
export async function resolveRecipientEmail(userId: string): Promise<RecipientEmail | null> {
  const admin = getAdminClient() as unknown as SupabaseClient;
  const db = looseClient(admin);
  const { data: profile } = await db
    .from(DATABASE_TABLES.PROFILES)
    .select('name, username')
    .eq('id', userId)
    .maybeSingle();
  const displayName =
    (profile?.name as string | null | undefined) ||
    (profile?.username as string | null | undefined) ||
    null;

  const own = await ownAddress(admin, userId);
  if (own) {
    return { email: own, displayName };
  }

  const { data: link } = await db
    .from(DATABASE_TABLES.IDENTITY_LINKS)
    .select('holder_user_id')
    .eq('identity_user_id', userId)
    .maybeSingle();
  const holderId = link?.holder_user_id as string | undefined;
  if (!holderId) {
    return null;
  }
  const holderAddress = await ownAddress(admin, holderId);
  return holderAddress ? { email: holderAddress, displayName } : null;
}
