/**
 * Financial entity domain creation tests
 *
 * Covers createLoan and createInvestment domain functions which use
 * the base createEntity helper (actor-based ownership, table from registry).
 * Verifies correct table routing, actor_id injection, defaults, and
 * status values.
 */

import { createLoan } from '@/domain/loans/service';
import { createInvestment } from '@/domain/investments/service';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/services/actors/getOrCreateUserActor', () => ({
  getOrCreateUserActor: vi.fn().mockResolvedValue({ id: 'actor-001' }),
}));

import { createServerClient } from '@/lib/supabase/server';

import type { Mock } from 'vitest';

describe('Financial entity create workflows (loan/investment)', () => {
  const mockChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };

  const mockClient = {
    from: vi.fn(() => mockChain),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createServerClient as Mock).mockResolvedValue(mockClient);
  });

  // ==================== LOAN ====================

  describe('createLoan', () => {
    it('inserts into loans table with actor_id and default draft+private state', async () => {
      // Defaults updated in 9267b6f0: loans now land as draft + is_public=false
      // to match the EntityCreationSuccess UX contract ("saved as a draft, not
      // visible to anyone yet"). Previously forced status='active' + relied on
      // DB column default is_public=true — see commit message for rationale.
      const created = { id: 'loan-1', title: 'Business Loan', status: 'draft' };
      mockChain.single.mockResolvedValue({ data: created, error: null });

      const result = await createLoan('user-1', {
        title: 'Business Loan',
        description: 'Loan for business expansion',
        original_amount: 0.1,
        remaining_balance: 0.1,
      });

      expect(mockClient.from).toHaveBeenCalledWith('loans');
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'actor-001',
          title: 'Business Loan',
          loan_type: 'new_request',
          original_amount: 0.1,
          remaining_balance: 0.1,
          status: 'draft',
          is_public: false,
          fulfillment_type: 'manual',
        })
      );
      expect(result).toEqual(created);
    });

    it('normalizes empty string fields to null', async () => {
      const created = { id: 'loan-2' };
      mockChain.single.mockResolvedValue({ data: created, error: null });

      await createLoan('user-1', {
        title: 'Loan',
        description: 'desc',
        original_amount: 0.05,
        remaining_balance: 0.05,
        bitcoin_address: '',
        lightning_address: '',
        interest_rate: undefined,
      });

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          bitcoin_address: null,
          lightning_address: null,
          interest_rate: null,
        })
      );
    });

    it('propagates a supabase client passed from the route handler', async () => {
      const externalChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'loan-3' }, error: null }),
      };
      const externalClient = { from: vi.fn(() => externalChain) };

      await createLoan(
        'user-1',
        { title: 'L', description: 'd', original_amount: 0.01, remaining_balance: 0.01 },
        externalClient as any
      );

      // When an external client is passed it should be used, not createServerClient
      expect(externalClient.from).toHaveBeenCalledWith('loans');
      expect(mockClient.from).not.toHaveBeenCalled();
    });
  });

  // ==================== INVESTMENT ====================

  describe('createInvestment', () => {
    it('inserts into investments table with actor_id and draft status', async () => {
      const created = { id: 'inv-1', title: 'Solar Farm', status: 'draft' };
      mockChain.single.mockResolvedValue({ data: created, error: null });

      const result = await createInvestment('user-2', {
        title: 'Solar Farm',
        description: 'Revenue-share for solar farm expansion.',
        investment_type: 'revenue_share',
        target_amount: 0.5,
        minimum_investment: 0.001,
      });

      expect(mockClient.from).toHaveBeenCalledWith('investments');
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'actor-001',
          title: 'Solar Farm',
          investment_type: 'revenue_share',
          target_amount: 0.5,
          minimum_investment: 0.001,
          total_raised: 0,
          status: 'draft',
        })
      );
      expect(result).toEqual(created);
    });

    it('normalizes empty string optional fields to null', async () => {
      const created = { id: 'inv-2' };
      mockChain.single.mockResolvedValue({ data: created, error: null });

      await createInvestment('user-2', {
        title: 'Investment',
        description: 'Description.',
        investment_type: 'equity',
        target_amount: 1.0,
        minimum_investment: 0.01,
        bitcoin_address: '',
        lightning_address: '',
        end_date: '',
        risk_level: '',
      });

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          bitcoin_address: null,
          lightning_address: null,
          end_date: null,
          risk_level: null,
        })
      );
    });

    it('defaults is_public to false when omitted', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'inv-3' }, error: null });

      await createInvestment('user-2', {
        title: 'Private Investment',
        description: 'Private.',
        investment_type: 'debt',
        target_amount: 0.25,
        minimum_investment: 0.005,
      });

      expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({ is_public: false }));
    });
  });
});
