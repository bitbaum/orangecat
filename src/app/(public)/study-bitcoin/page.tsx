'use client';

import { useState } from 'react';
import { BookOpen, Wallet, Target } from 'lucide-react';
import { PageSection } from '@/components/layout/PageLayout';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import Button from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { LEARNING_PATHS, QUICK_RESOURCES, WHY_LEARN_BENEFITS } from './config';
import { ROUTES } from '@/config/routes';
import { LearningPathCard } from './LearningPathCard';
import { ResourceCard } from './ResourceCard';
import { cn } from '@/lib/utils';

const LEVEL_FILTERS = ['all', 'beginner', 'intermediate', 'advanced'] as const;

export default function StudyBitcoinPage() {
  const [selectedLevel, setSelectedLevel] = useState<(typeof LEVEL_FILTERS)[number]>('all');

  const filteredPaths =
    selectedLevel === 'all'
      ? LEARNING_PATHS
      : LEARNING_PATHS.filter(path => path.level.toLowerCase() === selectedLevel);

  const featuredResources = QUICK_RESOURCES.filter(r => r.featured);
  const otherResources = QUICK_RESOURCES.filter(r => !r.featured);

  return (
    <div className="min-h-screen bg-surface-page">
      <div className={cn(PUBLIC_PAGE_WIDTH.wide, 'pb-16')}>
        <PublicPageHeader
          title="Study Bitcoin"
          lede="From basics to advanced concepts, learn everything you need to know about Bitcoin and the future of money."
        >
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button href={ROUTES.BITCOIN_WALLET_GUIDE} size="lg" className="min-h-12">
              <Wallet className="w-5 h-5 mr-2" />
              Start with Wallets
            </Button>
            <Button href="#learning-paths" variant="outline" size="lg" className="min-h-12">
              <BookOpen className="w-5 h-5 mr-2" />
              Browse All Topics
            </Button>
          </div>
        </PublicPageHeader>

        <PageSection background="white">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-fg-primary mb-4">Featured Resources</h2>
            <p className="text-lg text-fg-secondary max-w-3xl mx-auto">
              Start here with our most popular and essential Bitcoin education resources
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featuredResources.map(resource => (
              <ResourceCard key={resource.id} resource={resource} featured />
            ))}
          </div>
        </PageSection>

        <PageSection>
          {/* Anchor target for the "Browse All Topics" button above. */}
          <div id="learning-paths" className="text-center mb-12 scroll-mt-24">
            <h2 className="text-2xl font-semibold text-fg-primary mb-4">Learning Paths</h2>
            <p className="text-lg text-fg-secondary max-w-3xl mx-auto mb-8">
              Structured courses designed to take you from beginner to Bitcoin expert
            </p>
            <SegmentedControl
              label="Level"
              items={LEVEL_FILTERS.map(level => ({
                value: level,
                label: level.charAt(0).toUpperCase() + level.slice(1),
              }))}
              value={selectedLevel}
              onChange={setSelectedLevel}
              className="mx-auto max-w-lg"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPaths.map(path => (
              <LearningPathCard key={path.id} path={path} />
            ))}
          </div>
        </PageSection>

        <PageSection background="gray">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-fg-primary mb-4">Quick Resources</h2>
            <p className="text-lg text-fg-secondary max-w-3xl mx-auto">
              Essential tools, guides, and external resources for your Bitcoin journey
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherResources.map(resource => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </PageSection>

        <PageSection background="white">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-fg-primary mb-4">
              Why Learn About Bitcoin?
            </h2>
            <p className="text-lg text-fg-secondary max-w-3xl mx-auto">
              Understanding Bitcoin is essential in today&apos;s digital economy
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WHY_LEARN_BENEFITS.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-fg-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-fg-primary mb-2">{benefit.title}</h3>
                  <p className="text-fg-secondary leading-relaxed">{benefit.description}</p>
                </div>
              );
            })}
          </div>
        </PageSection>

        <PageSection background="gray">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-fg-primary mb-4">
              Ready to Start Your Bitcoin Journey?
            </h2>
            <p className="text-lg text-fg-secondary max-w-2xl mx-auto mb-8">
              Begin with our comprehensive wallet guide and take your first step into the world of
              Bitcoin
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button href={ROUTES.BITCOIN_WALLET_GUIDE} size="lg" className="min-h-12">
                <Wallet className="w-5 h-5 mr-2" />
                Get Your First Wallet
              </Button>
              <Button
                href={ROUTES.PROJECTS.CREATE}
                variant="outline"
                size="lg"
                className="min-h-12"
              >
                <Target className="w-5 h-5 mr-2" />
                Start a Project
              </Button>
            </div>
          </div>
        </PageSection>
      </div>
    </div>
  );
}
