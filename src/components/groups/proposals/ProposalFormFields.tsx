'use client';

import type { UseFormReturn } from 'react-hook-form';
import type { ProposalFormData } from '@/lib/validation/proposals';
import type { ProposalFieldType } from '@/lib/entity-guidance/proposal-guidance';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { PROPOSAL_TYPE_SELECT_OPTIONS } from '@/config/proposal-constants';

interface ProposalFormFieldsProps {
  form: UseFormReturn<ProposalFormData>;
  activeField: ProposalFieldType;
  setActiveField: (field: ProposalFieldType) => void;
  submitting: boolean;
  displayCurrency: string;
  onSubmit: (data: ProposalFormData) => Promise<void>;
  onCancel: () => void;
}

export function ProposalFormFields({
  form,
  activeField: _activeField,
  setActiveField,
  submitting,
  displayCurrency,
  onSubmit,
  onCancel,
}: ProposalFormFieldsProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter proposal title"
                  {...field}
                  onFocus={() => setActiveField('title')}
                  onBlur={() => setActiveField(null)}
                />
              </FormControl>
              <FormDescription>Brief, descriptive title for the proposal</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the proposal in detail..."
                  className="min-h-[120px]"
                  {...field}
                  onFocus={() => setActiveField('description')}
                  onBlur={() => setActiveField(null)}
                />
              </FormControl>
              <FormDescription>Provide context and details about the proposal</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="proposal_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              {/* Controlled (`value`, not `defaultValue`) — AI prefill sets this
                  via form.setValue and the trigger must follow the form state. */}
              <Select
                onValueChange={value => {
                  field.onChange(value);
                  setActiveField('proposal_type');
                }}
                value={field.value}
                onOpenChange={open => {
                  if (open) {
                    setActiveField('proposal_type');
                  }
                }}
              >
                <FormControl>
                  <SelectTrigger
                    onFocus={() => setActiveField('proposal_type')}
                    onBlur={() => setActiveField(null)}
                  >
                    <SelectValue placeholder="Select proposal type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PROPOSAL_TYPE_SELECT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Category of the proposal</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_public"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>Public Proposal</FormLabel>
                <FormDescription>
                  Non-members see it when the group itself is public (for job postings)
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  onFocus={() => setActiveField('is_public')}
                  onBlur={() => setActiveField(null)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="voting_threshold"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Voting Threshold (%)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="50"
                  {...field}
                  onChange={e =>
                    field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  onFocus={() => setActiveField('voting_threshold')}
                  onBlur={() => setActiveField(null)}
                />
              </FormControl>
              <FormDescription>
                Minimum percentage of yes votes required to pass (defaults to group setting)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="voting_ends_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Voting End Date</FormLabel>
              <FormControl>
                <Input
                  type="datetime-local"
                  {...field}
                  value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ''}
                  onChange={e =>
                    field.onChange(
                      e.target.value ? new Date(e.target.value).toISOString() : undefined
                    )
                  }
                  onFocus={() => setActiveField('voting_ends_at')}
                  onBlur={() => setActiveField(null)}
                />
              </FormControl>
              <FormDescription>
                When voting should end (defaults to 7 days after activation)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch('proposal_type') === 'treasury' && (
          <>
            <FormField
              control={form.control}
              name="amount_btc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ({displayCurrency}) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="1000000"
                      {...field}
                      onChange={e =>
                        field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                      }
                      onFocus={() => setActiveField('amount_btc')}
                      onBlur={() => setActiveField(null)}
                    />
                  </FormControl>
                  <FormDescription>Amount to spend</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recipient_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Bitcoin Address *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="bc1q..."
                      {...field}
                      onFocus={() => setActiveField('recipient_address')}
                      onBlur={() => setActiveField(null)}
                    />
                  </FormControl>
                  <FormDescription>Bitcoin address to send funds to</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="wallet_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Wallet</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Wallet ID (optional)"
                      {...field}
                      onFocus={() => setActiveField('wallet_id')}
                      onBlur={() => setActiveField(null)}
                    />
                  </FormControl>
                  <FormDescription>Specific wallet to spend from (optional)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Proposal
          </Button>
        </div>
      </form>
    </Form>
  );
}
