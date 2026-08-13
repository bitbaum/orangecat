import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import routeAliases from '../../src/config/route-aliases.json';
import { requiresAuthentication } from '../../src/config/route-access';
import {
  expectedAliasTerminalDestination,
  expectedAppPageDestination,
  matchesRedirectExpectation,
} from '../../src/config/route-redirects';
import {
  discoverAppRoutes,
  resolveDynamicFixture,
  ROUTE_AUDIT_CONTRACT,
  type AppRoute,
  type RuntimeRouteFixtures,
} from './route-inventory';
import { deriveRuntimeFixtures } from './runtime-route-fixtures';

type Outcome = 'rendered' | 'redirected' | 'auth-redirect' | 'fixture-required' | 'failed';

interface RouteAuditResult {
  routePattern: string;
  requestedPath: string | null;
  source: 'app-page' | 'route-alias';
  sourceFile?: string;
  routeSurface?: AppRoute['surface'];
  routeAccess?: AppRoute['access'];
  authMode: 'anonymous' | 'authenticated';
  outcome: Outcome;
  finalUrl: string | null;
  finalStatus: number | null;
  redirectChain: Array<{ url: string; status: number | null }>;
  issues: string[];
  pageErrors: string[];
  consoleErrors: string[];
  screenshotPath?: string;
  auditMetrics?: {
    touchTargetViolations: string[];
    clippedOrOccludedControls: string[];
    nestedInteractiveControls: string[];
    axeViolations: Array<{ id: string; impact: string | null; targets: string[] }>;
    loadingIndicatorsRemaining: number;
    scrollPositionsChecked: number;
  };
  links?: {
    internal: string[];
    external: string[];
    actions: string[];
    invalid: string[];
  };
}

interface InternalLinkCheck {
  path: string;
  sourcePaths: string[];
  sourceAccess: Array<AppRoute['access'] | 'alias'>;
  finalUrl: string | null;
  status: number | null;
  contentType: string | null;
  finalSemantics: 'auth' | 'protected' | 'visitor' | 'external' | null;
  outcome: 'working' | 'failed';
  issues: Array<
    | 'http-error'
    | 'next-not-found'
    | 'navigation-error'
    | 'unexpected-content-type'
    | 'unexpected-external-redirect'
    | 'public-link-ended-at-auth'
    | 'unexpected-auth-destination'
    | 'protected-link-missed-auth-boundary'
    | 'protected-link-lost-return-path'
  >;
}

const STRICT_RELEASE = process.env.ROUTE_AUDIT_STRICT === '1';
const AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const NOT_FOUND_COPY = [
  /page not found/i,
  /this page could not be found/i,
  /404\s*[-—:]?\s*not found/i,
];
const ERROR_COPY = [/application error/i, /internal server error/i, /unhandled runtime error/i];
function materializeAlias(value: string): string {
  return value
    .replace(':path*', 'audit-path')
    .replace(':username', 'audit-user')
    .replace(':id', 'audit-fixture');
}

function materializeProtectedPattern(pattern: string): string {
  return pattern.replace(/\[(?:\.\.\.)?[^\]]+\]/g, 'audit-auth-boundary');
}

function resolveAliasPath(
  sourcePattern: string,
  runtimeFixtures: RuntimeRouteFixtures
): string | null {
  if (sourcePattern.includes(':username')) {
    const profilePath = runtimeFixtures['/profiles/[username]'];
    const runtimeUsername = profilePath
      ? decodeURIComponent(profilePath.split('/').filter(Boolean).at(-1) ?? '')
      : '';
    const username = process.env.E2E_PROFILE_USERNAME || runtimeUsername;
    if (!username) {
      return null;
    }
    return sourcePattern.replace(':username', encodeURIComponent(username));
  }
  if (sourcePattern.includes(':id')) {
    const projectPath = runtimeFixtures['/projects/[id]'];
    const runtimeProjectId = projectPath
      ? decodeURIComponent(projectPath.split('/').filter(Boolean).at(-1) ?? '')
      : '';
    const projectId = process.env.E2E_PROJECT_ID || runtimeProjectId;
    return projectId ? sourcePattern.replace(':id', encodeURIComponent(projectId)) : null;
  }
  return materializeAlias(sourcePattern);
}

function reportDirectory(testInfo: TestInfo): string {
  const configured = process.env.ROUTE_AUDIT_EVIDENCE_DIR;
  const root = configured
    ? path.resolve(process.cwd(), configured)
    : path.resolve(process.cwd(), 'test-results', 'route-audit');
  return path.join(root, testInfo.project.name);
}

