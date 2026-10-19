import { derivePort } from '@cybertecpty/playwright-testing';
import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

// Smoke e2e for the cybertec-io static marketing site (apps/cybertec-io), as its own
// type:e2e project (ADR 0010). Deliberately self-contained (no @nx/devkit imports) so it
// loads identically under the inferred Nx `e2e` target and a direct `playwright test`.
// The webServer serves the parent app's production build via `astro preview`, so the test
// exercises the real shipped output, not the dev server. The project.json `e2e` target
// dependsOn cybertec-io:build, so the build output exists before this ever runs.
//
// The preview port is derived from this checkout's path (4400-4899), so git worktrees of the
// repo each get their own port and never talk to another worktree's server. `E2E_PORT` pins
// it. `reuseExistingServer` is off: a server already answering on the port belongs to someone
// else (a port-hash collision, or a stale run), and silently testing it would pass or fail
// for the wrong tree. Playwright fails loudly instead.
//
// Setting BASE_URL targets an already-running site (the post-deploy `smoke` target points it
// at the deployed URL), so the local `astro preview` webServer is skipped entirely. Unset, the
// suite serves the local build as above.
const pinnedPort = process.env['E2E_PORT'];
const pinnedNumber = Number(pinnedPort);
if (
  pinnedPort !== undefined &&
  !(Number.isInteger(pinnedNumber) && pinnedNumber >= 1024 && pinnedNumber <= 65535)
) {
  throw new Error(`E2E_PORT must be a port number between 1024 and 65535, got "${pinnedPort}"`);
}
const previewPort =
  pinnedPort !== undefined
    ? pinnedNumber
    : derivePort(resolve(__dirname, '../../..'), { base: 4400, span: 500 });
const baseURL = process.env['BASE_URL'] || `http://localhost:${previewPort}`;
const isCI = !!process.env['CI'];
const targetsDeployedSite = !!process.env['BASE_URL'];

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
  webServer: targetsDeployedSite
    ? undefined
    : {
        command: `pnpm exec astro preview --root apps/cybertec-io --port ${previewPort}`,
        // The workspace root, not the app dir: `pnpm exec` resolves its "current project" from
        // cwd, and only the root has a package.json (ADR 0012 — the app itself doesn't).
        // `astro`'s own `--root` flag points it at the app instead.
        cwd: '../../..',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000
      },
  // Chromium only — this is a responsive-behaviour smoke, not cross-browser QA.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
