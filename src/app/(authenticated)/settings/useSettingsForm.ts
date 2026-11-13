'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase/browser';
import { toast } from 'sonner';
import { ACCOUNT_DELETION_COPY } from '@/config/account-deletion';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { passwordProblem } from '@bitbaum/accountkit/auth/password';
import type { User } from '@supabase/supabase-js';

export interface SettingsFormData {
  email: string;
  newPassword: string;
  confirmPassword: string;
}

export function useSettingsForm(user: User | null) {
  const signOut = useAuthStore(state => state.signOut);
  const router = useRouter();

  const [formData, setFormData] = useState<SettingsFormData>({
    email: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaStatusKey, setMfaStatusKey] = useState(0);

  useEffect(() => {
    if (user?.email) {
      setFormData(prev => ({ ...prev, email: user.email! }));
    }
  }, [user?.email]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error('Please enter a valid email address');
      return;
    }
    setIsSubmittingEmail(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ email: formData.email });
      if (error) {
        throw error;
      }
      // A pending address waits on the emailed link; where the auth server
      // confirms at once (and a "Start instantly" account converts on the
      // spot) no email is sent, so none is promised.
      toast.success(
        data.user?.new_email
          ? 'Confirmation email sent! Please check your inbox.'
          : 'Email saved. It is now a way to sign in.'
      );
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, 'Failed to update email.'));
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (passwordProblem(formData.newPassword)) {
      toast.error('Enter a password (up to 128 characters).');
      return;
    }
    setIsSubmittingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: formData.newPassword });
      if (error) {
        toast.error(error.message || 'Failed to update password.');
      } else {
        toast.success('Password updated successfully!');
        setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
      }
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, 'An unexpected error occurred.'));
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    setDeleteAccountConfirm(true);
  };

  const executeDeleteAccount = async () => {
    setDeleteAccountConfirm(false);
    setIsDeleting(true);
    try {
      const response = await fetch(API_ROUTES.DELETE_USER, { method: 'POST' });
      if (!response.ok) {
        // The route says exactly why (an order still shipping, or nothing removed).
        const body: unknown = await response.json().catch(() => null);
        toast.error(apiErrorMessage(body, ACCOUNT_DELETION_COPY.notDeleted));
        return;
      }
      toast.success('Account deleted. You will be signed out.');
      await signOut();
      router.push(ROUTES.HOME);
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, ACCOUNT_DELETION_COPY.notDeleted));
    } finally {
      setIsDeleting(false);
    }
  };

  const refreshMFAStatus = () => setMfaStatusKey(prev => prev + 1);

  return {
    formData,
    isSubmittingEmail,
    isSubmittingPassword,
    isDeleting,
    deleteAccountConfirm,
    setDeleteAccountConfirm,
    showPassword,
    setShowPassword,
    showMFASetup,
    setShowMFASetup,
    mfaStatusKey,
    refreshMFAStatus,
    handleInputChange,
    handleEmailUpdate,
    handlePasswordSubmit,
    handleDeleteAccount,
    executeDeleteAccount,
  };
}