function evidenceFileStem(routePattern: string, requestedPath: string): string {
  const raw = routePattern === '/' ? 'home' : routePattern;
  const normalized = raw
    .replace(/^\//, '')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const query = new URL(requestedPath, 'https://orangecat.invalid').searchParams.toString();
  return `${normalized || 'home'}${query ? `-${query.replace(/[^a-zA-Z0-9_-]+/g, '-')}` : ''}`;
}

async function waitForPageCompletion(page: Page): Promise<number> {
  await page
    .waitForFunction(
      () => {
        if (document.readyState !== 'complete') {
          return false;
        }
        const visible = (element: Element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
        };
        const pending = [
          ...document.querySelectorAll(
            '[aria-busy="true"], [data-loading="true"], [data-testid*="loading" i], [class*="skeleton" i]'
          ),
        ].filter(visible);
        const mainText = document.querySelector('main')?.textContent?.trim() ?? '';
        return pending.length === 0 && !/^(loading|please wait)(?:\.{0,3})?$/i.test(mainText);
      },
      undefined,
      { timeout: 5_000 }
    )
    .catch(() => undefined);

  return page
    .evaluate(() => {
      const pending = [
        ...document.querySelectorAll(
          '[aria-busy="true"], [data-loading="true"], [data-testid*="loading" i], [class*="skeleton" i]'
        ),
      ].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length;
      const mainText = document.querySelector('main')?.textContent?.trim() ?? '';
      return (
        pending +
        (document.readyState === 'complete' ? 0 : 1) +
        (/^(loading|please wait)(?:\.{0,3})?$/i.test(mainText) ? 1 : 0)
      );
    })
    .catch(error => {
      throw new Error(
        `loading-completion scan failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
}

async function inspectResponsiveSemantics(
  page: Page
): Promise<NonNullable<RouteAuditResult['auditMetrics']>> {
  const layout = await page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0
      );
    };
    const describe = (element: Element) => {
      const id = element.id ? `#${element.id}` : '';
      const classes = [...element.classList]
        .slice(0, 2)
        .map(name => `.${name}`)
        .join('');
      return `${element.tagName.toLowerCase()}${id}${classes}`;
    };
    const interactive = [
      ...document.querySelectorAll(
        'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])'
      ),
    ].filter(visible);
    const touchTargetViolations: string[] = [];
    const clippedOrOccludedControls: string[] = [];

    for (const element of interactive) {
      // Native checkboxes/radios are intentionally small visuals; when a
      // visible wrapping label is the hit area, audit that real target.
      const wrappingLabel = element.matches('input,select,textarea')
        ? element.closest('label')
        : null;
      const hitTarget = wrappingLabel && visible(wrappingLabel) ? wrappingLabel : element;
      const rect = hitTarget.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const inlineTextLink =
        element.tagName === 'A' &&
        style.display === 'inline' &&
        element.parentElement?.textContent?.trim() !== element.textContent?.trim();
      if (!inlineTextLink && (rect.width < 44 || rect.height < 44)) {
        touchTargetViolations.push(
          `${describe(element)}:${Math.round(rect.width)}x${Math.round(rect.height)}`
        );
      }

      const clipped =
        rect.left < -1 ||
        rect.right > document.documentElement.clientWidth + 1 ||
        rect.width < 1 ||
        rect.height < 1;
      const sampleX = Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1);
      const sampleY = Math.min(Math.max(rect.top + rect.height / 2, 0), innerHeight - 1);
      const topmost = document.elementFromPoint(sampleX, sampleY);
      const occluded =
        rect.bottom > 0 &&
        rect.top < innerHeight &&
        topmost !== null &&
        topmost !== hitTarget &&
        !hitTarget.contains(topmost);
      if (clipped || occluded) {
        clippedOrOccludedControls.push(describe(element));
      }
    }

    return {
      touchTargetViolations: [...new Set(touchTargetViolations)].slice(0, 100),
      clippedOrOccludedControls: [...new Set(clippedOrOccludedControls)].slice(0, 100),
      nestedInteractiveControls: [
        ...new Set(
          [...document.querySelectorAll('a button,a [role="button"],button a,button [role="link"]')]
            .filter(visible)
            .map(describe)
        ),
      ],
    };
  });

  await page.addScriptTag({ content: AXE_SOURCE });
  const axeViolations = await page.evaluate(async () => {
    const axeApi = (
      window as unknown as {
        axe: {
          run: (options: object) => Promise<{
            violations: Array<{
              id: string;
              impact: string | null;
              nodes: Array<{ target: string[] }>;
            }>;
          }>;
        };
      }
    ).axe;
    const result = await axeApi.run({
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      rules: { 'color-contrast': { enabled: true } },
    });
    return result.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.flatMap(node => node.target).slice(0, 25),
    }));
  });

  return {
    ...layout,
    axeViolations,
    loadingIndicatorsRemaining: 0,
    scrollPositionsChecked: 0,
  };
}

