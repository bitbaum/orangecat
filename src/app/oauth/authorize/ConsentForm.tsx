/**
 * Consent screen body. Server component — every button submits to a server
 * action via `formAction`; all OAuth params ride along as hidden inputs
 * (re-validated server-side, never trusted).
 *
 * What a person must be able to read here before choosing, in order:
 * which account, which app, what it can do (the risky part first), where they
 * are sent, how long it lasts and how to undo it, and whose rules apply.
 */
import Link from 'next/link';
import { AlertTriangle, Check } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { approveAuthorization, denyAuthorization, switchAccount } from './actions';

interface ScopeRow {
  name: string;
  description: string;
  /** Reads private data or acts in the person's name (OAUTH_SCOPES). */
  sensitive: boolean;
}

export interface ConsentAccount {
  name: string | null;
  username: string | null;
  email: string | null;
}

const linkClass = 'underline underline-offset-2 hover:text-fg-primary';

export function ConsentForm({
  clientName,
  selfRegistered,
  redirectHost,
  account,
  policyUri,
  tosUri,
  resourceName,
  scopes,
  hidden,
}: {
  clientName: string;
  /** The app registered itself (RFC 7591) — its name is its own claim. */
  selfRegistered: boolean;
  /** Where the person is sent back to — the one fact the app cannot fake. */
  redirectHost: string;
  /** The OrangeCat account that is about to be shared. */
  account: ConsentAccount;
  /** The app's own privacy policy / terms (https, from oauth_clients). */
  policyUri: string | null;
  tosUri: string | null;
  /** The resource the token is for (OrangeCat, Loki), when one was named. */
  resourceName: string | null;
  scopes: ScopeRow[];
  hidden: Record<string, string>;
}) {
  const risky = scopes.filter(s => s.sensitive);
  const routine = scopes.filter(s => !s.sensitive);
  const primaryName = account.name || (account.username ? `@${account.username}` : account.email);
  const secondary = [
    account.name && account.username ? `@${account.username}` : null,
    account.email !== primaryName ? account.email : null,
  ].filter(Boolean);

  return (
    <form className="oc-surface oc-surface-padding rounded-card">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div className="mb-5 flex items-center justify-between gap-3 border-b border-border-default pb-4 text-sm">
        <p className="min-w-0 text-fg-secondary">
          Signed in as{' '}
          <span className="font-medium text-fg-primary">{primaryName ?? 'your account'}</span>
          {secondary.length > 0 && (
            <span className="block truncate text-xs text-fg-tertiary">{secondary.join(' · ')}</span>
          )}
        </p>
        <button
          type="submit"
          formAction={switchAccount}
          className={`shrink-0 text-sm text-fg-secondary ${linkClass}`}
        >
          Not you?
        </button>
      </div>

      <h1 className="text-xl font-semibold text-fg-primary">
        Allow <span className="text-accent-warm">{clientName}</span> to use your OrangeCat account?
      </h1>
      <p className="mt-2 text-sm text-fg-secondary">
        {resourceName
          ? `It will be able to use ${resourceName} on your behalf, until you remove it:`
          : 'It will be able to act on your behalf, until you remove it:'}
      </p>

      {selfRegistered ? (
        <p className="mt-4 rounded-card border border-border-default bg-surface-raised px-3 py-2 text-sm text-fg-secondary">
          This app registered itself and has not been verified by OrangeCat. The name above is what
          it calls itself. After you choose, you will be sent to{' '}
          <span className="font-medium text-fg-primary">{redirectHost}</span> — only allow it if you
          started this from that app.
        </p>
      ) : (
        <p className="mt-2 text-sm text-fg-secondary">
          After you choose, you will be sent to{' '}
          <span className="font-medium text-fg-primary">{redirectHost}</span>.
        </p>
      )}

      {risky.length > 0 && (
        <section className="mt-5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-status-warning">
            Can act as you or see private data
          </h2>
          <ul className="mt-2 space-y-3">
            {risky.map(s => (
              <li key={s.name} className="flex gap-3 text-sm">
                <AlertTriangle
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-status-warning"
                />
                <span className="text-fg-primary">{s.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {routine.length > 0 && (
        <section className="mt-5">
          {risky.length > 0 && (
            <h2 className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">
              And also
            </h2>
          )}
          <ul className="mt-2 space-y-3">
            {routine.map(s => (
              <li key={s.name} className="flex gap-3 text-sm">
                <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent-warm" />
                <span className="text-fg-primary">{s.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-5 text-xs text-fg-secondary">
        {policyUri || tosUri ? (
          <>
            {clientName}&rsquo;s{' '}
            {policyUri && (
              <a href={policyUri} target="_blank" rel="noopener noreferrer" className={linkClass}>
                privacy policy
              </a>
            )}
            {policyUri && tosUri && ' and '}
            {tosUri && (
              <a href={tosUri} target="_blank" rel="noopener noreferrer" className={linkClass}>
                terms
              </a>
            )}{' '}
            say what it does with your data.
          </>
        ) : (
          <>{clientName} has not published a privacy policy or terms with OrangeCat.</>
        )}
      </p>

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          formAction={denyAuthorization}
          className="flex-1 rounded-btn border border-border-default px-4 py-2.5 text-sm font-medium text-fg-primary hover:bg-surface-raised"
        >
          Deny
        </button>
        <button
          type="submit"
          formAction={approveAuthorization}
          className="flex-1 rounded-btn bg-accent-warm px-4 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-hover"
        >
          Allow
        </button>
      </div>

      <p className="mt-4 text-xs text-fg-tertiary">
        Access stays until you remove it in{' '}
        <Link href={ROUTES.SETTINGS_INTEGRATIONS} target="_blank" className={linkClass}>
          Settings → Connected apps
        </Link>
        . OrangeCat&rsquo;s{' '}
        <Link href={ROUTES.TERMS} target="_blank" className={linkClass}>
          Terms
        </Link>{' '}
        and{' '}
        <Link href={ROUTES.PRIVACY} target="_blank" className={linkClass}>
          Privacy Policy
        </Link>{' '}
        apply to what OrangeCat shares.
      </p>
    </form>
  );
}
