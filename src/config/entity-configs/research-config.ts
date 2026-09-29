import { EntityConfig } from '@/types/entity';
import { ResearchEntity } from '@/types/research';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { getStatusBadge } from '@/config/entity-status';
import { z } from 'zod';
import {
  RESEARCH_FIELDS,
  METHODOLOGIES,
  TIMELINES,
  FUNDING_MODELS,
  PROGRESS_FREQUENCIES,
  TRANSPARENCY_LEVELS,
} from '@/config/research';
import { openScienceFields } from '@/domain/research/openScience';

// Derive Zod enum values from the SSOT arrays in research.ts
const researchFieldValues = RESEARCH_FIELDS.map(f => f.value) as [string, ...string[]];
const methodologyValues = METHODOLOGIES.map(m => m.value) as [string, ...string[]];
const timelineValues = TIMELINES.map(t => t.value) as [string, ...string[]];
const fundingModelValues = FUNDING_MODELS.map(f => f.value) as [string, ...string[]];
const progressFrequencyValues = PROGRESS_FREQUENCIES.map(p => p.value) as [string, ...string[]];
const transparencyLevelValues = TRANSPARENCY_LEVELS.map(t => t.value) as [string, ...string[]];

// Research entity validation schema
export const researchEntitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  field: z.enum(researchFieldValues),
  methodology: z.enum(methodologyValues),
  expected_outcome: z.string().min(1).max(1000),
  timeline: z.enum(timelineValues),
  funding_goal_btc: z.number().positive('Funding goal must be greater than 0'),
  funding_model: z.enum(fundingModelValues),
  resource_needs: z
    .array(
      z.object({
        type: z.enum([
          'compute',
          'data',
          'equipment',
          'collaboration',
          'publication',
          'travel',
          'software',
          'other',
        ]),
        description: z.string().optional(),
        estimated_cost_btc: z.number().min(0).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']),
      })
    )
    .optional(),
  lead_researcher: z.string().min(1),
  team_members: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().min(1),
        expertise: z.string().optional(),
        contribution_percentage: z.number().min(0).max(100).optional(),
      })
    )
    .optional(),
  open_collaboration: z.boolean().optional(),
  progress_frequency: z.enum(progressFrequencyValues),
  transparency_level: z.enum(transparencyLevelValues),
  voting_enabled: z.boolean().optional(),
  impact_areas: z
    .array(
      z.object({
        area: z.enum([
          'scientific_understanding',
          'technological_innovation',
          'medical_advancement',
          'environmental_protection',
          'social_progress',
          'economic_development',
          'education',
          'policy_making',
          'philosophical_insight',
          'other',
        ]),
        description: z.string().optional(),
      })
    )
    .optional(),
  target_audience: z.array(z.string()).optional(),
  sdg_alignment: z
    .array(
      z.object({
        goal: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  is_public: z.boolean().optional(),
  // Licence, output links, pre-registration. The hash and timestamp of a
  // pre-registration are server-set and deliberately absent: zod strips them.
  // What the researcher says is done now; a Solon milestone vote cites it.
  current_milestone: z.string().trim().max(300).nullable().optional(),
  ...openScienceFields,
});

// Partial schema for PUT updates — all fields optional
export const researchUpdateSchema = researchEntitySchema.partial();

export const researchConfig: EntityConfig<ResearchEntity> = {
  entityType: 'research',
  name: 'Research',
  namePlural: 'Research',
  displayName: 'Research',
  displayNamePlural: 'Research',
  description:
    'Independent research topics with decentralized funding (e.g., Dark Matter, Climate Science)',
  icon: '🔬',
  colorTheme: 'tiffany',
  schema: researchEntitySchema,

  // Routing
  listPath: ENTITY_REGISTRY['research'].basePath,
  detailPath: (id: string) => `${ENTITY_REGISTRY['research'].publicBasePath}/${id}`,
  createPath: ENTITY_REGISTRY['research'].createPath,
  editPath: (id: string) => `${ENTITY_REGISTRY['research'].createPath}?edit=${id}`,
  apiEndpoint: ENTITY_REGISTRY['research'].apiEndpoint,

  // Card rendering
  makeHref: entity => `${ENTITY_REGISTRY['research'].publicBasePath}/${entity.id}`,
  makeCardProps: entity => {
    const statusBadge = getStatusBadge('research', entity.status);
    return {
      badge: statusBadge?.label,
      badgeVariant: statusBadge?.variant,
      showEditButton: true,
      editHref: `${ENTITY_REGISTRY['research'].createPath}?edit=${entity.id}`,
    };
  },

  // Basic fields
  fields: [
    {
      name: 'title',
      label: 'Research Title',
      type: 'text',
      required: true,
      placeholder: 'The fundamental question your research addresses',
      maxLength: 200,
    },
    {
      name: 'description',
      label: 'Research Description',
      type: 'textarea',
      required: true,
      placeholder: 'What understanding are you pursuing? What problem are you solving?',
      maxLength: 2000,
    },
    {
      name: 'field',
      label: 'Research Field',
      type: 'select',
      required: true,
      options: [...RESEARCH_FIELDS],
    },
    {
      name: 'methodology',
      label: 'Research Methodology',
      type: 'select',
      required: true,
      options: [...METHODOLOGIES],
    },
    {
      name: 'expected_outcome',
      label: 'Expected Outcome',
      type: 'textarea',
      required: true,
      placeholder: 'What understanding or breakthrough do you hope to achieve?',
      maxLength: 1000,
    },
    {
      name: 'timeline',
      label: 'Research Timeline',
      type: 'select',
      required: true,
      options: [...TIMELINES],
    },
  ],

  // Research-specific fields
  sections: [
    {
      id: 'funding',
      title: 'Funding & Resources',
      description: 'How your research will be funded and what resources you need',
      fields: [
        {
          name: 'funding_goal_btc',
          label: 'Funding Goal (BTC)',
          type: 'number',
          required: true,
          placeholder: 'How much BTC do you need to complete this research?',
          min: 0.00001, // Minimum ~1000 sats
        },
        {
          name: 'funding_model',
          label: 'Funding Model',
          type: 'select',
          required: true,
          options: [...FUNDING_MODELS],
        },
        {
          name: 'resource_needs',
          label: 'Resource Needs',
          type: 'multiselect',
          options: [
            { value: 'compute', label: 'Compute Resources' },
            { value: 'data', label: 'Data Access' },
            { value: 'equipment', label: 'Specialized Equipment' },
            { value: 'collaboration', label: 'Research Collaboration' },
            { value: 'publication', label: 'Publication Support' },
            { value: 'travel', label: 'Travel/Field Work' },
            { value: 'software', label: 'Software/Tools' },
            { value: 'other', label: 'Other Resources' },
          ],
        },
      ],
    },
    {
      id: 'team',
      title: 'Research Team',
      description: 'Who will be working on this research',
      fields: [
        {
          name: 'lead_researcher',
          label: 'Lead Researcher',
          type: 'text',
          required: true,
          placeholder: 'A name or a pseudonym — real identity is never required',
        },
        {
          name: 'team_members',
          label: 'Team Members',
          type: 'array',
          arrayType: 'object',
          arrayFields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'role', label: 'Role', type: 'text', required: true },
            { name: 'expertise', label: 'Expertise', type: 'text' },
            {
              name: 'contribution_percentage',
              label: 'Funding Share %',
              type: 'number',
              min: 0,
              max: 100,
            },
          ],
        },
        {
          name: 'open_collaboration',
          label: 'Open to New Collaborators',
          type: 'checkbox',
          hint: 'Allow other researchers to join this project',
        },
      ],
    },
    {
      id: 'progress',
      title: 'Progress Tracking',
      description: 'How you will share progress and milestones',
      fields: [
        {
          name: 'progress_frequency',
          label: 'Progress Update Frequency',
          type: 'select',
          required: true,
          options: [...PROGRESS_FREQUENCIES],
        },
        {
          name: 'transparency_level',
          label: 'Transparency Level',
          type: 'select',
          required: true,
          options: [...TRANSPARENCY_LEVELS],
        },
        {
          name: 'voting_enabled',
          label: 'Enable Community Voting',
          type: 'checkbox',
          hint: 'Allow supporters to vote on research direction and priorities',
        },
      ],
    },
    {
      id: 'impact',
      title: 'Expected Impact',
      description: 'How this research will benefit humanity and science',
      fields: [
        {
          name: 'impact_areas',
          label: 'Impact Areas',
          type: 'multiselect',
          options: [
            { value: 'scientific_understanding', label: 'Scientific Understanding' },
            { value: 'technological_innovation', label: 'Technological Innovation' },
            { value: 'medical_advancement', label: 'Medical Advancement' },
            { value: 'environmental_protection', label: 'Environmental Protection' },
            { value: 'social_progress', label: 'Social Progress' },
            { value: 'economic_development', label: 'Economic Development' },
            { value: 'education', label: 'Education' },
            { value: 'policy_making', label: 'Policy Making' },
            { value: 'philosophical_insight', label: 'Philosophical Insight' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          name: 'target_audience',
          label: 'Target Audience',
          type: 'multiselect',
          options: [
            { value: 'scientists', label: 'Scientists/Researchers' },
            { value: 'policymakers', label: 'Policy Makers' },
            { value: 'businesses', label: 'Businesses' },
            { value: 'general_public', label: 'General Public' },
            { value: 'students', label: 'Students' },
            { value: 'practitioners', label: 'Industry Practitioners' },
            { value: 'ngos', label: 'NGOs/Non-profits' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          name: 'sdg_alignment',
          label: 'UN Sustainable Development Goals',
          type: 'multiselect',
          options: [
            { value: 'no_poverty', label: 'No Poverty' },
            { value: 'zero_hunger', label: 'Zero Hunger' },
            { value: 'good_health', label: 'Good Health and Well-being' },
            { value: 'quality_education', label: 'Quality Education' },
            { value: 'gender_equality', label: 'Gender Equality' },
            { value: 'clean_water', label: 'Clean Water and Sanitation' },
            { value: 'affordable_energy', label: 'Affordable and Clean Energy' },
            { value: 'decent_work', label: 'Decent Work and Economic Growth' },
            { value: 'industry_innovation', label: 'Industry, Innovation and Infrastructure' },
            { value: 'reduced_inequalities', label: 'Reduced Inequalities' },
            { value: 'sustainable_cities', label: 'Sustainable Cities and Communities' },
            { value: 'responsible_consumption', label: 'Responsible Consumption and Production' },
            { value: 'climate_action', label: 'Climate Action' },
            { value: 'life_below_water', label: 'Life Below Water' },
            { value: 'life_on_land', label: 'Life on Land' },
            { value: 'peace_justice', label: 'Peace and Justice Strong Institutions' },
            { value: 'partnerships', label: 'Partnerships for the Goals' },
          ],
        },
      ],
    },
  ],

  // Default values for new research entities
  defaults: {
    funding_model: 'donation',
    transparency_level: 'progress',
    progress_frequency: 'monthly',
    voting_enabled: true,
    open_collaboration: true,
    status: STATUS.RESEARCH.DRAFT,
    is_public: true,
    is_featured: false,
  },

  // Validation rules
  validation: {
    custom: [
      {
        field: 'funding_goal_btc',
        rule: (value: unknown) => typeof value === 'number' && value >= 0.00001,
        message: 'Funding goal must be at least 0.00001 BTC',
      },
      {
        field: 'team_members',
        rule: (value: unknown) => {
          if (!value || !Array.isArray(value)) {
            return true;
          }
          const members = value as Array<{ contribution_percentage?: number }>;
          return (
            members.reduce(
              (sum: number, member) => sum + (member.contribution_percentage || 0),
              0
            ) <= 100
          );
        },
        message: 'Total contribution percentages cannot exceed 100%',
      },
    ],
  },

  // Permissions
  permissions: {
    create: 'authenticated',
    read: 'public',
    update: 'owner',
    delete: 'owner',
  },
};
