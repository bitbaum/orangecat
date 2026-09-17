'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { proposalSchema, type ProposalFormData } from '@/lib/validation/proposals';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { GuidancePanel } from '@/components/create/GuidancePanel';
import {
  proposalGuidanceContent,
  proposalDefaultGuidance,
  type ProposalFieldType,
} from '@/lib/entity-guidance/proposal-guidance';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { AIPrefillBar } from '@/components/create/AIPrefillBar';
import { AI_ASSIST_FORMS } from '@/config/ai-assist-forms';
import { ProposalFormFields } from './ProposalFormFields';
import { apiErrorMessage } from '@/lib/api/errorMessage';

/** Field names the AI may write — anything else it returns is ignored. */
const PROPOSAL_AI_FIELD_NAMES = new Set(AI_ASSIST_FORMS.proposal.fields.map(field => field.name));

interface CreateProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupSlug: string;
  onProposalCreated?: () => void;
}

export function CreateProposalDialog({
  open,
  onOpenChange,
  groupId,
  groupSlug,
  onProposalCreated,
}: CreateProposalDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [activeField, setActiveField] = useState<ProposalFieldType>(null);
  const { displayCurrency } = useDisplayCurrency();

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      title: '',
      description: '',
      proposal_type: 'general',
      is_public: false,
    },
  });

  // Live form values for the AI bar (useWatch, not form.watch — the latter is
  // React-Compiler-incompatible).
  const formValues = useWatch({ control: form.control });

  // The server sanitizes values against the declared proposal fields; here we
  // only route them into react-hook-form so validation and dirty state engage.
  const handleAIPrefill = (data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (!PROPOSAL_AI_FIELD_NAMES.has(key) || value === null || value === undefined) {
        continue;
      }
      form.setValue(key as keyof ProposalFormData, value as never, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const onSubmit = async (data: ProposalFormData) => {
    try {
      setSubmitting(true);
      const payload: Record<string, unknown> = {
        group_id: groupId,
        title: data.title,
        description: data.description,
        proposal_type: data.proposal_type,
        voting_threshold: data.voting_threshold,
        voting_ends_at: data.voting_ends_at,
        is_public: data.is_public,
      };
      if (data.proposal_type === 'treasury') {
        payload.action_type = 'spend_funds';
        payload.action_data = {
          amount_btc: data.amount_btc,
          recipient_address: data.recipient_address,
          wallet_id: data.wallet_id,
          note: data.description,
        };
      }
      const response = await fetch(API_ROUTES.GROUPS.PROPOSALS(groupSlug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(apiErrorMessage(error, 'Failed to create proposal'));
      }
      toast.success('Proposal created successfully!');
      form.reset();
      setActiveField(null);
      onOpenChange(false);
      onProposalCreated?.();
    } catch (error) {
      logger.error('Failed to create proposal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create New Proposal
          </DialogTitle>
          <DialogDescription>
            Create a new proposal for the group. It will start as a draft and can be activated for
            voting.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          <div className="lg:col-span-2">
            <AIPrefillBar
              formType="proposal"
              onPrefill={handleAIPrefill}
              disabled={submitting}
              existingData={formValues}
              fields={AI_ASSIST_FORMS.proposal.fields}
            />
            <ProposalFormFields
              form={form}
              activeField={activeField}
              setActiveField={setActiveField}
              submitting={submitting}
              displayCurrency={displayCurrency}
              onSubmit={onSubmit}
              onCancel={() => onOpenChange(false)}
            />
          </div>
          <div className="lg:col-span-1">
            <GuidancePanel
              activeField={activeField}
              guidanceContent={proposalGuidanceContent}
              defaultGuidance={proposalDefaultGuidance}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