async function inspectEveryScrollPosition(
  page: Page
): Promise<{ positionsChecked: number; clippedOrOccludedControls: string[] }> {
  const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const maximumScroll = Math.max(0, documentHeight - viewportHeight);
  const step = Math.max(1, Math.floor(viewportHeight * 0.8));
  const positions: number[] = [];
  for (let top = 0; top < maximumScroll; top += step) {
    positions.push(top);
  }
  positions.push(maximumScroll);
  const issues = new Set<string>();
  for (const top of positions) {
    await page.evaluate(scrollTop => window.scrollTo({ top: scrollTop, behavior: 'instant' }), top);
    await page.waitForTimeout(25);
    const positionIssues = await page.evaluate(() => {
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < innerHeight &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      };
      return [
        ...document.querySelectorAll(
          'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"]' +
            ',[tabindex]:not([tabindex="-1"])'
        ),
      ]
        .filter(visible)
        .flatMap(element => {
          const rect = element.getBoundingClientRect();
          const x = Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1);
          const y = Math.min(Math.max(rect.top + rect.height / 2, 0), innerHeight - 1);
          const topmost = document.elementFromPoint(x, y);
          const occluded = topmost !== null && topmost !== element && !element.contains(topmost);
          const clipped = rect.left < -1 || rect.right > innerWidth + 1;
          return clipped || occluded
            ? [`${element.tagName.toLowerCase()}@scroll-${Math.round(window.scrollY)}`]
            : [];
        });
    });
    positionIssues.forEach(issue => issues.add(issue));
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  return { positionsChecked: positions.length, clippedOrOccludedControls: [...issues] };
}

function writeAuthStatus(
  evidenceDir: string,
  status: 'available' | 'skipped-auth',
  reason?: string
): void {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, 'auth-status.json'),
    `${JSON.stringify({ status, reason: reason || null }, null, 2)}\n`
  );
}

async function redirectChain(
  response: Awaited<ReturnType<Page['goto']>>
): Promise<Array<{ url: string; status: number | null }>> {
  if (!response) {
    return [];
  }

  const chain: Array<{ url: string; status: number | null }> = [];
  let request: ReturnType<typeof response.request> | null = response.request();
  while (request) {
    const requestResponse = await request.response();
    chain.unshift({ url: request.url(), status: requestResponse?.status() ?? null });
    request = request.redirectedFrom();
  }
  return chain;
}

async function inspectLinks(page: Page): Promise<NonNullable<RouteAuditResult['links']>> {
  return page.locator('a').evaluateAll(anchors => {
    const inventory = {
      internal: [] as string[],
      external: [] as string[],
      actions: [] as string[],
      invalid: [] as string[],
    };
    const current = new URL(window.location.href);

    for (const anchor of anchors) {
      const rawHref = anchor.getAttribute('href')?.trim() ?? '';
      if (!rawHref || rawHref === '#' || /^javascript:/i.test(rawHref)) {
        inventory.invalid.push(rawHref || '(missing href)');
        continue;
      }

      if (rawHref.startsWith('#')) {
        const targetId = decodeURIComponent(rawHref.slice(1));
        if (!targetId || !document.getElementById(targetId)) {
          inventory.invalid.push(rawHref);
        } else {
          inventory.actions.push(rawHref);
        }
        continue;
      }

      let url: URL;
      try {
        url = new URL(rawHref, current);
      } catch {
        inventory.invalid.push(rawHref);
        continue;
      }

      if (['mailto:', 'tel:', 'bitcoin:', 'lightning:'].includes(url.protocol)) {
        inventory.actions.push(rawHref);
      } else if (url.protocol === 'http:' || url.protocol === 'https:') {
        const normalized = `${url.pathname}${url.search}`;
        if (url.origin === current.origin) {
          inventory.internal.push(normalized);
        } else {
          inventory.external.push(url.toString());
        }
      } else {
        inventory.invalid.push(rawHref);
      }
    }

    return {
      internal: [...new Set(inventory.internal)].sort(),
      external: [...new Set(inventory.external)].sort(),
      actions: [...new Set(inventory.actions)].sort(),
      invalid: [...new Set(inventory.invalid)].sort(),
    };
  });
}

