'use client';

/**
 * The civic split page: name your place, move three sliders, say whether it
 * shows on your profile, save. Below it, what the people of your region would
 * choose. The caveat is on the page in full — the split is a statement and a
 * standing instruction for voluntary giving, never a tax setting.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import EntityListShell from '@/components/entity/EntityListShell';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/switch';
import {
  CIVIC_LEVELS,
  CIVIC_SPLIT_CAVEAT,
  CIVIC_SPLIT_COPY,
  CIVIC_SPLIT_DEFAULT,
  CIVIC_SPLIT_LIMITS,
} from '@/config/civic-split';
import { useRequireAuth } from '@/hooks/useAuth';
import type { CivicShares } from '@/domain/civic-split/schema';
import {
  fetchMyCivicSplit,
  saveMyCivicSplit,
  withdrawMyCivicSplit,
  type CivicSplit,
} from '@/services/civic-split/client';
import { logger } from '@/utils/logger';
import ShareSliders from './ShareSliders';
import PlaceAggregateCard from './PlaceAggregateCard';

interface FormState {
  country_code: string;
  region: string;
  locality: string;
  shares: CivicShares;
  is_public: boolean;
  note: string;
}

const EMPTY: FormState = {
  country_code: 'CH',
  region: '',
  locality: '',
  shares: { ...CIVIC_SPLIT_DEFAULT },
  is_public: false,
  note: '',
};

function fromSplit(split: CivicSplit): FormState {
  return {
    country_code: split.country_code,
    region: split.region,
    locality: split.locality,
    shares: { ...split.shares },
    is_public: split.is_public,
    note: split.note ?? '',
  };
}

export function CivicSplitScreen() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saved, setSaved] = useState<CivicSplit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const split = await fetchMyCivicSplit();
      setSaved(split);
      if (split) {
        setForm(fromSplit(split));
      }
    } catch (error) {
      logger.error('Failed to load civic split', error, 'CivicSplit');
      toast.error(error instanceof Error ? error.message : 'Could not load your split.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void load();
    }
  }, [user, load]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const canSave =
    /^[A-Za-z]{2}$/.test(form.country_code) && form.region.trim() && form.locality.trim();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const split = await saveMyCivicSplit({
        country_code: form.country_code.toUpperCase(),
        region: form.region.trim(),
        locality: form.locality.trim(),
        shares: form.shares,
        is_public: form.is_public,
        note: form.note.trim() || null,
      });
      setSaved(split);
      setForm(fromSplit(split));
      toast.success(saved ? 'Your split is updated.' : 'Your split is declared.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your split.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWithdraw = async () => {
    setIsSaving(true);
    try {
      await withdrawMyCivicSplit();
      setSaved(null);
      setForm(EMPTY);
      toast.success('Your split is withdrawn.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not withdraw your split.');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || (user && isLoading)) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-fg-tertiary" />
      </div>
    );
  }

  return (
    <EntityListShell title={CIVIC_SPLIT_COPY.title} description={CIVIC_SPLIT_COPY.lede}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="flex items-start gap-3">
                <div className="oc-icon-tile h-10 w-10 shrink-0">
                  <Landmark className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-heading text-lg text-fg-primary">
                    {CIVIC_SPLIT_COPY.question}
                  </h2>
                  <p className="mt-1 text-sm text-fg-secondary">
                    Name the three places you belong to, then move the sliders.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)]">
                <Input
                  label="Country"
                  value={form.country_code}
                  maxLength={2}
                  placeholder="CH"
                  onChange={e => set('country_code', e.target.value.toUpperCase())}
                  description="Two letters"
                />
                <Input
                  label={CIVIC_LEVELS[1].label}
                  value={form.region}
                  maxLength={CIVIC_SPLIT_LIMITS.placeName}
                  placeholder={CIVIC_LEVELS[1].example}
                  onChange={e => set('region', e.target.value)}
                />
                <Input
                  label={CIVIC_LEVELS[0].label}
                  value={form.locality}
                  maxLength={CIVIC_SPLIT_LIMITS.placeName}
                  placeholder={CIVIC_LEVELS[0].example}
                  onChange={e => set('locality', e.target.value)}
                />
              </div>

              <ShareSliders
                shares={form.shares}
                onChange={shares => set('shares', shares)}
                placeNames={{
                  locality: form.locality,
                  region: form.region,
                  nation: form.country_code.length === 2 ? form.country_code : '',
                }}
                disabled={isSaving}
              />

              <Textarea
                label="Why, in a sentence (optional)"
                value={form.note}
                maxLength={CIVIC_SPLIT_LIMITS.note}
                rows={2}
                placeholder="I know what my street needs better than anyone in the capital does."
                onChange={e => set('note', e.target.value)}
              />

              <label className="flex items-start gap-3 rounded-lg border border-default bg-surface-raised p-4">
                <Switch
                  checked={form.is_public}
                  onCheckedChange={checked => set('is_public', checked)}
                  aria-label={CIVIC_SPLIT_COPY.publicLabel}
                />
                <span className="text-sm">
                  <span className="block font-medium text-fg-primary">
                    {CIVIC_SPLIT_COPY.publicLabel}
                  </span>
                  <span className="block text-fg-tertiary">{CIVIC_SPLIT_COPY.publicHint}</span>
                </span>
              </label>

              <p className="text-xs leading-relaxed text-fg-tertiary">{CIVIC_SPLIT_CAVEAT}</p>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="accent"
                  onClick={handleSave}
                  disabled={!canSave || isSaving}
                  isLoading={isSaving}
                >
                  {saved ? 'Update my split' : 'Declare my split'}
                </Button>
                {saved && (
                  <Button variant="ghost" onClick={handleWithdraw} disabled={isSaving}>
                    Withdraw
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <PlaceAggregateCard
            countryCode={(saved?.country_code ?? form.country_code).toUpperCase()}
            region={saved?.region ?? form.region}
          />
          <Card variant="minimal">
            <CardContent className="space-y-2 p-6 text-sm text-fg-secondary">
              <h2 className="font-heading text-base text-fg-primary">What happens with it</h2>
              <p>
                Today: it is your public statement, and it goes into the average for your place.
              </p>
              <p>
                Next: local funds. When your locality has one, the share you give it here becomes
                the standing instruction for what you contribute voluntarily — on top of what the
                law takes, never instead of it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </EntityListShell>
  );
}

export default CivicSplitScreen;
