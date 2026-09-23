/**
 * INVESTMENT ENTITY CONFIGURATION
 *
 * Defines the form structure, validation, and guidance for investment creation.
 */

import { TrendingUp } from 'lucide-react';
import { investmentSchema, type InvestmentFormData } from '@/lib/validation';
import type { FieldGroup } from '@/components/create/types';
import { createEntityConfig } from './base-config-factory';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { WalletSelectorField } from '@/components/create/wallet-selector';
import {
  investmentGuidanceContent,
  investmentDefaultGuidance,
} from '@/lib/entity-guidance/investment-guidance';
import { RISK_LEVELS, RETURN_FREQUENCIES } from '@/config/investments';

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Investment Details',
    description: 'Describe your investment opportunity',
    fields: [
      {
        name: 'title',
        label: 'Investment Title',
        type: 'text',
        placeholder: 'e.g., Restaurant Revenue Share Deal',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Describe the investment opportunity, expected outcomes, and use of funds...',
        rows: 4,
        required: true,
        colSpan: 2,
        hint: 'Be specific about what investors are funding and how returns are generated.',
      },
    ],
  },
  {
    id: 'investment_details',
    title: 'Deal Structure',
    description: 'Define the investment type and amounts',
    fields: [
      {
        name: 'investment_type',
        label: 'Investment Type',
        type: 'select',
        required: true,
        options: [
          {
            value: 'equity',
            label: 'Equity',
            description: 'Investors receive ownership shares',
          },
          {
            value: 'revenue_share',
            label: 'Revenue Share',
            description: 'Investors receive a percentage of revenue',
          },
          {
            value: 'profit_share',
            label: 'Profit Share',
            description: 'Investors receive a percentage of profits',
          },
          {
            value: 'token',
            label: 'Token-Based',
            description: 'Returns via tokens or digital assets',
          },
          {
            value: 'other',
            label: 'Other',
            description: 'Custom investment structure',
          },
        ],
        hint: 'How returns are distributed to investors',
      },
      {
        name: 'target_amount',
        label: 'Fundraising Target',
        type: 'currency',
        placeholder: '1.0',
        required: true,
        hint: 'Total amount you want to raise',
      },
      {
        name: 'minimum_investment',
        label: 'Minimum Investment',
        type: 'currency',
        placeholder: '0.01',
        required: true,
        hint: 'Smallest amount an investor can contribute',
      },
      {
        name: 'maximum_investment',
        label: 'Maximum Investment',
        type: 'currency',
        placeholder: '0.5',
        hint: 'Optional cap per investor',
      },
    ],
  },
  {
    id: 'return_terms',
    title: 'Return Terms',
    description: 'Set the expected returns and timeline',
    fields: [
      {
        name: 'expected_return_rate',
        label: 'Expected Return Rate (%)',
        type: 'number',
        placeholder: '12',
        min: 0,
        max: 1000,
        step: 0.1,
        hint: 'Annual expected return percentage',
      },
      {
        name: 'return_frequency',
        label: 'Return Frequency',
        type: 'select',
        options: [...RETURN_FREQUENCIES],
        hint: 'How often returns are distributed',
      },
      {
        name: 'term_months',
        label: 'Investment Term (months)',
        type: 'number',
        placeholder: '24',
        min: 1,
        step: 1,
        hint: 'Expected duration of the investment',
      },
      {
        name: 'end_date',
        label: 'Closing Date',
        type: 'date',
        hint: 'Deadline for accepting new investments',
      },
    ],
  },
  {
    id: 'risk_terms',
    title: 'Risk & Terms',
    description: 'Disclose risk level and investment terms',
    fields: [
      {
        name: 'risk_level',
        label: 'Risk Level',
        type: 'select',
        options: RISK_LEVELS.map(({ value, label }) => ({ value, label })),
        hint: 'Honest assessment of investment risk',
      },
      {
        name: 'terms',
        label: 'Investment Terms',
        type: 'textarea',
        placeholder: 'Detailed terms, conditions, and legal disclaimers...',
        rows: 4,
        colSpan: 2,
        hint: 'Full terms and conditions for investors',
      },
    ],
  },
  {
    id: 'bitcoin',
    title: 'Pay into',
    description: 'Where money for this investment should land',
    customComponent: WalletSelectorField,
    fields: [
      { name: 'bitcoin_address', label: 'Bitcoin Address', type: 'bitcoin_address' },
      { name: 'lightning_address', label: 'Lightning Address', type: 'text' },
    ],
  },
  {
    id: 'visibility',
    title: 'Visibility',
    description: 'Control who can see this investment',
    fields: [
      {
        name: 'is_public',
        label: 'List publicly',
        type: 'checkbox',
        hint: 'When enabled, this investment will be visible to everyone',
        colSpan: 2,
      },
    ],
  },
];

// ==================== CONFIGURATION ====================

export const investmentConfig = createEntityConfig<InvestmentFormData>({
  entityType: 'investment',
  name: 'Investment',
  namePlural: 'Investments',
  icon: TrendingUp,
  colorTheme: 'green',
  backUrl: ENTITY_REGISTRY['investment'].basePath,
  successUrl: `${ENTITY_REGISTRY['investment'].basePath}/[id]`,
  pageTitle: 'Create Investment Opportunity',
  pageDescription: 'Structure an investment deal and connect with potential investors.',
  formTitle: 'Investment Details',
  formDescription: 'Define the investment structure, terms, and expected returns',
  fieldGroups,
  validationSchema: investmentSchema,
  defaultValues: {
    title: '',
    description: '',
    investment_type: 'revenue_share',
    target_amount: undefined as unknown as number,
    minimum_investment: undefined as unknown as number,
    maximum_investment: undefined,
    expected_return_rate: undefined,
    return_frequency: undefined,
    term_months: undefined,
    end_date: '',
    risk_level: undefined,
    terms: '',
    is_public: false,
    bitcoin_address: '',
    lightning_address: '',
    currency: undefined,
  },
  guidanceContent: investmentGuidanceContent,
  defaultGuidance: investmentDefaultGuidance,
});
