'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import { registerHrefKeepingSentence } from '@/config/cat-door';
import { HERO_COPY } from '@/config/landing-page';
import { PAY_COPY, PAY_LINK_PLACEHOLDER, payLinkDisplay } from '@/config/pay';
import { USERNAME_MAX_LENGTH, isReservedUsername, isValidUsername } from '@/config/usernames';

const { claim, preview } = HERO_COPY;

/** Only what a pay-link name may hold; a space becomes the hyphen it meant. */
export function cleanClaimName(typed: string): string {
  return typed
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, USERNAME_MAX_LENGTH);
}

/** Why this name cannot be claimed, from what the page itself can tell; null when it may be. */
export function claimNameProblem(name: string): string | null {
  if (!isValidUsername(name)) {
    return claim.invalid;
  }
  return isReservedUsername(name) ? claim.unavailable : null;
}

/**
 * The hero's one action: `orangecat.ch/pay/` and a name, then "Claim your
 * link".
 *
 * The name is checked before the visitor is asked to sign up for it: its
 * shape and the reserved names here, and whether somebody has it by asking
 * /api/pay/name. A check that cannot be made does not block; the Cat says so
 * later if the name turned out to be taken. Claiming opens the register form,
 * and the account lands on the Cat with the sentence that puts the page at
 * that name (the Cat renames the handle; a new account's own handle is
 * minted, not chosen).
 *
 * Under the field, the page the name makes: the pay page's own title and
 * words (PAY_COPY), with the name as typed. No person and no figure in it is
 * made up, because there is none in it.
 */
export default function ClaimLinkForm() {
  const router = useRouter();
  const fieldId = useId();
  const hintId = useId();
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function claimName(event: React.FormEvent) {
    event.preventDefault();
    if (checking) {
      return;
    }
    const found = claimNameProblem(name);
    if (found) {
      setProblem(found);
      return;
    }
    setChecking(true);
    try {
      const response = await fetch(`${API_ROUTES.PAY_NAME}?name=${encodeURIComponent(name)}`);
      const json = response.ok ? await response.json().catch(() => null) : null;
      if (json?.data?.status === 'taken') {
        setProblem(claim.unavailable);
        setChecking(false);
        return;
      }
    } catch {
      // The check is a courtesy. Without it the claim still goes ahead.
    }
    router.push(registerHrefKeepingSentence(claim.catSentence(name)));
  }

  const shown = name || PAY_LINK_PLACEHOLDER;

  return (
    <div className="oc-public-hero-claim">
      <form onSubmit={claimName} noValidate className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor={fieldId} className="sr-only">
          {claim.label}
        </label>
        <div className="flex min-h-14 min-w-0 flex-1 items-center rounded-lg border border-default bg-surface-base pl-4 text-left focus-within:border-interactive">
          <span className="shrink-0 text-base text-fg-secondary">{claim.prefix}</span>
          <input
            id={fieldId}
            name="name"
            value={name}
            onChange={event => {
              setName(cleanClaimName(event.target.value));
              setProblem(null);
            }}
            placeholder={claim.placeholder}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={problem ? true : undefined}
            aria-describedby={hintId}
            className="min-h-14 min-w-0 flex-1 rounded-r-lg border-0 bg-transparent pl-0 pr-4 font-medium text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-0"
          />
        </div>
        <Button type="submit" variant="accent" size="xl" isLoading={checking} className="shrink-0">
          {checking ? claim.checking : claim.submit}
          {!checking && <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />}
        </Button>
      </form>

      <p
        id={hintId}
        role={problem ? 'alert' : undefined}
        className={
          problem ? 'mb-0 mt-3 text-sm text-status-negative' : 'mb-0 mt-3 text-sm text-fg-secondary'
        }
      >
        {problem ?? claim.hint}
      </p>

      <figure className="mx-auto mt-8 w-full max-w-sm sm:mt-10">
        <div className="rounded-lg border border-default bg-surface-base p-5 text-left">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-raised font-heading text-lg font-semibold uppercase text-fg-primary"
            >
              {shown.charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="mb-0 break-all font-heading text-lg font-semibold leading-tight text-fg-primary">
                {PAY_COPY.title(shown)}
              </p>
              <p className="mb-0 text-sm text-fg-secondary">{PAY_COPY.subtitle}</p>
            </div>
          </div>
          <p className="mb-0 mt-4 break-all rounded-md bg-surface-raised px-3 py-2.5 font-mono text-sm text-fg-primary">
            {payLinkDisplay(shown)}
          </p>
          <p className="mb-0 mt-3 text-xs leading-relaxed text-fg-secondary">
            {PAY_COPY.disclaimer}
          </p>
        </div>
        <figcaption className="mt-3 text-xs text-fg-secondary">{preview.caption}</figcaption>
      </figure>
    </div>
  );
}
