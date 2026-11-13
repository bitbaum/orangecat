'use client';

/**
 * MFA Verification Component
 *
 * Handles TOTP code verification during login for users with MFA enabled.
 * Shows after successful password authentication when user has MFA configured.
 *
 * @module auth/MFAVerify
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { getMFAFactors, verifyMFALogin } from '@/services/supabase/auth';

interface MFAVerifyProps {
  onVerificationComplete?: () => void;
  onCancel?: () => void;
}

export function MFAVerify({ onVerificationComplete, onCancel }: MFAVerifyProps) {
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load MFA factors on mount
  useEffect(() => {
    const loadFactors = async () => {
      try {
        const { verifiedFactors, error: factorsError } = await getMFAFactors();

        if (factorsError) {
          setError('Failed to load authentication factors');
          return;
        }

        if (!verifiedFactors || verifiedFactors.length === 0) {
          setError('No MFA factors found. Please contact support.');
          return;
        }

        // Use the first verified TOTP factor
        setFactorId(verifiedFactors[0].id);
      } catch {
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadFactors();
  }, []);

  // Focus input on mount
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading]);

  // Handle code input
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setError(null);

    // Auto-submit when 6 digits entered
    if (value.length === 6) {
      handleVerify(value);
    }
  };

  // Verify the TOTP code
  const handleVerify = useCallback(
    async (codeToVerify: string = code) => {
      if (!factorId || codeToVerify.length !== 6) {
        setError('Please enter a valid 6-digit code');
        return;
      }

      setVerifying(true);
      setError(null);

      try {
        const { success, error: verifyError } = await verifyMFALogin(factorId, codeToVerify);

        if (verifyError || !success) {
          setError(verifyError?.message || 'Invalid code. Please try again.');
          setCode('');
          inputRef.current?.focus();
          return;
        }

        onVerificationComplete?.();
      } catch {
        setError('An unexpected error occurred');
        setCode('');
      } finally {
        setVerifying(false);
      }
    },
    [factorId, code, onVerificationComplete]
  );

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-fg-primary mb-4" />
          <p className="text-sm text-fg-secondary">Loading authentication...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-surface-raised rounded-full">
            <Shield className="h-8 w-8 text-fg-primary" />
          </div>
        </div>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code input */}
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={handleCodeChange}
              placeholder="000000"
              disabled={verifying}
              className="w-full px-4 py-4 text-center text-3xl font-mono tracking-[0.5em] border border-strong rounded-lg focus:ring-2 focus:ring-ring focus:border-interactive disabled:opacity-50 disabled:cursor-not-allowed dark:bg-surface-raised dark:text-fg-primary"
              maxLength={6}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 oc-error-surface rounded-lg">
              <AlertCircle className="h-4 w-4 text-status-negative flex-shrink-0" />
              <p className="text-sm text-status-negative">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <Button type="submit" disabled={verifying || code.length !== 6} className="w-full">
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>

          {/* Help text */}
          <p className="text-xs text-fg-secondary text-center">
            Open your authenticator app (Google Authenticator, Authy, etc.) and enter the code for
            OrangeCat.
          </p>

          {/* Cancel/Back button */}
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to sign in
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default MFAVerify;
