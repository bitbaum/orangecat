/**
 * Loans API client — browser-side calls to /api/loans (no direct Supabase writes).
 *
 * UI and hooks must use this (via loansService) so creation, updates, and deletes
 * go through the same validation, rate limits, and domain logic as integrations.
 */

import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';
import type {
  Loan,
  CreateLoanRequest,
  CreateLoanOfferRequest,
  LoanOfferResponse,
  UpdateLoanRequest,
  UpdateLoanOfferRequest,
  LoanResponse,
  CreateLoanPaymentRequest,
  LoanPaymentResponse,
} from '@/types/loans';
import type { ServiceResult } from '@/types/common';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Map a loan record or form payload to the API contract (lib/validation/finance loanSchema). */
export function loanToApiPayload(
  loan: Partial<Loan> & Pick<Loan, 'title' | 'original_amount' | 'remaining_balance'>
): Record<string, unknown> {
  const fulfillment = loan.fulfillment_type as string | undefined;
  const fulfillmentType =
    fulfillment === 'manual' || fulfillment === 'automatic' ? fulfillment : 'manual';

  return {
    loan_type: 'new_request',
    title: loan.title,
    description: loan.description ?? '',
    loan_category_id: loan.loan_category_id ?? null,
    original_amount: loan.original_amount,
    remaining_balance: loan.remaining_balance,
    interest_rate: loan.interest_rate ?? null,
    bitcoin_address: loan.bitcoin_address ?? null,
    lightning_address: loan.lightning_address ?? null,
    fulfillment_type: fulfillmentType,
    currency: loan.currency,
    current_lender: loan.current_lender ?? loan.lender_name ?? null,
    current_interest_rate: loan.current_interest_rate ?? null,
    monthly_payment: loan.monthly_payment ?? null,
    desired_rate: loan.desired_rate ?? null,
    lender_name: loan.lender_name ?? null,
    loan_number: loan.loan_number ?? null,
    origination_date: loan.origination_date ?? null,
    maturity_date: loan.maturity_date ?? null,
    is_public: loan.is_public ?? false,
    is_negotiable: loan.is_negotiable ?? true,
    minimum_offer_amount: loan.minimum_offer_amount ?? null,
    preferred_terms: loan.preferred_terms ?? null,
    contact_method: loan.contact_method ?? 'platform',
    collateral: [],
  };
}

export function createLoanRequestToApiPayload(request: CreateLoanRequest): Record<string, unknown> {
  return loanToApiPayload(request as unknown as Loan);
}

/**
 * Read a standard `{ success, data, error }` API envelope, mapping transport
 * and application errors to a single discriminated result. Shared by every
 * loans-API parser so the ok/success/empty checks live in one place.
 */
async function readEnvelope<T>(
  res: Response
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || json.success === false) {
    return { ok: false, error: apiErrorMessage(json, `Request failed (${res.status})`) };
  }
  if (json.data === undefined || json.data === null) {
    return { ok: false, error: 'Empty response from server' };
  }
  return { ok: true, data: json.data };
}

async function parsePaymentEnvelope(
  res: Response
): Promise<LoanPaymentResponse & { obligationLoan?: Loan }> {
  const env = await readEnvelope<{
    payment?: LoanPaymentResponse['payment'];
    obligationLoan?: Loan;
  }>(res);
  if (!env.ok) {
    return { success: false, error: env.error };
  }
  if (!env.data.payment) {
    return { success: false, error: 'Empty response from server' };
  }
  return {
    success: true,
    payment: env.data.payment,
    ...(env.data.obligationLoan ? { obligationLoan: env.data.obligationLoan } : {}),
  };
}

async function parseLoanEnvelope(res: Response): Promise<LoanResponse> {
  const env = await readEnvelope<Loan>(res);
  return env.ok ? { success: true, loan: env.data } : { success: false, error: env.error };
}

async function parseOfferEnvelope(res: Response): Promise<LoanOfferResponse> {
  const env = await readEnvelope<LoanOfferResponse['offer']>(res);
  return env.ok ? { success: true, offer: env.data } : { success: false, error: env.error };
}

export async function getLoanViaApi(loanId: string): Promise<LoanResponse> {
  try {
    const res = await fetch(API_ROUTES.LOANS.BY_ID(loanId), { credentials: 'include' });
    return parseLoanEnvelope(res);
  } catch (error) {
    logger.error('getLoanViaApi failed', error, 'Loans');
    return { success: false, error: 'Failed to load loan' };
  }
}

export async function createLoanViaApi(request: CreateLoanRequest): Promise<LoanResponse> {
  try {
    const res = await fetch(API_ROUTES.LOANS.BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(createLoanRequestToApiPayload(request)),
    });
    const result = await parseLoanEnvelope(res);
    if (result.success) {
      logger.info('Loan created via API', { loanId: result.loan?.id }, 'Loans');
    }
    return result;
  } catch (error) {
    logger.error('createLoanViaApi failed', error, 'Loans');
    return { success: false, error: 'Failed to create loan' };
  }
}

