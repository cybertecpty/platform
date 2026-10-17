import { chromium, expect as playwrightExpect, test as playwrightTest } from '@playwright/test';
import lighthouse from 'lighthouse';

import {
  DEFAULT_LIGHTHOUSE_THRESHOLDS,
  defineLighthouseTests,
  findFailures,
  mergeThresholds,
  type LighthouseMetrics
} from './playwright-lighthouse.utils';

jest.mock('@playwright/test', () => ({
  chromium: { launch: jest.fn() },
  expect: jest.fn(),
  test: jest.fn()
}));
// Lighthouse is ESM-only; ts-jest turns the dynamic imports into `require`, so virtual mocks
// stand in for both entry points.
jest.mock('lighthouse', () => ({ __esModule: true, default: jest.fn() }), { virtual: true });
jest.mock(
  'lighthouse/core/config/desktop-config.js',
  () => ({ __esModule: true, default: { extends: 'lighthouse:default', settings: {} } }),
  { virtual: true }
);

type TestBody = (fixtures: { baseURL?: string }) => Promise<void>;

const BASE_URL = 'http://localhost:4321';
const PASSING_METRICS: LighthouseMetrics = {
  scores: { performance: 1, accessibility: 1, 'best-practices': 1, seo: 1 },
  lcpMs: 1000,
  cls: 0
};

const mockTest = jest.mocked(playwrightTest);
const mockExpect = jest.mocked(playwrightExpect);
const mockLaunch = jest.mocked(chromium.launch);
const mockLighthouse = jest.mocked(lighthouse);
const mockToEqual = jest.fn();
const mockClose = jest.fn();

/** A Lighthouse result whose report holds `metrics`. */
const createLighthouseResultFixture = ({ scores, lcpMs, cls }: LighthouseMetrics): unknown => ({
  lhr: {
    categories: Object.fromEntries(Object.entries(scores).map(([id, score]) => [id, { score }])),
    audits: {
      'largest-contentful-paint': { numericValue: lcpMs },
      'cumulative-layout-shift': { numericValue: cls }
    }
  }
});

const registeredTitles = (): string[] => mockTest.mock.calls.map(([title]) => title);

/** Run the body of the registered test at `index`. */
const runRegisteredTest = (index: number, fixtures = { baseURL: BASE_URL }): Promise<void> =>
  (mockTest.mock.calls[index]?.[1] as unknown as TestBody)(fixtures);

beforeEach(() => {
  jest.clearAllMocks();
  mockExpect.mockReturnValue({ toEqual: mockToEqual } as never);
  mockLaunch.mockResolvedValue({ close: mockClose } as never);
  mockLighthouse.mockResolvedValue(createLighthouseResultFixture(PASSING_METRICS) as never);
});

