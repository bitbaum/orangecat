/**
 * LOANS SERVICE - Loan Queries
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Extracted from loans/index.ts for modularity
 */

import { callRpc, fromTable } from '@/lib/supabase/untyped';
import supabase from '@/lib/supabase/browser';
import { narrowLoan, narrowLoans } from './narrow';
import { logger } from '@/utils/logger';
import { getTableName } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import type {
  LoanResponse,
  LoansListResponse,
  LoansQuery,
  Pagination,
  LoanCategory,
} from '@/types/loans';
import { STATUS } from '@/config/database-constants';
import { getCurrentUserId } from '../utils/auth';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, paginationRange } from '@/constants/pagination';
import { getUserActorId } from '@/domain/actors';

/**
 * Get a specific loan by ID
 */
export async function getLoan(loanId: string): Promise<LoanResponse> {
  try {
    const userId = await getCurrentUserId();

    let query = supabase
      .from(getTableName('loan'))
      .select(
        `
        *,
        loan_categories (
          id,
          name,
          description,
          icon
        )
      `
      )
      .eq('id', loanId);

    // If user is authenticated, they can see their own loans or public loans
    if (userId) {
      query = query.or(`user_id.eq.${userId},is_public.eq.true`);
    } else {
      query = query.eq('is_public', true);
    }

    const { data, error } = await query.single();

    if (error) {
      logger.error('Failed to get loan', error, 'Loans');
      return { success: false, error: error.message };
    }

    return { success: true, loan: narrowLoan(data) };
  } catch (error) {
    logger.error('Exception getting loan', error, 'Loans');
    return { success: false, error: 'Failed to get loan' };
  }
}

/**
 * Get loans for current user
 */
export async function getUserLoans(
  query?: LoansQuery,
  pagination?: Pagination
): Promise<LoansListResponse> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Resolve user to actor for ownership filtering

    const actorId = await getUserActorId(supabase, userId);
    const actor = actorId ? { id: actorId } : null;

    if (!actor) {
      return { success: true, loans: [], total: 0 };
    }

    let dbQuery = supabase
      .from(getTableName('loan'))
      .select(
        `
        *,
        loan_categories (
          id,
          name,
          description,
          icon
        )
      `,
        { count: 'exact' }
      )
      .eq('actor_id', actor.id);

    // Apply filters
    if (query?.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query?.is_public !== undefined) {
      dbQuery = dbQuery.eq('is_public', query.is_public);
    }
    if (query?.category_id) {
      dbQuery = dbQuery.eq('loan_category_id', query.category_id);
    }
    if (query?.min_amount) {
      dbQuery = dbQuery.gte('remaining_balance', query.min_amount);
    }
    if (query?.max_amount) {
      dbQuery = dbQuery.lte('remaining_balance', query.max_amount);
    }

    // Apply sorting
    const sortBy = query?.sort_by || 'created_at';
    const sortOrder = query?.sort_order || 'desc';
    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const { from, to } = paginationRange(pagination);
    dbQuery = dbQuery.range(from, to);

    const { data, error, count } = await dbQuery;

    if (error) {
      logger.error('Failed to get user loans', error, 'Loans');
      return { success: false, error: error.message };
    }

    return { success: true, loans: narrowLoans(data || []), total: count || 0 };
  } catch (error) {
    logger.error('Exception getting user loans', error, 'Loans');
    return { success: false, error: 'Failed to get loans' };
  }
}

/**
 * Get available loans for offering (public loans from other users)
 */
export async function getAvailableLoans(
  query?: LoansQuery,
  pagination?: Pagination
): Promise<LoansListResponse> {
  try {
    const userId = await getCurrentUserId();

    // Use the database function for efficiency
    const pageSize = Math.min(pagination?.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = pagination?.offset || 0;

    const { data, error } = await callRpc(supabase, 'get_available_loans', {
      p_user_id: userId || null,
      p_limit: pageSize,
      p_offset: offset,
    });

    if (error) {
      logger.warn('Database function not available, using fallback', error, 'Loans');

      // Fallback query
      let dbQuery = fromTable(supabase, getTableName('loan'))
        .select(
          `
          *,
          loan_categories (
            id,
            name,
            description,
            icon
          ),
          profiles!loans_user_id_fkey (
            username,
            display_name:name,
            avatar_url
          )
        `,
          { count: 'exact' }
        )
        .eq('is_public', true)
        .eq('status', STATUS.LOANS.ACTIVE);

      if (userId) {
        dbQuery = dbQuery.neq('user_id', userId);
      }

      // Apply filters
      if (query?.category_id) {
        dbQuery = dbQuery.eq('loan_category_id', query.category_id);
      }
      if (query?.min_amount) {
        dbQuery = dbQuery.gte('remaining_balance', query.min_amount);
      }
      if (query?.max_amount) {
        dbQuery = dbQuery.lte('remaining_balance', query.max_amount);
      }

      dbQuery = dbQuery.order('created_at', { ascending: false });
      dbQuery = dbQuery.range(offset, offset + pageSize - 1);

      const fallbackResult = await dbQuery;
      if (fallbackResult.error) {
        logger.error('Fallback query failed', fallbackResult.error, 'Loans');
        return { success: false, error: fallbackResult.error.message };
      }

      return { success: true, loans: fallbackResult.data || [], total: fallbackResult.count || 0 };
    }

    return { success: true, loans: data || [], total: data?.length || 0 };
  } catch (error) {
    logger.error('Exception getting available loans', error, 'Loans');
    return { success: false, error: 'Failed to get available loans' };
  }
}

/**
 * Get all loan categories
 */
export async function getLoanCategories(): Promise<{
  success: boolean;
  categories?: LoanCategory[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.LOAN_CATEGORIES)
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      logger.error('Failed to get loan categories', error, 'Loans');
      return { success: false, error: error.message };
    }

    return { success: true, categories: data || [] };
  } catch (error) {
    logger.error('Exception getting loan categories', error, 'Loans');
    return { success: false, error: 'Failed to get categories' };
  }
}
