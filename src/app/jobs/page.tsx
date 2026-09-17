/**
 * Job Postings Browse Page
 *
 * Public page for browsing job postings from groups.
 * Follows Network State Development Guide - Job Postings feature
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Initial implementation
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Briefcase, MapPin, Clock, Building2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime } from '@/utils/dates';
import { API_ROUTES } from '@/config/api-routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import EntityListShell from '@/components/entity/EntityListShell';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadJobs(controller.signal);
    return () => controller.abort();
  }, []);

  const loadJobs = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_ROUTES.JOBS}?limit=50`, { signal });
      if (!response.ok) {
        throw new Error('Failed to load job postings');
      }

      const data = await response.json();
      if (signal?.aborted) {
        return;
      }
      if (data.success) {
        setJobs(data.data?.jobs || []);
      } else {
        throw new Error(apiErrorMessage(data, 'Failed to load job postings'));
      }
    } catch (err) {
      if (signal?.aborted || (err as { name?: string }).name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load job postings');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-fg-tertiary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-status-negative mb-4">{error}</p>
            <Button onClick={() => loadJobs()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <EntityListShell
      title="Job Postings"
      description="Browse employment opportunities from network states and groups"
    >
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 text-fg-tertiary/50 mx-auto mb-4" />
            <p className="text-fg-secondary mb-2">No job postings available</p>
            <p className="text-base text-fg-tertiary/70">
              Check back later or create a group to post jobs
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <Card key={job.id} className="oc-card-link">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{job.title}</CardTitle>
                    {job.groups && (
                      <div className="flex items-center gap-2 text-sm text-fg-secondary mb-2">
                        <Building2 className="h-4 w-4" />
                        <Link
                          href={`${ENTITY_REGISTRY['group'].publicBasePath}/${job.groups.slug}`}
                          className="hover:underline"
                        >
                          {job.groups.name}
                        </Link>
                      </div>
                    )}
                    {job.description && (
                      <CardDescription className="line-clamp-2 mt-2">
                        {job.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant="default" className="bg-surface-raised">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-fg-secondary">
                    {job.action_data?.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.action_data.location}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatRelativeTime(job.created_at)}
                    </div>
                  </div>
                  <Link
                    href={`${ENTITY_REGISTRY['group'].publicBasePath}/${job.groups?.slug}/proposals/${job.id}`}
                  >
                    <Button>View Details</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </EntityListShell>
  );
}
