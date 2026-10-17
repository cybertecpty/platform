import { createServer } from 'node:net';

import { chromium, expect, test } from '@playwright/test';

// Lighthouse gate for a web app's production build (ADR 0016): >= 95 in all four categories,
// LCP < 2.0s, CLS < 0.05 (the workspace performance/accessibility bar). Each `-e2e` project
// calls `defineLighthouseTests` from its own spec, run by its `lighthouse` target: its own
// config and Nx target, because it is slower than the functional specs and its scores vary a
// little between runs on shared runners.

export const LIGHTHOUSE_CATEGORIES = [
  'performance',
  'accessibility',
  'best-practices',
  'seo'
] as const;
export type LighthouseCategory = (typeof LIGHTHOUSE_CATEGORIES)[number];

/** Lighthouse emulates a phone by default; `desktop` switches to its desktop profile. */
export const LIGHTHOUSE_PRESETS = ['mobile', 'desktop'] as const;
export type LighthousePreset = (typeof LIGHTHOUSE_PRESETS)[number];

export interface LighthouseThresholds {
  /** Lowest acceptable score per category. Lighthouse reports 0-1, so 0.95 is "95 out of 100". */
  minScores: Record<LighthouseCategory, number>;
  /** Largest Contentful Paint budget: how long until the biggest element is on screen. */
  maxLcpMs: number;
  /** Cumulative Layout Shift budget: how much the page jumps around while loading. */
  maxCls: number;
}

/**
 * A per-app or per-path change to the workspace thresholds. Only the given fields change.
 * Lowering one is a documented exception (ADR 0016), so say why next to it.
 */
export interface LighthouseThresholdOverrides {
  minScores?: Partial<Record<LighthouseCategory, number>>;
  maxLcpMs?: number;
  maxCls?: number;
}

export interface LighthousePathOptions {
  /** Route to audit, resolved against Playwright's `baseURL` (e.g. `/about`). */
  path: string;
  /** Presets for this path; defaults to the app-wide `presets`. */
  presets?: readonly LighthousePreset[];
  /** Applied on top of the app-wide `thresholds`. */
  thresholds?: LighthouseThresholdOverrides;
}

export interface DefineLighthouseTestsOptions {
  /** Routes to audit. Required, so each app says which routes it covers. */
  paths: readonly (string | LighthousePathOptions)[];
  /** Presets for every path; defaults to both. */
  presets?: readonly LighthousePreset[];
  /** Applied on top of `DEFAULT_LIGHTHOUSE_THRESHOLDS` for every path. */
  thresholds?: LighthouseThresholdOverrides;
}

export interface LighthouseMetrics {
  scores: Record<LighthouseCategory, number>;
  lcpMs: number;
  cls: number;
}

/** The workspace bar (ADR 0016). Lowering a number here needs an ADR amendment. */
export const DEFAULT_LIGHTHOUSE_THRESHOLDS: LighthouseThresholds = {
  minScores: { performance: 0.95, accessibility: 0.95, 'best-practices': 0.95, seo: 0.95 },
  maxLcpMs: 2000,
  maxCls: 0.05
};

/**
 * Third-party requests blocked during the audit so the gate never depends on an outside
 * service. The Cloudflare Web Analytics beacon (#91) made runs fail intermittently with no
 * scores at all, and it would also count CI audits as site visits.
 */
const BLOCKED_URL_PATTERNS = ['*cloudflareinsights.com*'] as const;

/**
 * Register one Lighthouse test per path × preset, so a failing report names the route.
 *
 * Call it at the top level of a Playwright spec file (the `-e2e` project's
 * `lighthouse/lighthouse.spec.ts`): it calls Playwright's `test()`, which only works while
 * Playwright is collecting that file's tests.
 */
export function defineLighthouseTests({
  paths,
  presets = LIGHTHOUSE_PRESETS,
  thresholds
}: DefineLighthouseTestsOptions): void {
  for (const entry of paths) {
    const pathOptions = typeof entry === 'string' ? { path: entry } : entry;
    const pathThresholds = mergeThresholds(
      mergeThresholds(DEFAULT_LIGHTHOUSE_THRESHOLDS, thresholds),
      pathOptions.thresholds
    );

    for (const preset of pathOptions.presets ?? presets) {
      test(`${pathOptions.path} meets the Lighthouse thresholds on ${preset}`, async ({
        baseURL
      }) => {
        const metrics = await auditPage(resolveUrl(pathOptions.path, baseURL), preset);

        // Assert on the full list of misses (not one metric at a time) so a failing run
        // reports everything that is wrong at once. The raw numbers go in the message too.
        expect(
          findFailures(metrics, pathThresholds),
          `${pathOptions.path} ${preset}: ${JSON.stringify(metrics)}`
        ).toEqual([]);
      });
    }
  }
}

