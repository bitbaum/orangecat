/**
 * LOANS SERVICE - Authentication Utilities
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Extracted from loans/index.ts for modularity
 */


// Defined once, in the auth layer, where it is cached. See session.ts.
export { getCurrentUserId } from '@/services/supabase/auth/session';
