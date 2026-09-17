'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, Target, DollarSign, Percent, Calendar } from 'lucide-react';
import { Loan } from '@/types/loans';
import { useMakeOfferForm } from './useMakeOfferForm';
import { LOAN_OFFER_TYPE_OPTIONS } from '@/config/loans';

interface MakeOfferDialogProps {
  loan: Loan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOfferSubmitted: () => void;
}

export function MakeOfferDialog({
  loan,
  open,
  onOpenChange,
  onOfferSubmitted,
}: MakeOfferDialogProps) {
  const { form, loading, watchOfferType, formatLoanCurrency, onSubmit, handleOpenChange } =
    useMakeOfferForm(loan, onOpenChange, onOfferSubmitted);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Make an Offer
          </DialogTitle>
          <DialogDescription>
            Submit an offer to help {loan.lender_name || 'this person'} refinance or pay off their
            loan
          </DialogDescription>
        </DialogHeader>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{loan.title}</CardTitle>
            <CardDescription>{loan.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-surface-raised/60 p-3">
                <p className="text-sm text-fg-secondary">Remaining Balance</p>
                <p className="text-lg font-semibold text-status-negative">
                  {formatLoanCurrency(loan.remaining_balance, loan.currency ?? undefined)}
                </p>
              </div>
              <div className="rounded-md bg-surface-raised/60 p-3">
                <p className="text-sm text-fg-secondary">Current Rate</p>
                <p className="text-lg font-semibold">
                  {loan.interest_rate ? `${loan.interest_rate}%` : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="offer_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Offer Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LOAN_OFFER_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose whether you want to refinance with better terms or pay off the loan
                    entirely
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="offer_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Offer Amount *
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter your offer amount"
                      {...field}
                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    {watchOfferType === 'payoff'
                      ? 'Amount you would pay to completely pay off this loan'
                      : 'Amount you would lend to refinance this loan'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchOfferType === 'refinance' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="interest_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Percent className="h-4 w-4" />
                        Interest Rate *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="12.50"
                          {...field}
                          onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="term_months"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Term (Months) *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="360"
                          placeholder="36"
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Terms</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your terms..."
                        className="min-h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Optional: Describe your specific terms</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="conditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conditions</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any conditions..." className="min-h-20" {...field} />
                    </FormControl>
                    <FormDescription>Optional: Special conditions or requirements</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Offer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
