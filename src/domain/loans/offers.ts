/**
 * Loan offer domain — create, update, and borrower response flows.
 */

import { STATUS } from '@/config/database-constants';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import type { CreateLoanOfferRequest, UpdateLoanOfferRequest } from '@/types/loans';

export type LoanOfferRow = Record<string, unknown> & { id: string };

type OfferResult =
  | { ok: true; offer: LoanOfferRow }
  | {
      ok: false;
      reason:
        'loan_not_found' | 'forbidden' | 'below_minimum' | 'not_found' | 'invalid_state' | 'error';
      message: string;
    };

type LoanLookup = {
  id: string;
  user_id: string;
  status: string | null;
  minimum_offer_amount: number | null;
};

async function loadLoan(
  supabase: AnySupabaseClient,
  loanId: string
): Promise<{ loan: LoanLookup | null; error: unknown }> {
  const { data, error } = await supabase
    .from(getTableName('loan'))
    .select('id, user_id, status, minimum_offer_amount')
    .eq('id', loanId)
    .maybeSingle();
  return { loan: (data as LoanLookup | null) ?? null, error };
}

export async function createLoanOffer(
  userId: string,
  input: CreateLoanOfferRequest,
  supabase: AnySupabaseClient
): Promise<OfferResult> {
  const { loan, error } = await loadLoan(supabase, input.loan_id);
  if (error) {
    logger.error('Failed to verify loan for offer creation', error, 'LoanOffers');
    return { ok: false, reason: 'error', message: 'Failed to verify loan' };
  }
  if (!loan || loan.status !== STATUS.LOANS.ACTIVE) {
    return { ok: false, reason: 'loan_not_found', message: 'Loan not found or not active' };
  }
  if (loan.user_id === userId) {
    return { ok: false, reason: 'forbidden', message: 'Cannot offer on your own loan' };
  }
  if (
    loan.minimum_offer_amount !== null &&
    loan.minimum_offer_amount !== undefined &&
    input.offer_amount < loan.minimum_offer_amount
  ) {
    return {
      ok: false,
      reason: 'below_minimum',
      message: 'Offer amount below minimum required',
    };
  }

  const { data, error: insertError } = await supabase
    .from(DATABASE_TABLES.LOAN_OFFERS)
    .insert({
      loan_id: input.loan_id,
      offerer_id: userId,
      offer_type: input.offer_type,
      offer_amount: input.offer_amount,
      interest_rate: input.interest_rate ?? null,
      term_months: input.term_months ?? null,
      terms: input.terms ?? null,
      conditions: input.conditions ?? null,
      is_binding: input.is_binding ?? false,
      status: STATUS.LOAN_OFFERS.PENDING,
    })
    .select('*')
    .single();

  if (insertError) {
    logger.error('Failed to create loan offer', insertError, 'LoanOffers');
    return { ok: false, reason: 'error', message: 'Failed to create offer' };
  }

  return { ok: true, offer: data as LoanOfferRow };
}

export async function updateLoanOffer(
  userId: string,
  offerId: string,
  input: UpdateLoanOfferRequest,
  supabase: AnySupabaseClient
): Promise<OfferResult> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.LOAN_OFFERS)
    .update(input)
    .eq('id', offerId)
    .eq('offerer_id', userId)
    .select('*')
    .maybeSingle();

  if (error) {
    logger.error('Failed to update loan offer', error, 'LoanOffers');
    return { ok: false, reason: 'error', message: 'Failed to update offer' };
  }
  if (!data) {
    return { ok: false, reason: 'not_found', message: 'Offer not found' };
  }

  return { ok: true, offer: data as LoanOfferRow };
}

export async function respondToLoanOffer(
  userId: string,
  offerId: string,
  accept: boolean,
  supabase: AnySupabaseClient
): Promise<OfferResult> {
  const { data: offer, error: fetchError } = await supabase
    .from(DATABASE_TABLES.LOAN_OFFERS)
    .select('id, loan_id, status, loans!inner(user_id)')
    .eq('id', offerId)
    .maybeSingle();

  if (fetchError) {
    logger.error('Failed to fetch loan offer', fetchError, 'LoanOffers');
    return { ok: false, reason: 'error', message: 'Failed to load offer' };
  }
  if (!offer) {
    return { ok: false, reason: 'not_found', message: 'Offer not found' };
  }

  const joinedLoans = (offer as { loans: Array<{ user_id: string }> | { user_id: string } }).loans;
  const ownerUserId = Array.isArray(joinedLoans) ? joinedLoans[0]?.user_id : joinedLoans.user_id;
  if (ownerUserId !== userId) {
    return { ok: false, reason: 'forbidden', message: 'Unauthorized to respond to this offer' };
  }
  if ((offer as { status: string | null }).status !== STATUS.LOAN_OFFERS.PENDING) {
    return {
      ok: false,
      reason: 'invalid_state',
      message: 'Only pending offers can be accepted or rejected',
    };
  }

  const status = accept ? STATUS.LOAN_OFFERS.ACCEPTED : STATUS.LOAN_OFFERS.REJECTED;
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    status,
    ...(accept ? { accepted_at: now, rejected_at: null } : { rejected_at: now, accepted_at: null }),
  };

  const { data, error } = await supabase
    .from(DATABASE_TABLES.LOAN_OFFERS)
    .update(updateData)
    .eq('id', offerId)
    .select('*')
    .single();

  if (error) {
    logger.error('Failed to respond to loan offer', error, 'LoanOffers');
    return { ok: false, reason: 'error', message: 'Failed to respond to offer' };
  }

  return { ok: true, offer: data as LoanOfferRow };
}
