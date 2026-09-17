import { fromTable } from '@/lib/supabase/untyped';
import supabase from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { logger } from '@/utils/logger';
import { CONTRACT_TYPES } from '@/config/contract-types';
import { getCurrentUserId } from '@/services/groups/utils/helpers';
import { getActor, getActorDisplayName } from '@/services/actors';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export interface CreateContractInput {
  party_a_actor_id: string;
  party_b_actor_id: string;
  contract_type: keyof typeof CONTRACT_TYPES;
  terms: Record<string, any>;
  proposal_id?: string;
}

export async function createContract(input: CreateContractInput) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    const partyA = await getActor(input.party_a_actor_id);
    const partyB = await getActor(input.party_b_actor_id);
    if (!partyA || !partyB) {
      return { success: false, error: 'Invalid party actor' };
    }

    if (partyB.actor_type === 'group') {
      const { createProposal } = await import('@/services/groups/mutations/proposals');
      const partyADisplayName = await getActorDisplayName(input.party_a_actor_id);
      const proposalResult = await createProposal({
        group_id: partyB.group_id!,
        title: `Create ${CONTRACT_TYPES[input.contract_type].name} Contract`,
        description: `Proposal to create contract with ${partyADisplayName}`,
        proposal_type: 'membership',
        action_type: 'create_contract',
        action_data: {
          party_a_actor_id: input.party_a_actor_id,
          party_b_actor_id: input.party_b_actor_id,
          contract_type: input.contract_type,
          terms: input.terms,
        },
        is_public: false,
      });

      if (!proposalResult.success) {
        return {
          success: false,
          error: apiErrorMessage(proposalResult, 'Failed to create proposal'),
        };
      }

      return {
        success: true,
        contract: null,
        proposalId: proposalResult.proposal?.id,
        method: 'proposal',
      };
    } else {
      const { data, error } = await fromTable(supabase, DATABASE_TABLES.CONTRACTS)
        .insert({
          party_a_actor_id: input.party_a_actor_id,
          party_b_actor_id: input.party_b_actor_id,
          contract_type: input.contract_type,
          terms: input.terms,
          status: STATUS.CONTRACTS.PROPOSED,
          created_by: userId,
          proposal_id: input.proposal_id || null,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create contract', error, 'Contracts');
        return { success: false, error: error.message };
      }

      return { success: true, contract: data, method: 'direct' };
    }
  } catch (error) {
    logger.error('Exception creating contract', error, 'Contracts');
    return { success: false, error: 'Failed to create contract' };
  }
}
