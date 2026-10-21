/**
 * Ways to be paid — the rows behind "Twint, PayPal, a bank" on /receive and on
 * the public pay page.
 *
 * Writes go through the CALLER's client so RLS is what enforces ownership.
 * The public read goes through the admin client, scoped to one username per
 * call: the rows are public by intent (they are printed on the pay page), but a
 * table-wide anonymous SELECT would hand every phone number and IBAN to a
 * crawler in one request.
 *
 * Nothing here marks a payment. These settle in other people's apps.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';
import { fromTable } from '@/lib/supabase/untyped';
import { DATABASE_TABLES } from '@/config/database-tables';
import {
  PAYMENT_LABEL_MAX_LENGTH,
  PAYMENT_METHODS,
  PAYMENT_METHODS_COPY,
  PAYMENT_METHODS_MAX_PER_ACCOUNT,
  isPaymentMethodId,
  type PaymentMethodId,
  type PaymentVisibility,
} from '@/config/payment-methods';
import { normalizePaymentHandle } from '@/lib/payments/payment-handle';
import { logger } from '@/utils/logger';

export interface PaymentMethodRow {
  id: string;
  method: PaymentMethodId;
  handle: string;
  label: string | null;
  visibility: PaymentVisibility;
  display_order: number;
  is_active: boolean;
}

/**
 * What a payer sees. An `on_request` row's handle is null HERE, on the
 * server — the page shows the name and an Ask button, and the number or IBAN
 * never travels to a public reader at all.
 */
export interface PublicPaymentMethod {
  id: string;
  method: PaymentMethodId;
  handle: string | null;
  label: string | null;
  visibility: PaymentVisibility;
}

export function toPublicPaymentMethod(row: PaymentMethodRow): PublicPaymentMethod {
  return {
    id: row.id,
    method: row.method,
    handle: row.visibility === 'public' ? row.handle : null,
    label: row.label,
    visibility: row.visibility,
  };
}

export interface PaymentMethodFailure {
  ok: false;
  reason: 'invalid_method' | 'invalid_handle' | 'too_many' | 'not_found';
  message: string;
}

const COLUMNS = 'id, method, handle, label, visibility, display_order, is_active';

const fail = (reason: PaymentMethodFailure['reason'], message: string): PaymentMethodFailure => ({
  ok: false,
  reason,
  message,
});

/** Rows whose method the registry no longer knows are dropped, not rendered as "undefined". */
function knownRows(rows: unknown[] | null): PaymentMethodRow[] {
  return ((rows ?? []) as PaymentMethodRow[]).filter(row => isPaymentMethodId(row.method));
}

export async function listOwnPaymentMethods(
  supabase: SupabaseClient,
  profileId: string
): Promise<PaymentMethodRow[]> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.PAYMENT_METHODS)
    .select(COLUMNS)
    .eq('profile_id', profileId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    logger.error('list payment methods failed', { error }, 'PaymentMethods');
    throw new Error('Could not load your ways to be paid.');
  }
  return knownRows(data);
}

/**
 * A rail whose handle is a phone number is shared on request, whatever the
 * caller asked for. The add sheet already picks this, but the API is the
 * boundary: a phone number never becomes public by omission or by a client
 * that sends `public`. Every other rail keeps the caller's choice.
 */
export function visibilityFor(
  method: PaymentMethodId,
  requested: PaymentVisibility | undefined
): PaymentVisibility {
  if (PAYMENT_METHODS[method].reveals.includes('phone')) {
    return 'on_request';
  }
  return requested ?? 'public';
}

export async function addPaymentMethod(
  supabase: SupabaseClient,
  profileId: string,
  input: {
    method: string;
    handle: string;
    label?: string | null;
    visibility?: PaymentVisibility;
  }
): Promise<{ ok: true; row: PaymentMethodRow } | PaymentMethodFailure> {
  if (!isPaymentMethodId(input.method)) {
    return fail('invalid_method', 'That is not a payment method we know.');
  }
  const handle = normalizePaymentHandle(input.method, input.handle);
  if (!handle) {
    return fail(
      'invalid_handle',
      PAYMENT_METHODS_COPY.invalidHandle(PAYMENT_METHODS[input.method].handleLabel)
    );
  }

  const existing = await listOwnPaymentMethods(supabase, profileId);
  if (existing.length >= PAYMENT_METHODS_MAX_PER_ACCOUNT) {
    return fail('too_many', PAYMENT_METHODS_COPY.tooMany);
  }

  const { data, error } = await fromTable(supabase, DATABASE_TABLES.PAYMENT_METHODS)
    .insert({
      profile_id: profileId,
      method: input.method,
      handle,
      label: input.label?.trim().slice(0, PAYMENT_LABEL_MAX_LENGTH) || null,
      visibility: visibilityFor(input.method, input.visibility),
      display_order: existing.length,
    })
    .select(COLUMNS)
    .single();

  if (error || !data) {
    logger.error('payment method insert failed', { error }, 'PaymentMethods');
    throw new Error('Could not save that. Try again.');
  }
  return { ok: true, row: data as PaymentMethodRow };
}

export async function removePaymentMethod(
  supabase: SupabaseClient,
  id: string
): Promise<{ ok: true } | PaymentMethodFailure> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.PAYMENT_METHODS)
    .delete()
    .eq('id', id)
    .select('id');
  if (error) {
    logger.error('payment method delete failed', { error }, 'PaymentMethods');
    throw new Error('Could not remove that. Try again.');
  }
  // RLS turns someone else's id into zero rows, which is the same answer.
  return (data ?? []).length > 0 ? { ok: true } : fail('not_found', 'That way to be paid is gone.');
}

/**
 * The active methods one account shows the public, by profile id.
 * Admin client, one profile per call — see the module note.
 */
export async function listPublicPaymentMethods(profileId: string): Promise<PublicPaymentMethod[]> {
  const admin = getAdminClient() as unknown as SupabaseClient;
  const { data, error } = await fromTable(admin, DATABASE_TABLES.PAYMENT_METHODS)
    .select(COLUMNS)
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    // The pay page still renders its Bitcoin half; a missing list is not a dead page.
    logger.warn('public payment methods lookup failed', { error, profileId }, 'PaymentMethods');
    return [];
  }
  return knownRows(data).map(toPublicPaymentMethod);
}
