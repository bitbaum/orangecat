/**
 * ProjectContent Component
 *
 * Displays project description, funding purpose, website, categories, and funding progress
 *
 * Created: 2025-01-27
 */

'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { ExternalLink } from 'lucide-react';
import { getUniqueCategories } from '@/utils/project';
import { ProjectDonationSection } from './ProjectDonationSection';
import { ProjectUpdatesTimeline } from './ProjectUpdatesTimeline';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';

interface ProjectContentProps {
  project: {
    id: string;
    title?: string;
    description: string;
    funding_purpose: string | null;
    vision?: string | null;
    work_status?: string | null;
    website_url: string | null;
    category: string | null;
    tags: string[] | null;
    goal_amount: number | null;
    raised_amount: number | null;
    currency: string;
    bitcoin_address: string | null;
    lightning_address: string | null;
    user_id?: string;
    isOwner?: boolean;
  };
}

export default function ProjectContent({ project }: ProjectContentProps) {
  const progressPercentage = project.goal_amount
    ? Math.min(((project.raised_amount || 0) / project.goal_amount) * 100, 100)
    : 0;

  return (
    <>
      <Card className="mb-6">
        <CardContent className="space-y-6 pt-6">
          {/* Description */}
          <section aria-labelledby="about-heading">
            <h3 id="about-heading" className="text-lg font-semibold mb-2">
              About
            </h3>
            <p className="text-fg-primary whitespace-pre-wrap">{project.description}</p>
          </section>

          {/* Where this is going — the end state. Sits between About (what it
              is) and Current status (what is happening), because that is the
              order a reader deciding whether to back it actually asks in. */}
          {project.vision && (
            <section aria-labelledby="vision-heading">
              <h3 id="vision-heading" className="text-lg font-semibold mb-2">
                Where this is going
              </h3>
              <p className="text-fg-primary whitespace-pre-wrap">{project.vision}</p>
            </section>
          )}

          {/* Where the work stands — the "what is happening now" the About text
              cannot answer, written by the owner. */}
          {project.work_status && (
            <section aria-labelledby="work-status-heading">
              <h3 id="work-status-heading" className="text-lg font-semibold mb-2">
                Current status
              </h3>
              <p className="text-fg-primary whitespace-pre-wrap">{project.work_status}</p>
            </section>
          )}

          {/* Funding Purpose */}
          {project.funding_purpose && (
            <section aria-labelledby="funding-purpose-heading">
              <h3 id="funding-purpose-heading" className="text-lg font-semibold mb-2">
                What the funds will be used for
              </h3>
              <p className="text-fg-primary">{project.funding_purpose}</p>
            </section>
          )}

          {/* Website URL */}
          {project.website_url && (
            <section aria-labelledby="website-heading">
              <h3 id="website-heading" className="text-lg font-semibold mb-2">
                Project Website
              </h3>
              <a
                href={project.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-fg-primary hover:underline underline-offset-4"
                aria-label={`Visit project website: ${project.website_url}`}
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                <span className="underline">{project.website_url}</span>
              </a>
            </section>
          )}

          {/* Categories & Tags */}
          {(project.category || (project.tags && project.tags.length > 0)) && (
            <section aria-labelledby="categories-heading">
              <h3 id="categories-heading" className="text-lg font-semibold mb-2">
                Categories
              </h3>
              <div className="flex flex-wrap gap-2" role="list">
                {getUniqueCategories(project.category, project.tags).map((category, idx) => (
                  <span
                    key={`${category}-${idx}`}
                    className="px-3 py-1 rounded-full text-sm bg-surface-raised text-fg-primary"
                    role="listitem"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Funding Progress */}
          {project.goal_amount && (
            <section aria-labelledby="funding-progress-heading">
              <div className="flex items-center justify-between mb-2">
                <h3 id="funding-progress-heading" className="text-lg font-semibold">
                  Funding Progress
                </h3>
                <div className="text-right">
                  <div className="text-2xl font-bold text-bitcoinOrange">
                    <CurrencyDisplay
                      amount={project.raised_amount || 0}
                      currency={
                        (project.currency || PLATFORM_DEFAULT_CURRENCY) as
                          | 'CHF'
                          | 'USD'
                          | 'EUR'
                          | 'BTC'
                      }
                    />
                  </div>
                  <div className="text-sm text-fg-secondary">
                    of{' '}
                    <CurrencyDisplay
                      amount={project.goal_amount}
                      currency={
                        (project.currency || PLATFORM_DEFAULT_CURRENCY) as
                          | 'CHF'
                          | 'USD'
                          | 'EUR'
                          | 'BTC'
                      }
                    />
                  </div>
                </div>
              </div>
              <div
                className="w-full bg-surface-raised rounded-full h-4"
                role="progressbar"
                aria-valuenow={progressPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Funding progress: ${progressPercentage.toFixed(1)}%`}
              >
                <div
                  className="h-4 rounded-full bg-bitcoinOrange transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="text-sm text-fg-secondary mt-2">
                {progressPercentage.toFixed(1)}% funded
              </div>
            </section>
          )}

          {/* Funding Section */}
          <ProjectDonationSection
            projectId={project.id}
            ownerId={project.user_id}
            projectTitle={project.title || 'Project'}
            bitcoinAddress={project.bitcoin_address}
            isOwner={project.isOwner}
          />
        </CardContent>
      </Card>

      {/* Project Updates Timeline - Separate card for better visual separation */}
      <ProjectUpdatesTimeline projectId={project.id} />
    </>
  );
}
