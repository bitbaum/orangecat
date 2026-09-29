/**
 * Consent screen body. Server component — the Allow/Deny buttons submit to the
 * server actions via `formAction`; all OAuth params ride along as hidden inputs
 * (re-validated server-side, never trusted).
 */
import { approveAuthorization, denyAuthorization } from './actions';

interface ScopeRow {
  name: string;
  description: string;
}

export function ConsentForm({
  clientName,
  selfRegistered,
  redirectHost,
  resourceName,
  scopes,
  hidden,
}: {
  clientName: string;
  /** The app registered itself (RFC 7591) — its name is its own claim. */
  selfRegistered: boolean;
  /** Where the person is sent back to — the one fact the app cannot fake. */
  redirectHost: string;
  /** The resource the token is for (OrangeCat, Loki), when one was named. */
  resourceName: string | null;
  scopes: ScopeRow[];
  hidden: Record<string, string>;
}) {
  return (
    <div className="oc-surface oc-surface-padding rounded-card">
      <h1 className="text-xl font-semibold text-fg-primary">
        Allow <span className="text-accent-warm">{clientName}</span> to use your OrangeCat account?
      </h1>
      <p className="mt-2 text-sm text-fg-secondary">
        {resourceName
          ? `It will be able to use ${resourceName} on your behalf for the following:`
          : 'It will be able to act on your behalf for the following:'}
      </p>

      {selfRegistered && (
        <p className="mt-4 rounded-card border border-border-default bg-surface-raised px-3 py-2 text-sm text-fg-secondary">
          This app registered itself and has not been verified by OrangeCat. The name above is what
          it calls itself. After you choose, you will be sent to{' '}
          <span className="font-medium text-fg-primary">{redirectHost}</span> — only allow it if you
          started this from that app.
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {scopes.map(s => (
          <li key={s.name} className="flex gap-3 text-sm">
            <span aria-hidden className="mt-0.5 text-accent-warm">
              ✓
            </span>
            <span className="text-fg-primary">{s.description}</span>
          </li>
        ))}
      </ul>

      <form className="mt-8 flex gap-3">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
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
      </form>

      <p className="mt-4 text-xs text-fg-tertiary">
        You can revoke access anytime in your OrangeCat settings.
      </p>
    </div>
  );
}
