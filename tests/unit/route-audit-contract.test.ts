import { ROUTE_AUDIT_CONTRACT } from '../e2e/route-inventory';

describe('route audit release contract', () => {
  it('requires all three explicit desktop/mobile viewports', () => {
    expect(ROUTE_AUDIT_CONTRACT.viewports).toEqual([
      { project: 'chromium', width: 1440, height: 1000 },
      { project: 'mobile-375', width: 375, height: 812 },
      { project: 'mobile-390', width: 390, height: 844 },
    ]);
  });

  it('cannot call strict release green with missing auth, fixtures, scans, routes, or links', () => {
    expect(ROUTE_AUDIT_CONTRACT.strictRelease).toEqual({
      authenticatedStateRequired: true,
      authenticatedSemanticsRequired: true,
      fixtureRequiredAllowed: false,
      scanErrorsAllowed: false,
      routeFailuresAllowed: false,
      internalLinkFailuresAllowed: false,
    });
  });

  it('records full-page evidence and the intentionally bounded checks', () => {
    expect(ROUTE_AUDIT_CONTRACT.evidence).toBe('full-page-screenshot-for-every-resolved-route');
    expect(ROUTE_AUDIT_CONTRACT.checks).toContain('topmost-element-occlusion-at-every-scroll-step');
    expect(ROUTE_AUDIT_CONTRACT.exclusions).toContain('destructive-or-third-party-mutations');
  });

  it('keeps runtime fixture discovery read-only and honest about empty datasets', () => {
    expect(ROUTE_AUDIT_CONTRACT.fixtureDiscovery).toEqual({
      mode: 'get-only-existing-records',
      execution: 'request-context-only-no-client-effects',
      emptyData: 'fixture-required',
      excludedEndpoints: [
        '/api/profile',
        '/api/messages/self',
        '/api/cat/nudges',
        '/api/cat/actions',
      ],
    });
  });
});
