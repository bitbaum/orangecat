import { BaseEntity } from './entity';
import type {
  ResearchField,
  Methodology as ResearchMethodology,
  FundingModel,
  TransparencyLevel,
  ProgressFrequency,
  ResearchTimeline as TimelineType,
  ResearchStatus,
} from '@/config/research';
import type { ResearchLicense } from '@/config/open-science';

interface TeamMember {
  id?: string;
  name: string;
  role: string;
  expertise?: string;
  contribution_percentage?: number;
  joined_at?: string;
  wallet_address?: string;
}

interface ResourceNeed {
  type:
    | 'compute'
    | 'data'
    | 'equipment'
    | 'collaboration'
    | 'publication'
    | 'travel'
    | 'software'
    | 'other';
  description?: string;
  estimated_cost_btc?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface ImpactArea {
  area:
    | 'scientific_understanding'
    | 'technological_innovation'
    | 'medical_advancement'
    | 'environmental_protection'
    | 'social_progress'
    | 'economic_development'
    | 'education'
    | 'policy_making'
    | 'philosophical_insight'
    | 'other';
  description?: string;
}

interface SDGAlignment {
  goal: string; // UN SDG identifier
  description?: string;
}

interface ResearchProgress {
  id: string;
  title: string;
  description: string;
  milestone_achieved?: boolean;
  funding_released?: number; // sats
  created_at: string;
  attachments?: string[]; // URLs to documents, images, etc.
  votes?: {
    up: number;
    down: number;
    total: number;
  };
}

interface FundingContribution {
  id: string;
  user_id: string;
  amount_btc: number;
  funding_model: FundingModel;
  message?: string;
  anonymous: boolean;
  created_at: string;
  lightning_invoice?: string;
  onchain_tx?: string;
}

export interface ResearchEntity extends BaseEntity {
  // Basic Research Info
  title: string;
  description: string;
  field: ResearchField;
  methodology: ResearchMethodology;
  expected_outcome: string;
  timeline: TimelineType;

  // Funding
  funding_goal: number;
  funding_goal_currency: string;
  funding_raised_btc: number; // Always stored in BTC
  funding_model: FundingModel;
  wallet_address: string; // Unique BTC wallet per research entity

  // Team
  lead_researcher: string;
  team_members: TeamMember[];
  open_collaboration: boolean;

  // Resources
  resource_needs: ResourceNeed[];

  // Progress & Transparency
  progress_frequency: ProgressFrequency;
  transparency_level: TransparencyLevel;
  voting_enabled: boolean;
  current_milestone?: string;
  next_deadline?: string;

  // Impact
  impact_areas: ImpactArea[];
  target_audience: string[];
  sdg_alignment: SDGAlignment[];

  // Progress Tracking
  progress_updates: ResearchProgress[];

  // Funding History
  contributions: FundingContribution[];

  // NOTE: denormalized counters (total_votes, total_contributors,
  // completion_percentage, follower_count, citation_count, …) were dropped
  // from the database in migration 20260404000005 and no longer exist.

  // Open science — see src/config/open-science.ts
  license?: ResearchLicense | null;
  output_links?: string[];
  preregistration?: string | null;
  preregistration_sha256?: string | null; // server-set on first commit
  preregistered_at?: string | null; // server-set on first commit

  // Visibility
  is_public: boolean;
  is_featured?: boolean;
  status?: ResearchStatus;
}

export interface ResearchEntityCreate extends Omit<
  ResearchEntity,
  // System fields (auto-generated)
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'thumbnail_url'
  // Computed/aggregated fields (set by system)
  | 'funding_raised_btc'
  | 'progress_updates'
  | 'contributions'
  // System-managed fields
  | 'wallet_address'
  | 'is_featured'
  | 'status'
  | 'preregistration_sha256'
  | 'preregistered_at'
> {
  // Optional overrides for creation
  is_public?: boolean;
}
