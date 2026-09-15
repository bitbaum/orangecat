/**
 * Common Types
 *
 * Shared types used across the codebase.
 * Keep this file lean — only add what is actually imported by multiple modules.
 */

/**
 * Standard service-layer result for operations that return success/failure.
 * For operations that also return data, extend inline:
 *   Promise<ServiceResult & { data: MyType }>
 */
export type ServiceResult = { success: boolean; error?: string };

/** Asset verification status levels */
export type VerificationStatus = 'unverified' | 'user_provided' | 'third_party_verified';
