export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string;

  goal_amount: number;
  goal_currency: string; // mapped from DB 'currency'

  bitcoin_address?: string | null;
  lightning_address?: string | null;

  bitcoin_balance_btc: number;
  bitcoin_balance_updated_at: string | null;

  // Legacy fallback
  raised_amount?: number;

  // Media
  website_url?: string | null;
  cover_image_url?: string | null;

  status: string;
  category?: string | null;
  tags?: string[] | null;
  funding_purpose?: string | null;
  /** Owner-written end state the project is building toward. */
  vision?: string | null;
  /** Owner-written note on where the work stands now (not the lifecycle status). */
  work_status?: string | null;

  created_at: string;
  updated_at: string;
}

type ProjectRow = Omit<Project, 'goal_currency'> & { currency: string };

export function mapProjectRow(row: ProjectRow): Project {
  return {
    ...row,
    goal_currency: row.currency,
  };
}
