# playwright-testing

Shared Playwright helpers for web apps' `-e2e` projects (`type:testing`, ADR 0004). It holds
the axe and Lighthouse quality gates (ADR 0016) as spec factories: each `-e2e` project calls
them from its own spec instead of copying the gate code.

```ts
// apps/{app}/e2e/e2e/a11y.spec.ts
defineAxeTests({ paths: ['/', '/about'] });

// apps/{app}/e2e/lighthouse/lighthouse.spec.ts
defineLighthouseTests({ paths: ['/', { path: '/about', presets: ['desktop'] }] });
```

- **Call the factories at the top level of a Playwright spec file.** They call Playwright's
  `test()`, which only works while Playwright is collecting that file's tests.
- `paths` is required. Each path × viewport (axe) or path × preset (Lighthouse) is its own test.
- The defaults are the workspace bar: `WCAG_22_AA_TAGS`, `AXE_VIEWPORTS` and
  `DEFAULT_LIGHTHOUSE_THRESHOLDS`. Override thresholds per app or per path in the app's spec,
  with a comment saying why (ADR 0016).
- axe paths take an optional `setup(page)`, run before the scan, to check an interaction state.
- The app's `-e2e` project declares `"lighthouse": {}` (the target lives in `nx.json`
  `targetDefaults`) and a `playwright.lighthouse.config.ts` whose `webServer` serves its
  production build.

## Preview server config

`definePreviewConfig` returns the `baseURL`, `webServer` and `port` for an `-e2e` project's
Playwright config, so no app hand-rolls its preview server:

```ts
// apps/{app}/e2e/playwright.config.ts
const { baseURL, webServer } = definePreviewConfig({
  target: 'e2e', // 'lighthouse' in playwright.lighthouse.config.ts
  workspaceRoot: resolve(__dirname, '../../..'),
  previewCommand: port => `pnpm exec astro preview --root apps/{app} --port ${port}`
});
export default defineConfig({ use: { baseURL }, webServer /* ... */ });
```

- **The port is derived from the checkout path and the target** (`derivePort`, range
  4400-4899), so git worktrees each serve their own build and the `e2e` and `lighthouse` targets,
  which can run at the same time, never share a port.
- **`<TARGET>_PORT` pins it** (`E2E_PORT`, `LIGHTHOUSE_PORT`; non-alphanumerics in the target
  become `_`) to get out of a hash collision. A value that isn't a whole number from 1024 to
  65535 throws.
- **`reuseExistingServer` is always `false`.** Two paths can hash to the same port, and reusing
  whatever answers there would test another worktree's server. Playwright fails loudly instead.
- **`BASE_URL` targets a running site** (a deployed URL) and returns no `webServer`.
- **`previewCommand` is the app's**, because the static server differs per framework. Make it
  bind the given port, and any flag the server needs to run two previews of one app at once
  (Astro's `--ignore-lock`, for its one-preview-per-root lock).

Use `derivePort(key, { base, span })` directly only for something that isn't a preview server.

## Running unit tests

Run `nx test playwright-testing` to execute the unit tests via [Jest](https://jestjs.io).