/** Describe every threshold the metrics miss; an empty list means the page passes. */
export function findFailures(
  { scores, lcpMs, cls }: LighthouseMetrics,
  { minScores, maxLcpMs, maxCls }: LighthouseThresholds = DEFAULT_LIGHTHOUSE_THRESHOLDS
): string[] {
  const failures: string[] = [];

  for (const category of LIGHTHOUSE_CATEGORIES) {
    if (scores[category] < minScores[category]) {
      failures.push(
        `${category} ${Math.round(scores[category] * 100)} < ${Math.round(minScores[category] * 100)}`
      );
    }
  }
  if (lcpMs >= maxLcpMs) failures.push(`LCP ${Math.round(lcpMs)}ms >= ${maxLcpMs}ms`);
  if (cls >= maxCls) failures.push(`CLS ${cls.toFixed(3)} >= ${maxCls}`);

  return failures;
}

/** Apply `overrides` on top of `base`; only the given fields change. */
export function mergeThresholds(
  base: LighthouseThresholds,
  overrides: LighthouseThresholdOverrides = {}
): LighthouseThresholds {
  return {
    minScores: { ...base.minScores, ...overrides.minScores },
    maxLcpMs: overrides.maxLcpMs ?? base.maxLcpMs,
    maxCls: overrides.maxCls ?? base.maxCls
  };
}

/**
 * Audit `url` with Lighthouse and return the numbers the gate cares about.
 *
 * Lighthouse doesn't use Playwright's browser APIs. It connects to a Chrome instance over
 * the DevTools debugging port, so we launch Playwright's bundled Chromium with that port
 * open purely to give Lighthouse a browser to drive.
 */
async function auditPage(url: string, preset: LighthousePreset): Promise<LighthouseMetrics> {
  const port = await getFreePort();
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });

  try {
    // Lighthouse is ESM-only, so it is imported dynamically.
    const { default: lighthouse } = await import('lighthouse');
    // No config = Lighthouse's default mobile profile (simulated slow 4G + throttled CPU).
    const config =
      preset === 'desktop'
        ? (await import('lighthouse/core/config/desktop-config.js')).default
        : undefined;

    const result = await lighthouse(
      url,
      {
        port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: [...LIGHTHOUSE_CATEGORIES],
        blockedUrlPatterns: [...BLOCKED_URL_PATTERNS]
      },
      config
    );
    const report = result?.lhr;
    if (!report) throw new Error('Lighthouse returned no result');
    // A run that errored (page hung, no paint, …) reports null scores; say why instead of
    // letting it surface as an unexplained row of zeros.
    if (report.runtimeError) {
      throw new Error(
        `Lighthouse ${preset} run errored: ${report.runtimeError.code}: ${report.runtimeError.message}`
      );
    }

    // A missing category or audit counts as the worst possible value, so it fails the gate
    // instead of silently passing.
    const scores = Object.fromEntries(
      LIGHTHOUSE_CATEGORIES.map(category => [category, report.categories[category]?.score ?? 0])
    ) as Record<LighthouseCategory, number>;
    const lcpMs = report.audits['largest-contentful-paint']?.numericValue ?? Infinity;
    const cls = report.audits['cumulative-layout-shift']?.numericValue ?? Infinity;

    return { scores, lcpMs, cls };
  } finally {
    await browser.close();
  }
}

/**
 * Resolve `path` against Playwright's `baseURL`. Lighthouse drives its own browser, so it
 * needs an absolute URL, unlike `page.goto`.
 */
function resolveUrl(path: string, baseURL: string | undefined): string {
  if (!baseURL) throw new Error('Lighthouse tests need Playwright `use.baseURL` set');
  return new URL(path, baseURL).href;
}

/** Ask the OS for an unused TCP port, so parallel runs never fight over a fixed one. */
const getFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    // Port 0 means "pick any free port"; read it back, then release it for Chrome to use.
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