export async function updateLoanViaApi(
  loanId: string,
  patch: UpdateLoanRequest
): Promise<LoanResponse> {
  try {
    // PUT validates the full loan schema — a full-form patch carries the
    // required fields (title + both amounts); anything less is merged onto the
    // current row first.
    const isFullFormPatch =
      Boolean(patch.title) &&
      patch.original_amount !== undefined &&
      patch.original_amount !== null &&
      patch.remaining_balance !== undefined &&
      patch.remaining_balance !== null;

    let payload: Record<string, unknown>;
    if (isFullFormPatch) {
      payload = loanToApiPayload(patch as Loan);
    } else {
      const current = await getLoanViaApi(loanId);
      if (!current.success || !current.loan) {
        return current;
      }
      // The schema-derived patch allows explicit nulls for optional text
      // fields; loanToApiPayload normalizes them via `?? null`, so the
      // widened merge is safe to treat as a Loan here.
      payload = loanToApiPayload({ ...current.loan, ...patch } as Loan);
    }

    const res = await fetch(API_ROUTES.LOANS.BY_ID(loanId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const result = await parseLoanEnvelope(res);
    if (result.success) {
      logger.info('Loan updated via API', { loanId }, 'Loans');
    }
    return result;
  } catch (error) {
    logger.error('updateLoanViaApi failed', error, 'Loans');
    return { success: false, error: 'Failed to update loan' };
  }
}

export async function createObligationLoanViaApi(params: {
  borrowerId: string;
  lenderProfileName: string;
  offer: {
    loan_id: string;
    offer_amount: number;
    interest_rate?: number;
    term_months?: number;
    currency?: string;
  };
}): Promise<LoanResponse> {
  try {
    const res = await fetch(API_ROUTES.LOANS.OBLIGATION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const result = await parseLoanEnvelope(res);
    if (result.success) {
      logger.info('Obligation loan created via API', { loanId: result.loan?.id }, 'Loans');
    }
    return result;
  } catch (error) {
    logger.error('createObligationLoanViaApi failed', error, 'Loans');
    return { success: false, error: 'Failed to create obligation loan' };
  }
}

export async function createLoanOfferViaApi(
  request: CreateLoanOfferRequest
): Promise<LoanOfferResponse> {
  try {
    const res = await fetch(API_ROUTES.LOANS.OFFERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(request),
    });
    const result = await parseOfferEnvelope(res);
    if (result.success) {
      logger.info('Loan offer created via API', { offerId: result.offer?.id }, 'Loans');
    }
    return result;
  } catch (error) {
    logger.error('createLoanOfferViaApi failed', error, 'Loans');
    return { success: false, error: 'Failed to create offer' };
  }
}

export async function updateLoanOfferViaApi(
  offerId: string,
  request: UpdateLoanOfferRequest
): Promise<LoanOfferResponse> {
  try {
    const res = await fetch(API_ROUTES.LOANS.OFFER_BY_ID(offerId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(request),
    });
    const result = await parseOfferEnvelope(res);
    if (result.success) {
      logger.info('Loan offer updated via API', { offerId }, 'Loans');
    }
    return result;
  } catch (error) {
    logger.error('updateLoanOfferViaApi failed', error, 'Loans');
    return { success: false, error: 'Failed to update offer' };
  }
}

export async function respondToOfferViaApi(
  offerId: string,
  accept: boolean,
  notes?: string
): Promise<LoanOfferResponse> {
  try {
    const res = await fetch(API_ROUTES.LOANS.OFFER_RESPOND(offerId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accept, notes }),
    });
    const result = await parseOfferEnvelope(res);
    if (result.success) {
      logger.info('Loan offer responded via API', { offerId, accept }, 'Loans');
    }
    return result;
  } catch (error) {
    logger.error('respondToOfferViaApi failed', error, 'Loans');
    return { success: false, error: 'Failed to respond to offer' };
  }
}

export async function createPaymentViaApi(
  request: CreateLoanPaymentRequest
): Promise<LoanPaymentResponse> {
  try {
    const res = await fetch(API_ROUTES.LOANS.PAYMENTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(request),
    });
    const env = await readEnvelope<NonNullable<LoanPaymentResponse['payment']>>(res);
    if (!env.ok) {
      return { success: false, error: env.error };
    }
    logger.info('Loan payment created via API', { paymentId: env.data.id }, 'Loans');
    return { success: true, payment: env.data };
  } catch (error) {
    logger.error('createPaymentViaApi failed', error, 'Loans');
    return { success: false, error: 'Failed to create payment' };
  }
}

export async function completePaymentViaApi(
  paymentId: string,
  options?: { createObligation?: { lenderProfileName: string } }
): Promise<LoanPaymentResponse & { obligationLoan?: Loan }> {
  try {
    const res = await fetch(API_ROUTES.LOANS.PAYMENT_COMPLETE(paymentId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(options ?? {}),
    });
    const result = await parsePaymentEnvelope(res);
    if (result.success) {
      logger.info('Loan payment completed via API', { paymentId }, 'Loans');
    }
    return result;
  } catch (error) {
    logger.error('completePaymentViaApi failed', error, 'Loans');
    return { success: false, error: 'Failed to complete payment' };
  }
}

export async function deleteLoanViaApi(loanId: string): Promise<ServiceResult> {
  try {
    const res = await fetch(API_ROUTES.LOANS.BY_ID(loanId), {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = (await res.json().catch(() => ({}))) as ApiEnvelope<unknown>;
    if (!res.ok || json.success === false) {
      return { success: false, error: apiErrorMessage(json, `Request failed (${res.status})`) };
    }
    logger.info('Loan deleted via API', { loanId }, 'Loans');
    return { success: true };
  } catch (error) {
    logger.error('deleteLoanViaApi failed', error, 'Loans');
    return { success: false, error: 'Failed to delete loan' };
  }
}
