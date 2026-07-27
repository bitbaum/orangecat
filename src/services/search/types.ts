/**
 * Search Service Types
 *
 * All type definitions for the search service.
 * Single source of truth for search-related interfaces.
 *
 * Created: 2025-01-28
 * Last Modified: 2025-01-28
 * Last Modified Summary: Extracted from search.ts for better modularity
 */

// ==================== SEARCH RESULT TYPES ====================

export interface SearchProfile {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  current_status?: string | null;
}

export interface SearchFundingPage {
  id: string;
  user_id: string;
  title: string;
  description: string;
  bitcoin_address: string | null;
  category: string | null;
  status: string;
  goal_amount: number | null;
  raised_amount: number;
  created_at: string;
  updated_at: string;
  banner_url?: string | null;
  featured_image_url?: string | null;
  profiles?: {
    id: string;
    username: string | null;
    name: string | null;
    avatar_url: string | null;
  };
}

export interface SearchLoan {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  loan_category_id: string | null;
  original_amount: number;
  remaining_balance: number;
  interest_rate: number | null;
  monthly_payment: number | null;
  currency: string;
  status: string;
  loan_type?: 'new_request' | 'existing_loan';
  is_public: boolean;
  is_negotiable: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    username: string | null;
    name: string | null;
    avatar_url: string | null;
  };
}

// Raw profile from database queries
export interface RawSearchProfile {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  location_country?: string | null;
  location_city?: string | null;
  location_zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  current_status?: string | null;
}

// Raw project from database queries
export interface RawSearchProject {
  id: string;
  user_id: string;
  title: string;
  description: string;
  bitcoin_address: string | null;
  category: string | null;
  status: string;
  goal_amount: number | null;
  raised_amount: number | null;
  currency?: string | null;
  created_at: string;
  updated_at: string;
  cover_image_url?: string | null;
}

// Raw loan from database queries
export interface RawSearchLoan {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  loan_category_id: string | null;
  original_amount: number;
  remaining_balance: number;
  interest_rate: number | null;
  monthly_payment: number | null;
  currency: string;
  status: string;
  loan_type?: 'new_request' | 'existing_loan';
  is_public: boolean;
  is_negotiable: boolean;
  created_at: string;
  updated_at: string;
}

// Profile reference for joined data
export interface ProfileReference {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

export type SearchResult = {
  type: 'profile' | 'project' | 'loan';
  data: SearchProfile | SearchFundingPage | SearchLoan;
  relevanceScore?: number;
};

// ==================== SEARCH OPTIONS ====================

export type SearchType = 'all' | 'profiles' | 'projects' | 'loans';
export type SortOption = 'relevance' | 'recent';

export interface SearchFilters {
  categories?: string[];
  statuses?: ('active' | 'paused' | 'completed' | 'cancelled')[]; // Filter by project status
  isActive?: boolean; // Deprecated: use statuses instead
  hasGoal?: boolean;
  minFunding?: number;
  maxFunding?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  // Geographic filters (now implemented!)
  country?: string;
  city?: string;
  postal_code?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
}

export interface SearchOptions {
  query?: string;
  type: SearchType;
  sortBy: SortOption;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  hasMore: boolean;
  facets?: {
    categories: Array<{ name: string; count: number }>;
    totalProfiles: number;
    totalProjects: number;
    totalLoans?: number;
  };
}