async function verifyInternalLinks(
  page: Page,
  results: RouteAuditResult[]
): Promise<InternalLinkCheck[]> {
  const sourcesByTarget = new Map<
    string,
    Array<{ path: string; access: AppRoute['access'] | 'alias' }>
  >();
  for (const result of results) {
    for (const target of result.links?.internal ?? []) {
      const sources = sourcesByTarget.get(target) ?? [];
      sources.push({
        path: result.requestedPath ?? result.routePattern,
        access: result.routeAccess ?? 'alias',
      });
      sourcesByTarget.set(target, sources);
    }
  }
  const targets = [...sourcesByTarget.keys()].sort();
  const checks: InternalLinkCheck[] = [];

  // A small batch keeps the development server responsive while still making
  // every runtime-emitted internal destination part of the release contract.
  for (let index = 0; index < targets.length; index += 4) {
    const batch = targets.slice(index, index + 4);
    checks.push(
      ...(await Promise.all(
        batch.map(async target => {
          try {
            const response = await page.request.get(target, {
              failOnStatusCode: false,
              maxRedirects: 10,
              timeout: 15_000,
            });
            const status = response.status();
            const contentType = response.headers()['content-type'] ?? null;
            const body = contentType?.includes('text/html')
              ? await response.text().catch(() => '')
              : '';
            const issues: InternalLinkCheck['issues'] = [];
            const sources = sourcesByTarget.get(target) ?? [];
            const sourceAccess = [...new Set(sources.map(source => source.access))];
            const targetPathname = new URL(target, page.url()).pathname;
            const final = new URL(response.url());
            const sameOrigin = final.origin === new URL(page.url()).origin;
            const finalSemantics: InternalLinkCheck['finalSemantics'] = !sameOrigin
              ? 'external'
              : final.pathname === '/auth'
                ? 'auth'
                : requiresAuthentication(final.pathname)
                  ? 'protected'
                  : 'visitor';
            if (status >= 400) {
              issues.push('http-error');
            }
            if (NOT_FOUND_COPY.some(pattern => pattern.test(body))) {
              issues.push('next-not-found');
            }
            if (status < 400 && !contentType?.includes('text/html')) {
              issues.push('unexpected-content-type');
            }
            if (!sameOrigin) {
              issues.push('unexpected-external-redirect');
            }
            const targetRequiresAuth = requiresAuthentication(targetPathname);
            if (targetPathname !== '/auth' && !targetRequiresAuth && finalSemantics === 'auth') {
              issues.push(
                sourceAccess.includes('visitor-accessible')
                  ? 'public-link-ended-at-auth'
                  : 'unexpected-auth-destination'
              );
            }
            if (targetRequiresAuth && finalSemantics !== 'auth' && finalSemantics !== 'protected') {
              issues.push('protected-link-missed-auth-boundary');
            }
            if (
              targetRequiresAuth &&
              finalSemantics === 'auth' &&
              final.searchParams.get('from') !==
                `${new URL(target, page.url()).pathname}${new URL(target, page.url()).search}`
            ) {
              issues.push('protected-link-lost-return-path');
            }
            return {
              path: target,
              sourcePaths: [...new Set(sources.map(source => source.path))],
              sourceAccess,
              finalUrl: response.url(),
              status,
              contentType,
              finalSemantics,
              outcome: issues.length === 0 ? ('working' as const) : ('failed' as const),
              issues,
            };
          } catch {
            return {
              path: target,
              sourcePaths: [
                ...new Set((sourcesByTarget.get(target) ?? []).map(source => source.path)),
              ],
              sourceAccess: [
                ...new Set((sourcesByTarget.get(target) ?? []).map(source => source.access)),
              ],
              finalUrl: null,
              status: null,
              contentType: null,
              finalSemantics: null,
              outcome: 'failed' as const,
              issues: ['navigation-error' as const],
            };
          }
        })
      ))
    );
  }

  return checks;
}

