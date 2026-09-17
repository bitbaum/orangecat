'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Input from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, TrendingUp, DollarSign, Target, Microscope } from 'lucide-react';
import EntityListShell from '@/components/entity/EntityListShell';
import Loading from '@/components/Loading';
import { ResearchEntity } from '@/types/research';
import { logger } from '@/utils/logger';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { API_ROUTES } from '@/config/api-routes';
import { STATUS } from '@/config/database-constants';
import {
  RESEARCH_FIELDS,
  RESEARCH_FIELD_COLORS,
  RESEARCH_STATUS_DOT_COLORS,
  RESEARCH_STATUSES,
  type ResearchField,
} from '@/config/research';
import { ProjectCardSkeleton } from '@/components/ui/Skeleton';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export default function ResearchDashboard() {
  const router = useRouter();
  const { isLoading: authLoading, hydrated } = useRequireAuth();
  const { formatAmountBtc } = useDisplayCurrency();
  const [entities, setEntities] = useState<ResearchEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && hydrated) {
      fetchResearchEntities();
    }
  }, [authLoading, hydrated]);

  const fetchResearchEntities = async () => {
    try {
      const response = await fetch(API_ROUTES.RESEARCH);
      const data = await response.json();
      if (response.ok) {
        setEntities(data.data || []);
      } else {
        logger.error(
          'Failed to fetch research entities',
          { status: response.status, error: data.error },
          'Research'
        );
        setFetchError(apiErrorMessage(data, 'Failed to load research entities'));
      }
    } catch (error) {
      logger.error('Failed to fetch research entities', error, 'Research');
      setFetchError('Failed to load research entities');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntities = entities.filter(entity => {
    const lowerQuery = searchTerm.toLowerCase();
    const matchesSearch =
      (entity.title ?? '').toLowerCase().includes(lowerQuery) ||
      (entity.description ?? '').toLowerCase().includes(lowerQuery);
    const matchesField = fieldFilter === 'all' || entity.field === fieldFilter;
    const matchesStatus = statusFilter === 'all' || entity.status === statusFilter;
    return matchesSearch && matchesField && matchesStatus;
  });

  if (authLoading || !hydrated) {
    return <Loading message="Loading research..." />;
  }

  return (
    <EntityListShell
      title="DeSci Research"
      description="Independent research with decentralized funding"
      headerActions={
        <Button onClick={() => router.push(`${ROUTES.DASHBOARD.RESEARCH}/create`)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Research
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
            <Target className="h-4 w-4 text-fg-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : entities.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Research</CardTitle>
            <TrendingUp className="h-4 w-4 text-fg-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '—' : entities.filter(e => e.status === STATUS.RESEARCH.ACTIVE).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Funding</CardTitle>
            <DollarSign className="h-4 w-4 text-fg-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading
                ? '—'
                : formatAmountBtc(
                    entities.reduce((sum, e) => sum + (e.funding_raised_btc || 0), 0)
                  )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-secondary w-4 h-4" />
          <Input
            placeholder="Search research projects..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={fieldFilter} onValueChange={setFieldFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Fields" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fields</SelectItem>
            {RESEARCH_FIELDS.map(f => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {RESEARCH_STATUSES.map((s: string) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fetchError && <div className="oc-error-surface text-sm">{fetchError}</div>}

      {/* Research Entities Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredEntities.length === 0 ? (
        <div className="text-center py-12">
          <Microscope className="mx-auto mb-4 h-12 w-12 text-fg-secondary" />
          <h3 className="text-lg font-semibold mb-2">No research entities found</h3>
          <p className="text-fg-secondary mb-4">
            {searchTerm || fieldFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Start your first research project'}
          </p>
          <Button onClick={() => router.push(`${ROUTES.DASHBOARD.RESEARCH}/create`)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Research
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEntities.map(entity => (
            <Card
              key={entity.id}
              className="cursor-pointer oc-card-link"
              onClick={() => router.push(`${ENTITY_REGISTRY['research'].basePath}/${entity.id}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{entity.title}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">
                      {entity.description}
                    </CardDescription>
                  </div>
                  <Badge
                    className={
                      RESEARCH_STATUS_DOT_COLORS[entity.status || 'draft'] ??
                      'bg-surface-raised dark:bg-surface-raised'
                    }
                  >
                    {entity.status || 'draft'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Badge
                  className={
                    RESEARCH_FIELD_COLORS[entity.field as ResearchField] ??
                    'bg-surface-raised text-fg-primary'
                  }
                >
                  {RESEARCH_FIELDS.find(f => f.value === entity.field)?.label ??
                    entity.field.replace(/_/g, ' ')}
                </Badge>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Funding Progress</span>
                    <span>
                      {formatAmountBtc(entity.funding_raised_btc || 0)} /{' '}
                      {formatAmountBtc(entity.funding_goal || 0)}
                    </span>
                  </div>
                  <Progress
                    value={
                      entity.funding_goal
                        ? ((entity.funding_raised_btc || 0) / entity.funding_goal) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </EntityListShell>
  );
}
