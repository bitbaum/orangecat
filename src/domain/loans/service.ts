import { createServerClient } from '@/lib/supabase/server';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { STATUS } from '@/config/database-constants';
import { createEntity, withResolvedActor } from '@/domain/base/entityService';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface CreateLoanInput {
  loan_type?: 'new_request' | 'existing_refinance';
  title: string;
  description?: string;
  loan_category_id?: string | null;
  original_amount: number;
  remaining_balance: number;
  interest_rate?: number | null;
  bitcoin_address?: string | null;
  lightning_address?: string | null;
  fulfillment_type?: 'manual' | 'automatic';
  // Fields for existing loan refinancing
  current_lender?: string | null;
  current_interest_rate?: number | null;
  monthly_payment?: number | null;
  desired_rate?: number | null;
  currency?: string;
  show_on_profile?: boolean;
}

export async function createLoan(
  userId: string,
  input: CreateLoanInput,
  supabase?: Awaited<ReturnType<typeof createServerClient>>
) {
  const mode = process.env.LOANS_WRITE_MODE || 'db';
  if (mode === 'mock') {
    throw new Error('Mock mode is disabled by policy. Set LOANS_WRITE_MODE=db');
  }

  const loanInput = input;

  // Normalize empty strings to null for UUID and optional fields
  const normalizeToNull = <T>(value: T): T | null => {
    if (value === '' || value === undefined) {
      return null;
    }
    return value;
  };

  const data = await createEntity(
    'loan',
    userId,
    withResolvedActor(input, {
      user_id: userId,
      title: loanInput.title,
      description: loanInput.description || '',
      loan_type: loanInput.loan_type || 'new_request',
      // New schema fields
      original_amount: loanInput.original_amount,
      remaining_balance: loanInput.remaining_balance,
      interest_rate: normalizeToNull(loanInput.interest_rate),
      loan_category_id: normalizeToNull(loanInput.loan_category_id),
      bitcoin_address: normalizeToNull(loanInput.bitcoin_address),
      lightning_address: normalizeToNull(loanInput.lightning_address),
      fulfillment_type: loanInput.fulfillment_type || 'manual',
      currency: loanInput.currency || PLATFORM_DEFAULT_CURRENCY,
      // Refinancing fields
      current_lender: normalizeToNull(loanInput.current_lender),
      current_interest_rate: normalizeToNull(loanInput.current_interest_rate),
      monthly_payment: normalizeToNull(loanInput.monthly_payment),
      desired_rate: normalizeToNull(loanInput.desired_rate),
      // Defaults match the EntityCreationSuccess UX contract: every entity
      // lands as draft and not publicly visible until the user hits Publish
      // Now. Earlier this service forced status=ACTIVE and never set
      // is_public — DB column defaults filled in is_public=true and
      // is_negotiable=true so the row landed publicly visible immediately,
      // contradicting the "saved as a draft. not visible to anyone yet"
      // success message. Same bug class as the wishlist fix in c9897f9a;
      // matching shape here.
      status: STATUS.LOANS.DRAFT,
      is_public: false,
      // Respect the form's "Show on Public Profile" toggle. Without this the
      // insert omits the column and the DB default (true) always wins, so an
      // unchecked box was silently ignored — the loan showed on the profile
      // anyway once published. Defaults true (matches DB + other entities) when
      // the caller omits it.
      show_on_profile: loanInput.show_on_profile ?? true,
      amount: loanInput.original_amount,
    }),
    {
      client: supabase as unknown as AnySupabaseClient,
    }
  );

  return data;
}
