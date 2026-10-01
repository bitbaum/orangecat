/**
 * What the consent screen must say before anyone clicks Allow.
 *
 * Compared against X's own "Authorize app" screen (2026-10-01), ours listed
 * scopes more precisely but left out five things a person needs to decide:
 * which account is being shared, how long access lasts and where to undo it,
 * which permissions are the risky ones, the app's own privacy/terms, and where
 * a verified app sends you. Each is pinned here.
 */
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/app/oauth/authorize/actions', () => ({
  approveAuthorization: vi.fn(),
  denyAuthorization: vi.fn(),
  switchAccount: vi.fn(),
}));

import { ConsentForm } from '@/app/oauth/authorize/ConsentForm';
import { OAUTH_SCOPES } from '@/lib/oauth/config';
import { ROUTES } from '@/config/routes';

type Props = Parameters<typeof ConsentForm>[0];

function rowsFor(...names: string[]): Props['scopes'] {
  return names.map(name => {
    const s = OAUTH_SCOPES.find(x => x.name === name)!;
    return { name, description: s.description, sensitive: !!s.sensitive };
  });
}

function html(overrides: Partial<Props> = {}): string {
  return renderToStaticMarkup(
    <ConsentForm
      clientName="Loki"
      selfRegistered={false}
      redirectHost="loki.orangecat.ch"
      account={{ name: 'Ada', username: 'ada', email: 'ada@example.com' }}
      policyUri={null}
      tosUri={null}
      resourceName={null}
      scopes={rowsFor('openid', 'messages.write')}
      hidden={{ client_id: 'loki' }}
      {...overrides}
    />
  );
}

/** Text with tags stripped and entities for ’ undone, for readable asserts. */
const text = (h: string) =>
  h
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rsquo;|&#x27;|’/g, "'")
    .replace(/\s+/g, ' ');

describe('consent screen', () => {
  it('names the account being shared, with a way to switch', () => {
    const t = text(html());
    expect(t).toContain('Signed in as Ada');
    expect(t).toContain('@ada · ada@example.com');
    expect(t).toContain('Not you?');
  });

  it('falls back to the email when there is no profile name', () => {
    const t = text(html({ account: { name: null, username: null, email: 'x@example.com' } }));
    expect(t).toContain('Signed in as x@example.com');
  });

  it('lists risky permissions first, under a warning heading', () => {
    const t = text(html({ scopes: rowsFor('openid', 'messages.write', 'wallet.read') }));
    const warn = t.indexOf('Can act as you or see private data');
    expect(warn).toBeGreaterThan(-1);
    expect(t.indexOf('Send messages on your behalf')).toBeGreaterThan(warn);
    expect(t.indexOf('See your wallet balances')).toBeGreaterThan(warn);
    expect(t.indexOf('And also')).toBeGreaterThan(t.indexOf('See your wallet balances'));
    expect(t.indexOf('Sign you in')).toBeGreaterThan(t.indexOf('And also'));
  });

  it('shows no warning heading when nothing risky is asked for', () => {
    const t = text(html({ scopes: rowsFor('openid', 'profile', 'email') }));
    expect(t).not.toContain('Can act as you');
    expect(t).not.toContain('And also');
  });

  it('says how long access lasts and links to where it is removed', () => {
    const h = html();
    expect(text(h)).toContain('until you remove it');
    expect(h).toContain(`href="${ROUTES.SETTINGS_INTEGRATIONS}"`);
    expect(h).toContain(`href="${ROUTES.TERMS}"`);
    expect(h).toContain(`href="${ROUTES.PRIVACY}"`);
  });

  it("links the app's own privacy policy and terms when it has them", () => {
    const h = html({
      policyUri: 'https://loki.orangecat.ch/privacy',
      tosUri: 'https://loki.orangecat.ch/terms',
    });
    expect(h).toContain('href="https://loki.orangecat.ch/privacy"');
    expect(h).toContain('href="https://loki.orangecat.ch/terms"');
    expect(h).toContain('rel="noopener noreferrer"');
  });

  it('says so when the app has published neither', () => {
    expect(text(html())).toContain('Loki has not published a privacy policy or terms');
  });

  it('shows where a verified app sends you, not only a self-registered one', () => {
    const verified = text(html());
    expect(verified).toContain('you will be sent to loki.orangecat.ch');
    expect(verified).not.toContain('not been verified');

    const dcr = text(html({ selfRegistered: true, redirectHost: 'claude.ai' }));
    expect(dcr).toContain('not been verified by OrangeCat');
    expect(dcr).toContain('you will be sent to claude.ai');
  });

  it('every sensitive scope in the registry is one that reads private data or acts', () => {
    // A guard against marking by accident: the flag must stay on the scopes
    // that act (write/act) or read something private, and never on identity.
    const sensitive = OAUTH_SCOPES.filter(s => s.sensitive).map(s => s.name);
    expect(sensitive).not.toEqual(expect.arrayContaining(['openid']));
    expect(sensitive).not.toContain('profile');
    expect(sensitive).not.toContain('email');
    for (const s of OAUTH_SCOPES.filter(x => /\.(write|act)$/.test(x.name))) {
      expect(sensitive).toContain(s.name);
    }
  });
});
