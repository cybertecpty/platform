import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

// Lighthouse gate, run by the `lighthouse` target. Reuses the e2e config's
// baseURL / webServer (the production build via `astro preview`, or BASE_URL for a
// deployed site) but points at its own spec directory. One worker, run serially, so
// concurrent Lighthouse runs don't compete for CPU and skew the timing metrics.
export default defineConfig({
  ...baseConfig,
  testDir: './lighthouse',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000
});
