/**
 * Project Support Helpers
 *
 * Helper functions for project support operations.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created project support helper functions
 */


// Defined once, in the auth layer, where it is cached. See session.ts.
export { getCurrentUserId } from '@/services/supabase/auth/session';

// Re-export formatSats from SSOT to avoid duplication
// Use useDisplayCurrency hook in components for user-preferred currency
export { formatSats } from '@/services/currency';
