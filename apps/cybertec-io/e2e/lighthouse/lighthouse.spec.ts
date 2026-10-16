import { createServer } from 'node:net';

import { chromium, expect, test } from '@playwright/test';

// Lighthouse gate for a web app's production build: >= 95 in all four categories,
// LCP < 2.0s, CLS < 0.05 (the workspace performance/accessibility bar).
// Kept out of the `e2e` target (own config, own Nx target): it is slower than the
// functional specs and its scores vary a little between runs on shared runners.

// --- Thresholds ---------------------------------------------------------------------

/** Lowest acceptable category score. Lighthouse reports 0-1, so 0.95 is "95 out of 100". */
const MIN_SCORE = 0.95;
/** Largest Contentful Paint budget: how long until the biggest element is on screen. */
const MAX_LCP_MS = 2000;
/** Cumulative Layout Shift budget: how much the page jumps around while loading. */
const MAX_CLS = 0.05;

/**
 * Third-party requests blocked during the audit so the gate never depends on an outside
 * service. The Cloudflare Web Analytics beacon (#91) made runs fail intermittently with no
 * scores at all, and it would also count CI audits as site visits.
 */
const BLOCKED_URL_PATTERNS = ['*cloudflareinsights.com*'] as const;

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
type Category = (typeof CATEGORIES)[number];

/** Lighthouse emulates a phone by default; `desktop` switches to its desktop profile. */
const PRESETS = ['mobile', 'desktop'] as const;
type Preset = (typeof PRESETS)[number];

interface Metrics {
  scores: Record<Category, number>;
  lcpMs: number;
  cls: number;
}

// --- Helpers ------------------------------------------------------------------------

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

/**
 * Audit `url` with Lighthouse and return the numbers the gate cares about.
 *
 * Lighthouse doesn't use Playwright's browser APIs. It connects to a Chrome instance over
 * the DevTools debugging port, so we launch Playwright's bundled Chromium with that port
 * open purely to give Lighthouse a browser to drive.
 */
async function auditPage(url: string, preset: Preset): Promise<Metrics> {
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
        onlyCategories: [...CATEGORIES],
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
      CATEGORIES.map(category => [category, report.categories[category]?.score ?? 0])
    ) as Record<Category, number>;
    const lcpMs = report.audits['largest-contentful-paint']?.numericValue ?? Infinity;
    const cls = report.audits['cumulative-layout-shift']?.numericValue ?? Infinity;

    return { scores, lcpMs, cls };
  } finally {
    await browser.close();
  }
}

/** Describe every threshold the metrics miss; an empty list means the page passes. */
function findFailures({ scores, lcpMs, cls }: Metrics): string[] {
  const failures: string[] = [];

  for (const category of CATEGORIES) {
    if (scores[category] < MIN_SCORE) {
      failures.push(`${category} ${Math.round(scores[category] * 100)} < ${MIN_SCORE * 100}`);
    }
  }
  if (lcpMs >= MAX_LCP_MS) failures.push(`LCP ${Math.round(lcpMs)}ms >= ${MAX_LCP_MS}ms`);
  if (cls >= MAX_CLS) failures.push(`CLS ${cls.toFixed(3)} >= ${MAX_CLS}`);

  return failures;
}

// --- Tests --------------------------------------------------------------------------

for (const preset of PRESETS) {
  test(`meets the Lighthouse thresholds on ${preset}`, async ({ baseURL }) => {
    const metrics = await auditPage(baseURL as string, preset);

    // Assert on the full list of misses (not one metric at a time) so a failing run
    // reports everything that is wrong at once. The raw numbers go in the message too.
    expect(findFailures(metrics), `${preset}: ${JSON.stringify(metrics)}`).toEqual([]);
  });
}
