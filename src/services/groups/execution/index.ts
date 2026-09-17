import { logger } from '@/utils/logger';
import supabase from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import { fromTable, type AnySupabaseClient } from '../db-helpers';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface ProposalRecord {
  id: string;
  group_id: string;
  proposer_id: string;
  action_type?: string | null;
  action_data?: Record<string, unknown> | null;
  executed_at?: string;
  execution_result?: Record<string, unknown>;
}

type ActionHandler = (
  proposalId: string,
  proposal: ProposalRecord,
  sb: AnySupabaseClient
) => Promise<void>;

const handlers: Record<string, ActionHandler> = {
  async associate_entity(_proposalId, proposal, sb) {
    // Extract entity details
    const { entity_type, entity_id } = proposal.action_data || {};
    if (!entity_type || !entity_id) {
      return;
    }
    try {
      // Idempotent: just set group ownership if not already
      const groupId = proposal.group_id;
      const { getTableName } = await import('@/config/entity-registry');
      type EntityType = import('@/config/entity-registry').EntityType;
      const tableName = getTableName(entity_type as EntityType);

      // Fetch group's actor id
      const { getActorByGroup } = await import('@/services/actors');
      const groupActor = await getActorByGroup(groupId);
      if (!groupActor) {
        return;
      }

      await fromTable(sb, tableName)
        .update({ actor_id: groupActor.id, group_id: groupId })
        .eq('id', entity_id);
    } catch (error) {
      logger.error('Error executing associate_entity', error, 'Groups');
    }
  },
  async create_contract(_proposalId, proposal, _sb) {
    try {
      const { createContract } = await import('@/services/contracts/mutations/contracts');
      const { party_a_actor_id, party_b_actor_id, contract_type, terms } =
        proposal.action_data || {};
      if (!party_a_actor_id || !party_b_actor_id || !contract_type) {
        logger.warn(
          'Missing required fields for create_contract',
          { proposalId: _proposalId },
          'Groups'
        );
        return;
      }

      // Get group's actor_id for party_a if not provided
      let partyAActorId = party_a_actor_id as string;
      if (!partyAActorId) {
        const { getActorByGroup } = await import('@/services/actors');
        const groupActor = await getActorByGroup(proposal.group_id);
        if (!groupActor) {
          logger.error('Group actor not found', { groupId: proposal.group_id }, 'Groups');
          return;
        }
        partyAActorId = groupActor.id;
      }

      type CreateContractInput =
        import('@/services/contracts/mutations/contracts').CreateContractInput;
      const result = await createContract({
        party_a_actor_id: partyAActorId,
        party_b_actor_id: party_b_actor_id as string,
        contract_type: contract_type as CreateContractInput['contract_type'],
        terms: (terms || {}) as Record<string, unknown>,
        proposal_id: proposal.id,
      });

      if (!result.success) {
        logger.error('Failed to create contract from proposal', { error: result.error }, 'Groups');
        throw new Error(apiErrorMessage(result, 'Failed to create contract'));
      }

      logger.info(
        'Contract created from proposal',
        { proposalId: _proposalId, contractId: result.contract?.id },
        'Groups'
      );
    } catch (error) {
      logger.error('Error executing create_contract', error, 'Groups');
      throw error;
    }
  },
  async create_project(_proposalId, proposal, sb) {
    try {
      const { createProject } = await import('@/domain/projects/service');
      const { getActorByGroup } = await import('@/services/actors');

      // Get group's actor_id
      const groupActor = await getActorByGroup(proposal.group_id);
      if (!groupActor) {
        logger.error('Group actor not found', { groupId: proposal.group_id }, 'Groups');
        return;
      }

      // Extract project data from action_data
      const projectData = proposal.action_data || {};

      // Create project owned by group
      // group_id and actor_id are passed as context; createProject reads only ProjectData fields
      const project = await createProject(proposal.proposer_id, {
        ...projectData,
        group_id: proposal.group_id,
        actor_id: groupActor.id,
      } as unknown as import('@/lib/validation').ProjectData);

      // Update proposal with created project ID
      await fromTable(sb, DATABASE_TABLES.GROUP_PROPOSALS)
        .update({
          action_data: {
            ...proposal.action_data,
            project_id: project.id,
          },
        })
        .eq('id', _proposalId);

      logger.info(
        'Project created from proposal',
        { proposalId: _proposalId, projectId: project.id },
        'Groups'
      );
    } catch (error) {
      logger.error('Error executing create_project', error, 'Groups');
      throw error;
    }
  },
  async spend_funds(_proposalId, proposal, sb) {
    try {
      const {
        amount_btc,
        recipient_address,
        wallet_id: _wallet_id,
        note: _note,
      } = proposal.action_data || {};

      if (!amount_btc || !recipient_address) {
        logger.warn(
          'Missing required fields for spend_funds',
          { proposalId: _proposalId },
          'Groups'
        );
        return;
      }

      // For now, just mark the proposal as ready for manual execution
      // In a full implementation, this would:
      // 1. Check wallet balance
      // 2. Create transaction record
      // 3. Notify authorized signers
      // 4. Wait for multisig execution

      await fromTable(sb, DATABASE_TABLES.GROUP_PROPOSALS)
        .update({
          action_data: {
            ...proposal.action_data,
            execution_status: 'pending_manual_execution',
            execution_note: 'Awaiting manual multisig execution',
          },
        })
        .eq('id', _proposalId);

      logger.info(
        'Spending proposal marked for manual execution',
        {
          proposalId: _proposalId,
          amount_btc,
          recipient_address,
        },
        'Groups'
      );
    } catch (error) {
      logger.error('Error executing spend_funds', error, 'Groups');
      throw error;
    }
  },
};

export async function executeProposalAction(
  proposalId: string,
  proposal: ProposalRecord,
  client?: AnySupabaseClient
): Promise<void> {
  const sb = client || supabase;
  try {
    const action = proposal.action_type;
    if (!action) {
      logger.warn('No action type on proposal', { proposalId }, 'Groups');
      return;
    }
    const handler = handlers[action];
    if (!handler) {
      logger.warn('Unknown proposal action', { action }, 'Groups');
      return;
    }

    // Mark as executed before/after to avoid duplicate runs
    const { data: reloaded } = await fromTable(sb, DATABASE_TABLES.GROUP_PROPOSALS)
      .select('executed_at, execution_result')
      .eq('id', proposalId)
      .single();

    if (reloaded?.executed_at) {
      return; // already executed
    }

    await handler(proposalId, proposal, sb);

    await fromTable(sb, DATABASE_TABLES.GROUP_PROPOSALS)
      .update({
        executed_at: new Date().toISOString(),
        execution_result: { ok: true, action: proposal.action_type },
      })
      .eq('id', proposalId);
  } catch (error) {
    logger.error('Exception executing proposal action', error, 'Groups');
    await fromTable(sb, DATABASE_TABLES.GROUP_PROPOSALS)
      .update({
        executed_at: new Date().toISOString(),
        execution_result: { ok: false, error: String(error) },
      })
      .eq('id', proposalId);
  }
}
