export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Action {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
  /** Effective trust level resolved server-side (row → category → default). */
  autonomy: import('@/config/cat-autonomy').AutonomyLevel;
}

export interface CategorySummary {
  category: string;
  name: string;
  description: string;
  enabled: boolean;
  actionCount: number;
  enabledActionCount: number;
}

export interface SpendCaps {
  maxBtcPerAction: number | null;
  maxBtcPerDay: number | null;
}

export interface PermissionData {
  summary: {
    categories: CategorySummary[];
    totalActions: number;
    enabledActions: number;
    highRiskEnabled: boolean;
  };
  availableActions: Action[];
  categories: Category[];
  spendCaps: SpendCaps;
}
