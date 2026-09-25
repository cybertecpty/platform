import { defineConfig, devices } from '@playwright/test';

// Smoke e2e for the cybertec-io static marketing site (apps/cybertec-io), as its own
// type:e2e project (ADR 0010). Deliberately self-contained (no @nx/devkit imports) so it
// loads identically under the inferred Nx `e2e` target and a direct `playwright test`.
// The webServer serves the sibling app's production build via `astro preview` (default
// port 4321), so the test exercises the real shipped output, not the dev server. The
// project.json `e2e` target dependsOn cybertec-io:build, so the build output exists
// before this ever runs.
//
// `cwd` is the workspace root (not the app dir): `pnpm exec` resolves its "current
// project" from cwd, and only the root has a package.json (ADR 0012 — the app itself
// doesn't). `astro`'s own `--root` flag points it at the app instead.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4321';
const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'pnpm exec astro preview --root apps/cybertec-io',
    cwd: '../..',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000
  },
  // Chromium only — this is a responsive-behaviour smoke, not cross-browser QA.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
