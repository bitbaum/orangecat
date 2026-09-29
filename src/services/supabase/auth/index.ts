/**
 * SUPABASE AUTH SERVICE
 *
 * Barrel file — re-exports from focused sub-modules:
 *   errors.ts     → handleAuthError helper
 *   operations.ts → signIn, signUp, signOut, resetPassword, updatePassword, resendConfirmationEmail
 *   session.ts    → getSession, getUser, onAuthStateChange, isAuthenticated, getCurrentUserId
 *   mfa.ts        → getMFAFactors, enrollMFA, verifyMFAEnrollment, unenrollMFA,
 *                    getMFAAssuranceLevel, verifyMFALogin
 *   passkeys.ts   → listPasskeys, addPasskey, removePasskey, signInWithPasskey,
 *                    browserSupportsPasskeys
 *   identities.ts → listSignInMethods, linkProvider, unlinkMethod
 *
 * The public API is unchanged — all named exports and the default authService object remain.
 */

export {
  signIn,
  signUp,
  signOut,
  resetPassword,
  updatePassword,
  resendConfirmationEmail,
  signInAnonymously,
} from './operations';

export { listSignInMethods, linkProvider, unlinkMethod } from './identities';

export {
  listPasskeys,
  addPasskey,
  removePasskey,
  signInWithPasskey,
  browserSupportsPasskeys,
} from './passkeys';

export {
  getSession,
  getUser,
  onAuthStateChange,
  isAuthenticated,
  getCurrentUserId,
} from './session';

export {
  type MFAFactorType,
  getMFAFactors,
  enrollMFA,
  verifyMFAEnrollment,
  unenrollMFA,
  getMFAAssuranceLevel,
  verifyMFALogin,
} from './mfa';

export {
  type AuthResponse,
  type SignInRequest,
  type SignUpRequest,
  type PasswordResetRequest,
  type PasswordUpdateRequest,
  type AuthError,
  isAuthError,
} from '../types';

// ==================== DEFAULT EXPORT (backwards compatibility) ====================

import {
  signIn,
  signUp,
  signOut,
  resetPassword,
  updatePassword,
  resendConfirmationEmail,
  signInAnonymously,
} from './operations';
import {
  getSession,
  getUser,
  onAuthStateChange,
  isAuthenticated,
  getCurrentUserId,
} from './session';
import {
  getMFAFactors,
  enrollMFA,
  verifyMFAEnrollment,
  unenrollMFA,
  getMFAAssuranceLevel,
  verifyMFALogin,
} from './mfa';
import { isAuthError } from '../types';

const authService = {
  signIn,
  signUp,
  signOut,
  resetPassword,
  updatePassword,
  getSession,
  getUser,
  onAuthStateChange,
  isAuthenticated,
  getCurrentUserId,
  resendConfirmationEmail,
  signInAnonymously,
  isAuthError,
  // MFA functions
  getMFAFactors,
  enrollMFA,
  verifyMFAEnrollment,
  unenrollMFA,
  getMFAAssuranceLevel,
  verifyMFALogin,
};

export default authService;
