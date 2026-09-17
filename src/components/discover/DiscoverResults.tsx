'use client';

import {
  ArrowUpDown,
  Loader2,
  Heart,
  Package,
  Briefcase,
  Calendar,
  Building2,
  CircleDashed,
  Gift,
  FlaskConical,
  Bot,
  Building,
} from 'lucide-react';
import type { ReactNode } from 'react';
import Button from '@/components/ui/Button';
import { ProjectCard } from '@/components/entity/variants/ProjectCard';
import ProfileCard from '@/components/ui/ProfileCard';
import { LoanCard } from '@/components/entity/variants/LoanCard';
import { InvestmentCard } from '@/components/entity/variants/InvestmentCard';
import {
  GenericPublicCard,
  type GenericPublicEntity,
} from '@/components/entity/variants/GenericPublicCard';
import type { SearchFundingPage, SearchProfile } from '@/services/search';
import type { DiscoverTabType } from '@/components/discover/DiscoverTabs';
import type { Loan } from '@/types/loans';
import type { Investment } from '@/types/investments';
import type { EntityType } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import { AnimatedGrid, type ViewMode } from './AnimatedGrid';
import { DiscoverLoadingState } from './DiscoverLoadingState';
import { DiscoverAllTab } from './DiscoverAllTab';

interface DiscoverResultsProps {
  activeTab: DiscoverTabType;
  viewMode: ViewMode;
  projects: SearchFundingPage[];
  profiles: SearchProfile[];
  loans?: Loan[];
  investments?: Investment[];
  assets?: GenericPublicEntity[];
  causes?: GenericPublicEntity[];
  events?: GenericPublicEntity[];
  products?: GenericPublicEntity[];
  services?: GenericPublicEntity[];
  groups?: GenericPublicEntity[];
  circles?: GenericPublicEntity[];
  wishlists?: GenericPublicEntity[];
  research?: GenericPublicEntity[];
  aiAssistants?: GenericPublicEntity[];
  loading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onTabChange: (tab: DiscoverTabType) => void;
}

