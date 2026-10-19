import { definePreviewConfig } from '@cybertecpty/playwright-testing';
import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

// Smoke e2e for the cybertec-io static marketing site (apps/cybertec-io), as its own
// type:e2e project (ADR 0010). Deliberately self-contained (no @nx/devkit imports) so it
// loads identically under the inferred Nx `e2e` target and a direct `playwright test`.
// The webServer serves the parent app's production build via `astro preview`, so the test
// exercises the real shipped output, not the dev server. The project.json `e2e` target
// dependsOn cybertec-io:build, so the build output exists before this ever runs.
//
// `definePreviewConfig` owns the port (per checkout and target, pinned by `<TARGET>_PORT`),
// `reuseExistingServer: false` and `BASE_URL` (the post-deploy `smoke` target points it at the
// deployed URL, which skips the local webServer). Only the command is Astro's: `--ignore-lock`
// is needed because Astro keeps one `.astro/preview.json` lock per project root and refuses a
// second preview otherwise, and `e2e` and `lighthouse` can run at the same time. `--root`
// points astro at the app, since the webServer runs from the workspace root: `pnpm exec`
// resolves its "current project" from cwd, and only the root has a package.json (ADR 0012).
export function createConfig(target = 'e2e') {
  const { baseURL, webServer } = definePreviewConfig({
    target,
    workspaceRoot: resolve(__dirname, '../../..'),
    previewCommand: port =>
      `pnpm exec astro preview --root apps/cybertec-io --port ${port} --ignore-lock`
  });
  const isCI = !!process.env['CI'];

  return defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 1 : 0,
    reporter: 'list',
    use: {
      baseURL,
      trace: 'on-first-retry'
    },
    webServer,
    // Chromium only — this is a responsive-behaviour smoke, not cross-browser QA.
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
  });
}

export default createConfig();
