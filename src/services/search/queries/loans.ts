/**
 * Loan Search Queries
 *
 * Handles database queries for searching public loan listings.
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { getTableName } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import type { SearchLoan, SearchFilters, RawSearchLoan } from '../types';
import { buildProfileMap } from './helpers';
import { ilikeAny } from '@/lib/db/likePattern';

/**
 * Search loans with filters
 */
export async function searchLoans(
  query?: string,
  filters?: SearchFilters,
  limit: number = 20,
  offset: number = 0
): Promise<SearchLoan[]> {
  // Only select necessary columns for better performance
  let loanQuery = supabase
    .from(getTableName('loan'))
    .select(
      `
      id, user_id, title, description, loan_category_id,
      original_amount, remaining_balance, interest_rate, monthly_payment,
      currency, status, loan_type, is_public, is_negotiable,
      created_at, updated_at
    `
    )
    .eq('is_public', true)
    .eq('status', STATUS.LOANS.ACTIVE);

  // Apply text search if query provided
  if (query) {
    loanQuery = loanQuery.or(ilikeAny(['title', 'description'], query));
  }

  // Apply filters
  if (filters) {
    // Note: Loans don't have categories in the same way as projects
    // but we could filter by loan_category_id if needed
    // For now, we'll focus on basic search functionality
  }

  // Use index-friendly ordering
  const { data: rawLoans, error } = await loanQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.warn('Error searching loans', error, 'Search');
    return [];
  }

  if (!rawLoans || rawLoans.length === 0) {
    return [];
  }

  // Fetch profiles for all loans in parallel
  const loanResults = rawLoans as RawSearchLoan[];
  const userIds = [...new Set(loanResults.map(l => l.user_id))];
  const profileMap = await buildProfileMap(userIds);

  // Transform loans with profile data
  const loans: SearchLoan[] = loanResults.map(loan => ({
    ...loan,
    profiles: profileMap.get(loan.user_id),
  }));

  return loans;
}
