/**
 * ProfileOfferings — "What I can offer" on the public maker profile.
 *
 * The Cat extracts a person's latent economic value (skills, assets, what
 * people come to them for) into user_economic_profile, but until now it lived
 * only in Cat's private context and never surfaced. This renders the
 * offer-oriented signals on the profile — the "what I do / can do" answer a
 * visitor (or a potential client) actually wants — and gives the owner a
 * one-click path from a skill to the matching monetizable entity.
 *
 * Only the offer-facing fields are shown (skills, asked-for, assets, and
 * not-available-for — the scope they explicitly aren't taking on right now).
 * Private signals (constraints, motivation) are deliberately omitted — the
 * PublicEconomicProfile type this reads doesn't even carry them.
 */

import Link from 'next/link';
import { Sparkles, Plus, MinusCircle, Globe, MessageCircle } from 'lucide-react';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import {
  suggestedEntityForSkill,
  type PublicEconomicProfile,
} from '@/services/cat/economic-profile';

interface ProfileOfferingsProps {
  economicProfile?: PublicEconomicProfile | null;
  isOwnProfile?: boolean;
}

/** Opens the Cat with the question already typed. */
function askCatHref(question: string): string {
  return `${ROUTES.DASHBOARD.CAT}?q=${encodeURIComponent(question)}`;
}

const DISCOVER_QUESTION =
  "Help me work out what I can offer. Ask me what I'm good at, what I own that could earn, " +
  'and what other people come to me for — then put it on my profile.';

// The Cat can remove entries as well as add them (removeFromEconomicProfile),
// which is the only way to take something off this card. Say so, because a
// wrong entry here is wrong in public.
const CORRECT_QUESTION =
  'Go through "What I can offer" on my profile with me. Remove anything that is not right ' +
  "and help me add what's missing.";

function AskCatLink({ label, question }: { label: string; question: string }) {
  return (
    <Link
      href={askCatHref(question)}
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-fg-secondary underline-offset-2 hover:text-fg-primary hover:underline"
    >
      <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
      {label}
    </Link>
  );
}

export default function ProfileOfferings({ economicProfile, isOwnProfile }: ProfileOfferingsProps) {
  const skills = economicProfile?.skills ?? [];
  const askedFor = economicProfile?.askedFor ?? [];
  const assets = economicProfile?.assets ?? [];
  const notAvailableFor = economicProfile?.notAvailableFor ?? [];
  const isEmpty =
    skills.length === 0 &&
    askedFor.length === 0 &&
    assets.length === 0 &&
    notAvailableFor.length === 0;

  if (isEmpty) {
    // A visitor sees nothing. The owner sees the way to fill it — an empty
    // section is the one place the invitation is most useful, and it used to
    // be the one place that rendered nothing at all.
    if (!isOwnProfile) {
      return null;
    }
    return (
      <div className="mb-3 rounded-md border border-subtle bg-surface-raised/40 p-4 sm:mb-4">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-fg-secondary" />
          <h2 className="text-sm font-semibold text-fg-primary">What I can offer</h2>
        </div>
        <p className="mb-3 text-xs text-fg-secondary">
          Nothing here yet. This is the part of your profile a potential client actually reads.
        </p>
        <AskCatLink label="Ask Cat to help me figure this out" question={DISCOVER_QUESTION} />
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-md border border-subtle bg-surface-raised/40 p-4 sm:mb-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-fg-secondary" />
        <h2 className="text-sm font-semibold text-fg-primary">What I can offer</h2>
      </div>

      {skills.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-tertiary">
            Skills
          </p>
          <div className="flex flex-wrap gap-2">
            {skills.map(skill => {
              const type = suggestedEntityForSkill(skill.name);
              const meta = ENTITY_REGISTRY[type];
              const label = skill.years ? `${skill.name} · ${skill.years}y` : skill.name;
              // Owner: skill is a shortcut to the matching create form, seeded so
              // the AI-fill box (see AIPrefillBar) can generate the entity.
              if (isOwnProfile && meta) {
                const href = `${meta.createPath}?description=${encodeURIComponent(
                  `I offer ${skill.name}${skill.years ? ` (${skill.years} years of experience)` : ''}.`
                )}`;
                return (
                  <Link
                    key={skill.name}
                    href={href}
                    className="inline-flex items-center gap-1 rounded-full border border-default bg-surface-base px-2.5 py-0.5 text-xs font-medium text-fg-primary transition-colors hover:border-strong"
                  >
                    <Plus className="h-3 w-3" />
                    {label}
                  </Link>
                );
              }
              return (
                <span
                  key={skill.name}
                  className="inline-flex items-center rounded-full border border-default bg-surface-base px-2.5 py-0.5 text-xs font-medium text-fg-primary"
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {askedFor.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-tertiary">
            People come to me for
          </p>
          <div className="flex flex-wrap gap-2">
            {askedFor.map(item => (
              <span
                key={item}
                className="inline-flex items-center rounded-full border border-default bg-surface-base px-2.5 py-0.5 text-xs text-fg-secondary"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {assets.length > 0 && (
        <div className={notAvailableFor.length > 0 ? 'mb-3' : undefined}>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-tertiary">
            Assets
          </p>
          <div className="flex flex-wrap gap-2">
            {assets.map(asset => (
              <span
                key={asset.name}
                className="inline-flex items-center rounded-full border border-default bg-surface-base px-2.5 py-0.5 text-xs text-fg-secondary"
              >
                {asset.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {notAvailableFor.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-fg-tertiary">
            <MinusCircle className="h-3 w-3" />
            Not currently taking on
          </p>
          <div className="flex flex-wrap gap-2">
            {notAvailableFor.map(item => (
              <span
                key={item}
                className="inline-flex items-center rounded-full border border-dashed border-default px-2.5 py-0.5 text-xs text-fg-tertiary"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {isOwnProfile && (
        <div className="mt-4 flex flex-col gap-2 border-t border-subtle pt-3 sm:flex-row sm:items-center sm:justify-between">
          {/* "Only you see these create shortcuts" was true of the +buttons and
              easy to read as though it covered the entries themselves. It does
              not: everything above is on the public profile. Say which is which. */}
          <p className="flex items-start gap-1.5 text-xs text-fg-tertiary">
            <Globe className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Visible to everyone.
              {skills.length > 0 && ' The + shortcuts are yours alone — tap one to list it.'}
            </span>
          </p>
          <AskCatLink label="Ask Cat to fix or add to this" question={CORRECT_QUESTION} />
        </div>
      )}
    </div>
  );
}