export default function DiscoverResults({
  activeTab,
  viewMode,
  projects,
  profiles,
  loans = [],
  investments = [],
  assets = [],
  causes = [],
  events = [],
  products = [],
  services = [],
  groups = [],
  circles = [],
  wishlists = [],
  research = [],
  aiAssistants = [],
  loading,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onTabChange,
}: DiscoverResultsProps) {
  const genericTabs: Array<{
    id: DiscoverTabType;
    title: string;
    icon: ReactNode;
    items: GenericPublicEntity[];
    entityType: EntityType;
    makeHref: (e: GenericPublicEntity) => string;
  }> = [
    {
      id: 'causes',
      title: 'Causes',
      icon: <Heart className="w-5 h-5" />,
      items: causes,
      entityType: 'cause',
      makeHref: e => ROUTES.CAUSES.VIEW(e.id),
    },
    {
      id: 'assets',
      title: 'Assets',
      icon: <Building className="w-5 h-5" />,
      items: assets,
      entityType: 'asset',
      makeHref: e => ROUTES.ASSETS.VIEW(e.id),
    },
    {
      id: 'products',
      title: 'Products',
      icon: <Package className="w-5 h-5" />,
      items: products,
      entityType: 'product',
      makeHref: e => ROUTES.PRODUCTS.VIEW(e.id),
    },
    {
      id: 'services',
      title: 'Services',
      icon: <Briefcase className="w-5 h-5" />,
      items: services,
      entityType: 'service',
      makeHref: e => ROUTES.SERVICES.VIEW(e.id),
    },
    {
      id: 'events',
      title: 'Events',
      icon: <Calendar className="w-5 h-5" />,
      items: events,
      entityType: 'event',
      makeHref: e => ROUTES.EVENTS.VIEW(e.id),
    },
    {
      id: 'groups',
      title: 'Organizations',
      icon: <Building2 className="w-5 h-5" />,
      items: groups,
      entityType: 'group',
      makeHref: e => ROUTES.GROUPS.VIEW(e.slug ?? e.id),
    },
    {
      id: 'circles',
      title: 'Circles',
      icon: <CircleDashed className="w-5 h-5" />,
      items: circles,
      entityType: 'circle',
      makeHref: e => ROUTES.CIRCLES.VIEW(e.id),
    },
    {
      id: 'wishlists',
      title: 'Wishlists',
      icon: <Gift className="w-5 h-5" />,
      items: wishlists,
      entityType: 'wishlist',
      makeHref: e => ROUTES.WISHLISTS.VIEW(e.id),
    },
    {
      id: 'research',
      title: 'Research',
      icon: <FlaskConical className="w-5 h-5" />,
      items: research,
      entityType: 'research',
      makeHref: e => ROUTES.RESEARCH.VIEW(e.id),
    },
    {
      id: 'ai_assistants',
      title: 'AI Assistants',
      icon: <Bot className="w-5 h-5" />,
      items: aiAssistants,
      entityType: 'ai_assistant',
      makeHref: e => ROUTES.AI_ASSISTANTS.VIEW(e.id),
    },
  ];

  if (loading) {
    return <DiscoverLoadingState activeTab={activeTab} viewMode={viewMode} />;
  }

  const displayedCount =
    projects.length +
    profiles.length +
    loans.length +
    investments.length +
    genericTabs.reduce((sum, t) => sum + t.items.length, 0);

  // ONE counting source: the entities actually rendered below. The header used
  // to mix a search-service total with loaded-array lengths, which disagreed
  // with the tab badges ("All 76" vs "52 results (showing 46)") — a trust bug.
  const resultsHeader = (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-semibold text-fg-primary">
        {displayedCount > 0
          ? `Showing ${displayedCount} result${displayedCount !== 1 ? 's' : ''}`
          : 'No results found'}
      </h2>
    </div>
  );

  const LoadMoreButton = ({ label }: { label: string }) => (
    <div className="mt-8 flex justify-center">
      <Button
        onClick={onLoadMore}
        disabled={isLoadingMore}
        variant="outline"
        size="lg"
        className="min-w-[200px]"
      >
        {isLoadingMore ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            {label}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );

  if (activeTab === 'all') {
    return (
      <DiscoverAllTab
        genericTabs={genericTabs}
        projects={projects}
        investments={investments}
        loans={loans}
        profiles={profiles}
        viewMode={viewMode}
        resultsHeader={resultsHeader}
        onTabChange={onTabChange}
      />
    );
  }

  // Shared renderer for the 4 typed individual tab types
  const renderTabContent = <T extends { id: string }>(
    items: T[],
    renderItem: (item: T) => ReactNode,
    loadMoreLabel: string
  ) => (
    <>
      {resultsHeader}
      <AnimatedGrid items={items} viewMode={viewMode} renderItem={renderItem} />
      {hasMore && <LoadMoreButton label={loadMoreLabel} />}
    </>
  );

  if (activeTab === 'investments') {
    return renderTabContent(
      investments,
      i => <InvestmentCard investment={i} viewMode={viewMode} />,
      'Load More Investments'
    );
  }
  if (activeTab === 'loans') {
    return renderTabContent(
      loans,
      i => <LoanCard loan={i} viewMode={viewMode} />,
      'Load More Loans'
    );
  }
  if (activeTab === 'projects') {
    return renderTabContent(projects, i => <ProjectCard project={i} />, 'Load More Projects');
  }
  if (activeTab === 'profiles') {
    return renderTabContent(
      profiles,
      i => <ProfileCard profile={i} viewMode={viewMode} />,
      'Load More People'
    );
  }

  // Generic entity type tab (causes, assets, products, services, events, groups, wishlists, research, ai_assistants)
  const genericTab = genericTabs.find(t => t.id === activeTab);
  if (genericTab) {
    return (
      <>
        {resultsHeader}
        <AnimatedGrid
          items={genericTab.items}
          viewMode={viewMode}
          renderItem={item => (
            <GenericPublicCard
              entity={item}
              entityType={genericTab.entityType}
              href={genericTab.makeHref(item)}
              viewMode={viewMode}
            />
          )}
        />
        {hasMore && <LoadMoreButton label={`Load More ${genericTab.title}`} />}
      </>
    );
  }

  return null;
}