describe('defineLighthouseTests', () => {
  it('registers one test per path and preset, naming the route', () => {
    defineLighthouseTests({ paths: ['/', '/about'] });

    expect(registeredTitles()).toEqual([
      '/ meets the Lighthouse thresholds on mobile',
      '/ meets the Lighthouse thresholds on desktop',
      '/about meets the Lighthouse thresholds on mobile',
      '/about meets the Lighthouse thresholds on desktop'
    ]);
  });

  it('lets a path narrow the app-wide presets', () => {
    defineLighthouseTests({
      paths: ['/', { path: '/about', presets: ['desktop'] }],
      presets: ['mobile']
    });

    expect(registeredTitles()).toEqual([
      '/ meets the Lighthouse thresholds on mobile',
      '/about meets the Lighthouse thresholds on desktop'
    ]);
  });

  it('audits the route against baseURL with the default mobile profile', async () => {
    defineLighthouseTests({ paths: ['/about'], presets: ['mobile'] });

    await runRegisteredTest(0);

    expect(mockLighthouse).toHaveBeenCalledWith(
      `${BASE_URL}/about`,
      expect.objectContaining({
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        blockedUrlPatterns: ['*cloudflareinsights.com*']
      }),
      undefined
    );
    expect(mockToEqual).toHaveBeenCalledWith([]);
    expect(mockClose).toHaveBeenCalled();
  });

  it('gives Lighthouse a DevTools port on the launched Chromium', async () => {
    defineLighthouseTests({ paths: ['/'], presets: ['mobile'] });

    await runRegisteredTest(0);

    const [, flags] = mockLighthouse.mock.calls[0] ?? [];
    expect(mockLaunch).toHaveBeenCalledWith({
      args: [`--remote-debugging-port=${String(flags?.port)}`]
    });
  });

  it('uses the desktop config for the desktop preset', async () => {
    defineLighthouseTests({ paths: ['/'], presets: ['desktop'] });

    await runRegisteredTest(0);

    expect(mockLighthouse).toHaveBeenCalledWith(
      `${BASE_URL}/`,
      expect.anything(),
      expect.objectContaining({ extends: 'lighthouse:default' })
    );
  });

  it('checks the metrics against the app and path overrides', async () => {
    mockLighthouse.mockResolvedValue(
      createLighthouseResultFixture({
        ...PASSING_METRICS,
        scores: { ...PASSING_METRICS.scores, performance: 0.9 },
        lcpMs: 2500
      }) as never
    );
    defineLighthouseTests({
      paths: [{ path: '/', thresholds: { maxLcpMs: 3000 } }],
      presets: ['mobile'],
      thresholds: { minScores: { performance: 0.85 } }
    });

    await runRegisteredTest(0);

    expect(mockToEqual).toHaveBeenCalledWith([]);
  });

  it('reports every missed threshold with the raw numbers', async () => {
    const metrics = { ...PASSING_METRICS, lcpMs: 2500, cls: 0.1 };
    mockLighthouse.mockResolvedValue(createLighthouseResultFixture(metrics) as never);
    defineLighthouseTests({ paths: ['/'], presets: ['mobile'] });

    await runRegisteredTest(0);

    expect(mockExpect).toHaveBeenCalledWith(
      ['LCP 2500ms >= 2000ms', 'CLS 0.100 >= 0.05'],
      `/ mobile: ${JSON.stringify(metrics)}`
    );
  });

  it('fails a missing category or audit instead of passing it', async () => {
    mockLighthouse.mockResolvedValue({ lhr: { categories: {}, audits: {} } } as never);
    defineLighthouseTests({ paths: ['/'], presets: ['mobile'] });

    await runRegisteredTest(0);

    expect(mockExpect.mock.calls[0]?.[0]).toEqual([
      'performance 0 < 95',
      'accessibility 0 < 95',
      'best-practices 0 < 95',
      'seo 0 < 95',
      'LCP Infinityms >= 2000ms',
      'CLS Infinity >= 0.05'
    ]);
  });

  it('throws when Playwright has no baseURL', async () => {
    defineLighthouseTests({ paths: ['/'], presets: ['mobile'] });

    await expect(runRegisteredTest(0, { baseURL: undefined as never })).rejects.toThrow(
      'Lighthouse tests need Playwright `use.baseURL` set'
    );
  });

  it('throws when Lighthouse returns no result, and still closes the browser', async () => {
    mockLighthouse.mockResolvedValue(undefined);
    defineLighthouseTests({ paths: ['/'], presets: ['mobile'] });

    await expect(runRegisteredTest(0)).rejects.toThrow('Lighthouse returned no result');
    expect(mockClose).toHaveBeenCalled();
  });

  it('throws with the cause when the Lighthouse run errored', async () => {
    mockLighthouse.mockResolvedValue({
      lhr: { runtimeError: { code: 'NO_FCP', message: 'The page did not paint' } }
    } as never);
    defineLighthouseTests({ paths: ['/'], presets: ['desktop'] });

    await expect(runRegisteredTest(0)).rejects.toThrow(
      'Lighthouse desktop run errored: NO_FCP: The page did not paint'
    );
  });
});

describe('findFailures', () => {
  it('returns no failures for metrics within the thresholds', () => {
    expect(findFailures(PASSING_METRICS)).toEqual([]);
  });

  it('treats a value at the LCP or CLS limit as a failure', () => {
    expect(findFailures({ ...PASSING_METRICS, lcpMs: 2000, cls: 0.05 })).toEqual([
      'LCP 2000ms >= 2000ms',
      'CLS 0.050 >= 0.05'
    ]);
  });

  it('checks each category against its own minimum', () => {
    const thresholds = mergeThresholds(DEFAULT_LIGHTHOUSE_THRESHOLDS, {
      minScores: { seo: 0.99 }
    });

    expect(
      findFailures(
        { ...PASSING_METRICS, scores: { ...PASSING_METRICS.scores, seo: 0.97 } },
        thresholds
      )
    ).toEqual(['seo 97 < 99']);
  });
});

describe('mergeThresholds', () => {
  it('changes only the given fields', () => {
    expect(
      mergeThresholds(DEFAULT_LIGHTHOUSE_THRESHOLDS, {
        minScores: { performance: 0.9 },
        maxCls: 0.1
      })
    ).toEqual({
      minScores: { performance: 0.9, accessibility: 0.95, 'best-practices': 0.95, seo: 0.95 },
      maxLcpMs: 2000,
      maxCls: 0.1
    });
  });

  it('returns the base thresholds without overrides', () => {
    expect(mergeThresholds(DEFAULT_LIGHTHOUSE_THRESHOLDS)).toEqual(DEFAULT_LIGHTHOUSE_THRESHOLDS);
  });
});
