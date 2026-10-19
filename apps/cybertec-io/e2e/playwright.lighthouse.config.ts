import { defineConfig } from '@playwright/test';

import { createConfig } from './playwright.config';

// Lighthouse gate, run by the `lighthouse` target. Reuses the e2e config's
// baseURL / webServer (the production build via `astro preview`, or BASE_URL for a
// deployed site) but points at its own spec directory and its own preview port, so it can
// run alongside the `e2e` target. One worker, run serially, so concurrent Lighthouse runs
// don't compete for CPU and skew the timing metrics.
export default defineConfig({
  ...createConfig('lighthouse'),
  testDir: './lighthouse',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000
});
