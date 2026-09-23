/**
 * LOAN ENTITY CONFIGURATION
 *
 * Defines the form structure, validation, and guidance for loan creation.
 *
 * Created: 2025-12-06
 * Last Modified: 2025-12-06
 * Last Modified Summary: Initial loan configuration
 */

import { DollarSign } from 'lucide-react';
import { loanSchema, type LoanFormData } from '@/lib/validation';
import { loanGuidanceContent, loanDefaultGuidance } from '@/lib/entity-guidance/loan-guidance';
import type { FieldGroup } from '@/components/create/types';
import { LOAN_TEMPLATES, type LoanTemplate } from '@/components/create/templates';
import { createEntityConfig } from './base-config-factory';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { LoanCollateralField } from '@/components/create/collateral/LoanCollateralField';
import { WalletSelectorField } from '@/components/create/wallet-selector';
import { LOAN_CATEGORIES, LOAN_TYPES, LOAN_FULFILLMENT_TYPES } from '@/config/loans';

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'loan_type',
    title: 'What type of loan?',
    description: "Choose whether you're requesting a new loan or refinancing an existing one",
    fields: [
      {
        name: 'loan_type',
        label: 'Loan Type',
        type: 'select',
        required: true,
        options: LOAN_TYPES,
        hint: 'Select the type of loan listing you want to create',
        colSpan: 2,
      },
    ],
  },
  {
    id: 'basic',
    title: 'Loan Details',
    description: 'Basic information about your loan listing',
    fields: [
      {
        name: 'title',
        label: 'Loan Title',
        type: 'text',
        placeholder: 'e.g., Business Expansion Loan',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Describe your loan needs and how funds will be used...',
        rows: 4,
        required: true,
        colSpan: 2,
        hint: 'Be specific about what you need the loan for and your repayment plan.',
      },
    ],
  },
  {
    id: 'existing_loan_details',
    title: 'Current Loan Details',
    description: 'Information about your existing loan you want to refinance',
    conditionalOn: { field: 'loan_type', value: 'existing_refinance' },
    fields: [
      {
        name: 'current_lender',
        label: 'Current Lender',
        type: 'text',
        placeholder: 'e.g., Bank of America, Credit Union, Private Lender',
        hint: 'Who currently holds your loan',
      },
      {
        name: 'current_interest_rate',
        label: 'Current Interest Rate (%)',
        type: 'number',
        placeholder: '8.5',
        min: 0,
        max: 100,
        step: 0.1,
        hint: 'Your current annual interest rate',
      },
      {
        name: 'monthly_payment',
        label: 'Monthly Payment',
        type: 'currency',
        placeholder: '500',
        hint: 'Your current monthly payment amount',
      },
      {
        name: 'desired_rate',
        label: 'Desired Interest Rate (%)',
        type: 'number',
        placeholder: '5.0',
        min: 0,
        max: 100,
        step: 0.1,
        hint: "The interest rate you'd like to refinance to",
      },
    ],
  },
  {
    id: 'loan_terms',
    title: 'Loan Terms',
    description: 'Set the loan amount, interest rate, and repayment terms',
    fields: [
      {
        name: 'original_amount',
        label: 'Loan Amount',
        type: 'currency',
        placeholder: '10000',
        required: true,
        hint: 'The total amount you want to borrow',
      },
      {
        name: 'remaining_balance',
        label: 'Remaining Balance',
        type: 'currency',
        placeholder: '10000',
        required: true,
        hint: 'Usually same as loan amount for new loans',
      },
      {
        name: 'interest_rate',
        label: 'Interest Rate (%)',
        type: 'number',
        placeholder: '5.0',
        min: 0,
        max: 100,
        step: 0.1,
        hint: "Annual interest rate you're willing to pay",
      },
    ],
  },
  {
    id: 'bitcoin',
    title: 'Pay into',
    description: 'Where repayment for this loan should land',
    customComponent: WalletSelectorField,
    fields: [
      { name: 'bitcoin_address', label: 'Bitcoin Address', type: 'bitcoin_address' },
      { name: 'lightning_address', label: 'Lightning Address', type: 'text' },
    ],
  },
  {
    id: 'collateral',
    title: 'Collateral',
    description: 'Add assets or wallets as collateral to potentially improve loan terms',
    customComponent: LoanCollateralField,
  },
  {
    id: 'additional',
    title: 'Additional Information',
    description: 'Optional details to help lenders understand your loan',
    fields: [
      {
        name: 'loan_category_id',
        label: 'Loan Category',
        type: 'select',
        options: [...LOAN_CATEGORIES],
        hint: 'Choose the category that best describes your loan purpose',
      },
      {
        name: 'fulfillment_type',
        label: 'Fulfillment Type',
        type: 'select',
        options: [...LOAN_FULFILLMENT_TYPES],
        hint: 'How you prefer to make loan repayments',
      },
    ],
  },
  {
    id: 'visibility',
    title: 'Profile Visibility',
    description: 'Control where this loan appears',
    fields: [
      {
        name: 'show_on_profile',
        label: 'Show on Public Profile',
        type: 'checkbox',
        hint: 'When enabled, this loan will appear on your public profile page',
        colSpan: 2,
      },
    ],
  },
];

// ==================== CONFIGURATION ====================

export const loanConfig = createEntityConfig<LoanFormData>({
  entityType: 'loan',
  name: 'Loan',
  namePlural: 'Loans',
  icon: DollarSign,
  colorTheme: 'tiffany',
  backUrl: ENTITY_REGISTRY['loan'].basePath,
  successUrl: `${ENTITY_REGISTRY['loan'].basePath}/[id]`,
  pageTitle: 'Create Loan Listing',
  pageDescription: 'List your loan needs and connect with peer-to-peer lenders.',
  formTitle: 'Loan Details',
  formDescription: 'Set the loan amount, interest rate, and repayment terms',
  fieldGroups,
  validationSchema: loanSchema,
  defaultValues: {
    loan_type: 'new_request',
    title: '',
    description: '',
    original_amount: 0,
    remaining_balance: 0,
    interest_rate: undefined,
    bitcoin_address: '',
    lightning_address: '',
    loan_category_id: '',
    fulfillment_type: 'manual',
    currency: undefined, // Will be set from user's profile preference in EntityForm
    // Fields for existing loan refinancing
    current_lender: '',
    current_interest_rate: undefined,
    monthly_payment: undefined,
    desired_rate: undefined,
    // Visibility — checked by default, matching the loans.show_on_profile DB
    // default and every other entity config. The canonical schema omits the
    // default so partial PUT updates can't re-inject it.
    show_on_profile: true,
    // Collateral
    collateral: [],
  },
  guidanceContent: loanGuidanceContent,
  defaultGuidance: loanDefaultGuidance,
  templates: LOAN_TEMPLATES as unknown as LoanTemplate[],
});
