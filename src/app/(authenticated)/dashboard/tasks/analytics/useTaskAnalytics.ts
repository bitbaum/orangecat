import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import type { ContributionData, FairnessData, DashboardStats } from './types';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export function useTaskAnalytics() {
  const { user, isLoading: authLoading, hydrated } = useRequireAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [contributions, setContributions] = useState<ContributionData[]>([]);
  const [fairnessData, setFairnessData] = useState<FairnessData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [statsRes, contributionsRes, fairnessRes] = await Promise.all([
        fetch(API_ROUTES.TASKS.ANALYTICS),
        fetch(`${API_ROUTES.TASKS.ANALYTICS}/contributions?days=${days}`),
        fetch(`${API_ROUTES.TASKS.ANALYTICS}/fairness?days=${days}`),
      ]);
      const [statsData, contributionsData, fairnessDataRes] = await Promise.all([
        statsRes.json(),
        contributionsRes.json(),
        fairnessRes.json(),
      ]);
      if (!statsRes.ok) {
        throw new Error(apiErrorMessage(statsData, 'Failed to load stats'));
      }
      if (!contributionsRes.ok) {
        throw new Error(apiErrorMessage(contributionsData, 'Failed to load contributions'));
      }
      if (!fairnessRes.ok) {
        throw new Error(apiErrorMessage(fairnessDataRes, 'Failed to load fairness data'));
      }
      setStats(statsData.data?.stats || null);
      setContributions(contributionsData.data?.contributions || []);
      setFairnessData(fairnessDataRes.data?.fairnessMetrics || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      logger.error('Failed to load analytics', { error: err }, 'TaskAnalyticsPage');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, days]);

  useEffect(() => {
    if (hydrated && !authLoading && user) {
      loadData();
    }
  }, [hydrated, authLoading, user, loadData]);

  return {
    user,
    authLoading,
    hydrated,
    stats,
    contributions,
    fairnessData,
    loading,
    error,
    days,
    setDays,
  };
}
