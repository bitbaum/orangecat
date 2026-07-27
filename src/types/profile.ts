export interface Profile {
  id: string; // Primary key, matches auth.users.id
  username?: string | null;
  name?: string | null; // Matches actual database column
  bio?: string | null;
  // Structured location fields for better search functionality
  location_country?: string | null; // ISO 3166-1 alpha-2 country code
  location_city?: string | null; // City or municipality name
  location_zip?: string | null; // ZIP or postal code
  location_search?: string | null; // Display field for autocomplete
  latitude?: number | null; // Geographic coordinates for mapping
  longitude?: number | null; // Geographic coordinates for mapping
  // Extended transparency fields
  background?: string | null; // Personal/professional background
  inspiration_statement?: string | null; // What inspires them
  location_context?: string | null; // Additional context about location
  // Legacy location field (deprecated but kept for backward compatibility)
  location?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  website?: string | null;
  // Social & Contact
  social_links?: { links: Array<{ platform: string; label?: string; value: string }> } | null;
  contact_email?: string | null;
  phone?: string | null;
  // Wallet fields (kept for backward compatibility, but wallets managed separately)
  bitcoin_address?: string | null;
  lightning_address?: string | null;
  // Maker profile hardening: what stage their work is at + concrete ways
  // others can help. Value lists: @/config/maker-status.
  current_status?: string | null;
  help_wanted?: string[] | null;
  // User preferences
  currency?: string | null; // User's preferred display currency (from CURRENCY_CODES)
  preferences?: Record<string, unknown> | null; // Generic preference bag (theme, notifications, etc.)
  onboarding_completed?: boolean | null;
  created_at: string;
  updated_at: string;

  // Enhanced categorization and association system
  profile_type?: ProfileType;
  category_tags?: string[];
  associated_entities?: AssociatedEntity[];
  // Note: inspiration_statement is defined above in the transparency fields section
  impact_metrics?: ImpactMetric[];
  verification_status?: VerificationStatus;
}

type ProfileType = 'individual' | 'project' | 'organization' | 'collective';

interface AssociatedEntity {
  id: string;
  type: ProfileType;
  name: string;
  relationship: RelationshipType;
  verified: boolean;
}

type RelationshipType =
  | 'creator'
  | 'collaborator'
  | 'supporter'
  | 'beneficiary'
  | 'member'
  | 'founder'
  | 'participant';

interface ImpactMetric {
  label: string;
  value: string | number;
  description?: string;
  icon?: string;
}

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'featured';

// Profile categories with purposes
export const PROFILE_CATEGORIES = {
  individual: {
    label: 'Individual',
    description: 'A person with goals, dreams, and projects that need support',
    icon: '👤',
    color: 'blue',
    inspirationPrompts: [
      'What drives you to create and build?',
      'How will Bitcoin support change your life or work?',
      'What impact do you want to make in the world?',
    ],
  },
  project: {
    label: 'Project',
    description: 'A specific project or initiative seeking Bitcoin funding',
    icon: '🎯',
    color: 'orange',
    inspirationPrompts: [
      'What problem does this project solve?',
      'How will supporters see their impact?',
      'What makes this project unique and worthy of support?',
    ],
  },
  organization: {
    label: 'Organization',
    description: 'A company, nonprofit, or group working towards a mission',
    icon: '🏢',
    color: 'green',
    inspirationPrompts: [
      "What is your organization's mission and vision?",
      'How does Bitcoin funding advance your goals?',
      'What impact has your organization already made?',
    ],
  },
  collective: {
    label: 'Collective',
    description: 'A group of individuals working together on shared goals',
    icon: '👥',
    color: 'tiffany',
    inspirationPrompts: [
      'What brings this collective together?',
      'How does the group amplify individual efforts?',
      'What unique value does collaboration create?',
    ],
  },
} as const;