async function auditRoute(
  page: Page,
  route: AppRoute | null,
  requestedPath: string,
  source: RouteAuditResult['source'],
  authMode: RouteAuditResult['authMode'] = 'anonymous',
  evidenceDir?: string
): Promise<RouteAuditResult> {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const onPageError = (error: Error) => pageErrors.push(error.message);
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  try {
    const response = await page.goto(requestedPath, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    // Allow hydration redirects, async headings, and the first layout pass to settle.
    await page.waitForTimeout(350);
    const loadingIndicatorsRemaining = await waitForPageCompletion(page);

    const finalUrl = page.url();
    const finalPath = new URL(finalUrl).pathname;
    const finalStatus = response?.status() ?? null;
    const bodyText = await page.locator('body').innerText();
    const visibleMainCount = await page.locator('main:visible').count();
    const visibleH1Count = await page.locator('h1:visible').count();
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
    });
    const overlayError = await page
      .locator('nextjs-portal')
      .evaluateAll(elements =>
        elements.some(element =>
          /runtime error|build error|failed to compile/i.test(element.textContent || '')
        )
      );

    // Development-only portals can sit above real controls. We inspect their
    // error content first, then remove them so occlusion/axe/screenshot evidence
    // reflects application UI rather than the framework toolbar.
    await page
      .locator('nextjs-portal')
      .evaluateAll(elements => elements.forEach(element => element.remove()));

    const issues: string[] = [];
    if (finalStatus === null || finalStatus >= 400) {
      issues.push('http-error');
    }
    if (NOT_FOUND_COPY.some(pattern => pattern.test(bodyText))) {
      issues.push('next-not-found');
    }
    if (
      pageErrors.length > 0 ||
      overlayError ||
      ERROR_COPY.some(pattern => pattern.test(bodyText))
    ) {
      issues.push('runtime-error');
    }
    if (overflow > 1) {
      issues.push('horizontal-overflow');
    }
    if (consoleErrors.length > 0) {
      issues.push('console-error');
    }
    if (visibleMainCount !== 1) {
      issues.push(visibleMainCount === 0 ? 'missing-main' : 'multiple-main');
    }
    if (visibleH1Count !== 1) {
      issues.push(visibleH1Count === 0 ? 'missing-h1' : 'multiple-h1');
    }
    const links = await inspectLinks(page);
    if (links.invalid.length > 0) {
      issues.push('invalid-link-affordance');
    }
    const auditMetrics = await inspectResponsiveSemantics(page);
    const scrollAudit = await inspectEveryScrollPosition(page);
    auditMetrics.loadingIndicatorsRemaining = loadingIndicatorsRemaining;
    auditMetrics.scrollPositionsChecked = scrollAudit.positionsChecked;
    auditMetrics.clippedOrOccludedControls = [
      ...new Set([
        ...auditMetrics.clippedOrOccludedControls,
        ...scrollAudit.clippedOrOccludedControls,
      ]),
    ];
    if (auditMetrics.loadingIndicatorsRemaining > 0) {
      issues.push('loading-incomplete');
    }
    if (auditMetrics.touchTargetViolations.length > 0) {
      issues.push('undersized-touch-target');
    }
    if (auditMetrics.clippedOrOccludedControls.length > 0) {
      issues.push('clipped-or-occluded-control');
    }
    if (auditMetrics.nestedInteractiveControls.length > 0) {
      issues.push('nested-interactive-control');
    }
    if (auditMetrics.axeViolations.length > 0) {
      issues.push('accessibility-violation');
    }

    let screenshotPath: string | undefined;
    if (evidenceDir) {
      screenshotPath = path.join(
        evidenceDir,
        'pages',
        `${source}-${authMode}-${evidenceFileStem(route?.pattern ?? requestedPath, requestedPath)}.png`
      );
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    const requestedUrl = new URL(requestedPath, finalUrl);
    const finalPathAndSearch = `${new URL(finalUrl).pathname}${new URL(finalUrl).search}`;
    const redirected =
      requestedUrl.pathname !== finalPath || requestedUrl.search !== new URL(finalUrl).search;
    const redirectExpectation = route
      ? authMode === 'anonymous' && route.access === 'authentication-required'
        ? null
        : expectedAppPageDestination(route.pattern, requestedPath)
      : source === 'route-alias'
        ? expectedAliasTerminalDestination(requestedPath, routeAliases)
        : null;
    if (
      redirected &&
      source === 'app-page' &&
      route?.access === 'visitor-accessible' &&
      !redirectExpectation
    ) {
      issues.push('unexpected-route-redirect');
    }
    if (
      redirected &&
      source === 'app-page' &&
      route?.access === 'authentication-required' &&
      authMode === 'authenticated' &&
      !redirectExpectation
    ) {
      issues.push('unexpected-authenticated-route-redirect');
    }
    if (
      redirected &&
      redirectExpectation &&
      !matchesRedirectExpectation(finalPathAndSearch, redirectExpectation)
    ) {
      issues.push('unexpected-redirect-destination');
    }
    if (!redirected && redirectExpectation) {
      issues.push('expected-redirect-did-not-occur');
    }
    if (source === 'route-alias' && !redirectExpectation) {
      issues.push('missing-alias-redirect-contract');
    }
    let outcome: Outcome = issues.length > 0 ? 'failed' : 'rendered';
    if (issues.length === 0 && redirected) {
      outcome = finalPath === '/auth' ? 'auth-redirect' : 'redirected';
    }

    return {
      routePattern: route?.pattern ?? requestedPath,
      requestedPath,
      source,
      sourceFile: route?.sourceFile,
      routeSurface: route?.surface,
      routeAccess: route?.access,
      authMode,
      outcome,
      finalUrl,
      finalStatus,
      redirectChain: await redirectChain(response),
      issues,
      pageErrors,
      consoleErrors,
      links,
      screenshotPath: screenshotPath ? path.relative(process.cwd(), screenshotPath) : undefined,
      auditMetrics,
    };
  } catch (error) {
    return {
      routePattern: route?.pattern ?? requestedPath,
      requestedPath,
      source,
      sourceFile: route?.sourceFile,
      routeSurface: route?.surface,
      routeAccess: route?.access,
      authMode,
      outcome: 'failed',
      finalUrl: page.url() || null,
      finalStatus: null,
      redirectChain: [],
      issues: ['navigation-error'],
      pageErrors,
      consoleErrors: [...consoleErrors, error instanceof Error ? error.message : String(error)],
    };
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
}

test.describe('responsive route inventory', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('classifies every App Router page and compatibility alias', async ({ page }, testInfo) => {
    test.setTimeout(15 * 60_000);

    const routes = discoverAppRoutes();
    expect(new Set(routes.map(route => route.pattern)).size).toBe(routes.length);

    const results: RouteAuditResult[] = [];
    const evidenceDir = reportDirectory(testInfo);
    fs.mkdirSync(evidenceDir, { recursive: true });
    const runtimeFixtures = await deriveRuntimeFixtures(page, 'anonymous');

    for (const route of routes) {
      const fixture =
        route.kind === 'dynamic' ? resolveDynamicFixture(route.pattern, runtimeFixtures) : null;
      if (route.kind === 'dynamic' && !fixture && route.access !== 'authentication-required') {
        results.push({
          routePattern: route.pattern,
          requestedPath: null,
          source: 'app-page',
          sourceFile: route.sourceFile,
          routeSurface: route.surface,
          routeAccess: route.access,
          authMode: 'anonymous',
          outcome: 'fixture-required',
          finalUrl: null,
          finalStatus: null,
          redirectChain: [],
          issues: ['unresolved-dynamic-fixture'],
          pageErrors: [],
          consoleErrors: [],
        });
        continue;
      }

      const requestedPath =
        fixture?.path ??
        (route.access === 'authentication-required'
          ? materializeProtectedPattern(route.pattern)
          : route.pattern);
      const result = await auditRoute(
        page,
        route,
        requestedPath,
        'app-page',
        'anonymous',
        evidenceDir
      );
      if (route.access === 'authentication-required' && result.outcome !== 'auth-redirect') {
        result.outcome = 'failed';
        result.issues.push('protected-route-did-not-auth-redirect');
      } else if (route.access === 'authentication-required' && result.finalUrl) {
        const authUrl = new URL(result.finalUrl);
        const expectedFrom = `${new URL(requestedPath, result.finalUrl).pathname}${
          new URL(requestedPath, result.finalUrl).search
        }`;
        if (
          authUrl.pathname !== '/auth' ||
          authUrl.searchParams.get('mode') !== 'login' ||
          authUrl.searchParams.get('from') !== expectedFrom
        ) {
          result.outcome = 'failed';
          result.issues.push('auth-redirect-did-not-preserve-intent');
        }
      }
      if (route.access === 'visitor-accessible' && result.outcome === 'auth-redirect') {
        result.outcome = 'failed';
        result.issues.push('visitor-journey-unexpectedly-auth-redirected');
      }
      results.push(result);
    }

    for (const alias of routeAliases) {
      const requestedPath = resolveAliasPath(alias.source, runtimeFixtures);
      if (!requestedPath) {
        results.push({
          routePattern: alias.source,
          requestedPath: null,
          source: 'route-alias',
          authMode: 'anonymous',
          outcome: 'fixture-required',
          finalUrl: null,
          finalStatus: null,
          redirectChain: [],
          issues: ['unresolved-alias-fixture'],
          pageErrors: [],
          consoleErrors: [],
        });
        continue;
      }
      results.push(
        await auditRoute(page, null, requestedPath, 'route-alias', 'anonymous', evidenceDir)
      );
    }

    const summary = results.reduce<Record<string, number>>((counts, result) => {
      counts[result.outcome] = (counts[result.outcome] || 0) + 1;
      for (const issue of result.issues) {
        counts[`issue:${issue}`] = (counts[`issue:${issue}`] || 0) + 1;
      }
      return counts;
    }, {});
    const internalLinkChecks = await verifyInternalLinks(page, results);
    const externalLinks = [
      ...new Set(results.flatMap(result => result.links?.external ?? [])),
    ].sort();
    const actionLinks = [...new Set(results.flatMap(result => result.links?.actions ?? []))].sort();
    const linkSummary = {
      internalChecked: internalLinkChecks.length,
      internalFailed: internalLinkChecks.filter(link => link.outcome === 'failed').length,
      externalReported: externalLinks.length,
      actionReported: actionLinks.length,
    };
    const report = {
      contract: ROUTE_AUDIT_CONTRACT,
      project: testInfo.project.name,
      strictRelease: STRICT_RELEASE,
      viewport: testInfo.project.use.viewport,
      appRouteCount: routes.length,
      staticRouteCount: routes.filter(route => route.kind === 'static').length,
      dynamicRouteCount: routes.filter(route => route.kind === 'dynamic').length,
      aliasCount: routeAliases.length,
      summary,
      linkSummary,
      internalLinkChecks,
      externalLinks,
      actionLinks,
      results,
    };
    fs.writeFileSync(
      path.join(evidenceDir, 'route-results.json'),
      `${JSON.stringify(report, null, 2)}\n`
    );

    const failures = results.filter(result => result.outcome === 'failed');
    const linkFailures = internalLinkChecks.filter(link => link.outcome === 'failed');
    const unresolvedFixtures = STRICT_RELEASE
      ? results.filter(result => result.outcome === 'fixture-required')
      : [];
    expect(
      { routeFailures: failures, linkFailures, unresolvedFixtures },
      [
        ...failures.map(
          failure =>
            `${failure.requestedPath || failure.routePattern}: ${failure.issues.join(', ')}`
        ),
        ...linkFailures.map(failure => `${failure.path}: ${failure.issues.join(', ')}`),
        ...unresolvedFixtures.map(failure => `${failure.routePattern}: fixture-required`),
      ].join('\n')
    ).toEqual({ routeFailures: [], linkFailures: [], unresolvedFixtures: [] });
  });

  test('audits authenticated page interiors when a storage state exists', async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.setTimeout(15 * 60_000);
    const authFile = path.resolve(process.cwd(), 'tests/.auth/user.json');
    const evidenceDir = path.join(reportDirectory(testInfo), 'authenticated');
    if (!fs.existsSync(authFile)) {
      writeAuthStatus(evidenceDir, 'skipped-auth', 'tests/.auth/user.json is unavailable');
      if (STRICT_RELEASE) {
        throw new Error('strict-release: authenticated storage state is required');
      }
      test.skip(true, 'skipped-auth: tests/.auth/user.json is unavailable');
    }

    const context = await browser.newContext({ storageState: authFile, baseURL });
    const page = await context.newPage();
    const authProbe = await page.goto('/dashboard/cat', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    const authProbeLoading = await waitForPageCompletion(page);
    const authProbePath = new URL(page.url()).pathname;
    const authUserMenuVisible = await page
      .getByRole('button', { name: 'User menu' })
      .isVisible()
      .catch(() => false);
    const authCatHeadingVisible = await page
      .getByRole('heading', { level: 1, name: 'Cat' })
      .isVisible()
      .catch(() => false);
    const authProbeValid =
      authProbePath === '/dashboard/cat' &&
      (authProbe?.status() ?? 500) < 400 &&
      authProbeLoading === 0 &&
      authUserMenuVisible &&
      authCatHeadingVisible;
    if (!authProbeValid) {
      writeAuthStatus(
        evidenceDir,
        'skipped-auth',
        'saved storage state is absent or no longer valid'
      );
      if (STRICT_RELEASE) {
        const status = authProbe?.status() ?? 500;
        const finalPath = new URL(page.url()).pathname;
        const body = await page
          .locator('body')
          .innerText()
          .catch(() => '');
        await context.close();
        throw new Error(
          `strict-release: /dashboard/cat semantic auth probe failed (${status}, ${finalPath}, loading=${authProbeLoading}, userMenu=${authUserMenuVisible}, catHeading=${authCatHeadingVisible}): ${body.slice(0, 160)}`
        );
      }
      await context.close();
      test.skip(true, 'skipped-auth: saved storage state is absent or no longer valid');
    }

    const routes = discoverAppRoutes().filter(route => route.access === 'authentication-required');
    const results: RouteAuditResult[] = [];
    fs.mkdirSync(evidenceDir, { recursive: true });
    writeAuthStatus(evidenceDir, 'available');
    const runtimeFixtures = await deriveRuntimeFixtures(page, 'authenticated');

    for (const route of routes) {
      const fixture =
        route.kind === 'dynamic' ? resolveDynamicFixture(route.pattern, runtimeFixtures) : null;
      if (route.kind === 'dynamic' && !fixture) {
        results.push({
          routePattern: route.pattern,
          requestedPath: null,
          source: 'app-page',
          sourceFile: route.sourceFile,
          routeSurface: route.surface,
          routeAccess: route.access,
          authMode: 'authenticated',
          outcome: 'fixture-required',
          finalUrl: null,
          finalStatus: null,
          redirectChain: [],
          issues: ['unresolved-dynamic-fixture'],
          pageErrors: [],
          consoleErrors: [],
        });
        continue;
      }
      const result = await auditRoute(
        page,
        route,
        fixture?.path ?? route.pattern,
        'app-page',
        'authenticated',
        evidenceDir
      );
      if (result.outcome === 'auth-redirect') {
        result.outcome = 'failed';
        result.issues.push('authenticated-route-returned-to-auth');
      } else if (result.finalUrl) {
        const final = new URL(result.finalUrl);
        if (final.origin !== new URL(baseURL!).origin) {
          result.outcome = 'failed';
          result.issues.push('authenticated-route-left-app-origin');
        }
      }
      results.push(result);
    }

    const summary = results.reduce<Record<string, number>>((counts, result) => {
      counts[result.outcome] = (counts[result.outcome] || 0) + 1;
      for (const issue of result.issues) {
        counts[`issue:${issue}`] = (counts[`issue:${issue}`] || 0) + 1;
      }
      return counts;
    }, {});
    const internalLinkChecks = await verifyInternalLinks(page, results);
    const externalLinks = [
      ...new Set(results.flatMap(result => result.links?.external ?? [])),
    ].sort();
    const actionLinks = [...new Set(results.flatMap(result => result.links?.actions ?? []))].sort();
    fs.writeFileSync(
      path.join(evidenceDir, 'route-results.json'),
      `${JSON.stringify(
        {
          contract: ROUTE_AUDIT_CONTRACT,
          project: testInfo.project.name,
          strictRelease: STRICT_RELEASE,
          authMode: 'authenticated',
          summary,
          linkSummary: {
            internalChecked: internalLinkChecks.length,
            internalFailed: internalLinkChecks.filter(link => link.outcome === 'failed').length,
            externalReported: externalLinks.length,
            actionReported: actionLinks.length,
          },
          internalLinkChecks,
          externalLinks,
          actionLinks,
          results,
        },
        null,
        2
      )}\n`
    );
    await context.close();

    const failures = results.filter(result => result.outcome === 'failed');
    const linkFailures = internalLinkChecks.filter(link => link.outcome === 'failed');
    const unresolvedFixtures = STRICT_RELEASE
      ? results.filter(result => result.outcome === 'fixture-required')
      : [];
    expect(
      { routeFailures: failures, linkFailures, unresolvedFixtures },
      [
        ...failures.map(failure => `${failure.requestedPath}: ${failure.issues.join(', ')}`),
        ...linkFailures.map(failure => `${failure.path}: ${failure.issues.join(', ')}`),
        ...unresolvedFixtures.map(failure => `${failure.routePattern}: fixture-required`),
      ].join('\n')
    ).toEqual({ routeFailures: [], linkFailures: [], unresolvedFixtures: [] });
  });
});
