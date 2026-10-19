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

## One server port per checkout

`derivePort(workspaceRoot, { base, span })` maps a checkout's path to a stable port, so git
worktrees of the repo each serve their own build on their own port. Use it for the `webServer`
port in an `-e2e` config, and set `reuseExistingServer: false`: two paths can hash to the same
port, and reusing whatever answers there would test another worktree's server.

The `e2e` and `lighthouse` targets can run at the same time, so give each its own port.
`cybertec-io-e2e` derives the lighthouse port from `<root>#lighthouse` and lets `E2E_PORT` and
`LIGHTHOUSE_PORT` pin them to get out of a collision. It also passes `--ignore-lock` to
`astro preview`, which otherwise allows one preview per project root.

## Running unit tests

Run `nx test playwright-testing` to execute the unit tests via [Jest](https://jestjs.io).
