# 16. Playwright e2e with axe and Lighthouse quality gates

- Status: accepted (amended 2026-10-17: the gates are shared spec factories, #114;
  2026-10-20: CI runs without Nx Cloud, #188)
- Date: 2026-10-16
- Deciders: djmcgrath
- Implemented by: `apps/cybertec-io/e2e` (`e2e` and `lighthouse` targets,
  `e2e/a11y.spec.ts`, `lighthouse/lighthouse.spec.ts`), `.github/workflows/lint-and-test-affected.yml`;
  landed in #115 (issue #94)

## Context and problem statement

ADR 0007 picks the unit / integration test runner and leaves browser e2e out of scope. ADR 0010
only fixes where an e2e project lives and what it's called. Nothing records which e2e tool the
workspace uses or what quality bar a web app's production build has to meet.

#115 made that bar real for `cybertec-io`: an axe accessibility check inside the Playwright e2e
suite and a Lighthouse audit as its own Nx target, both run by the required `ci` check. Their
thresholds live only in spec files. Someone could relax a number, swap a tool, or skip the gate
on the next web app without knowing it was a deliberate choice.

## Decision drivers

- **Test the shipped output.** Gates run against the production build, not the dev server.
- **One browser toolchain.** e2e, accessibility and performance checks share one browser and
  one runner instead of each bringing its own.
- **Fail the PR, not a dashboard.** A regression must fail the required `ci` check; a report
  nobody reads doesn't count.
- **No outside services.** The gate must not depend on, or send data to, a third-party service
  (same reasoning as ADR 0007's rejection of Codecov).
- **Stable enough on shared CI runners.** Timing metrics vary between runs; the setup has to
  keep that noise from failing PRs at random.

## Considered options

**E2E runner**

1. **Playwright** (chosen).
2. **Cypress.** Also supported by Nx, but runs inside the page, has weaker multi-tab and
   multi-viewport support, and has no built-in way to hand Lighthouse a DevTools port.

**Accessibility check**

1. **axe-core via `@axe-core/playwright`, inside the e2e suite** (chosen).
2. **Lighthouse's accessibility category only.** It runs a subset of axe rules and reports a
   score, so a page can pass at 95 with real violations.
3. **pa11y.** A second browser runner alongside Playwright.

**Performance check**

1. **Lighthouse's Node API, driven from a Playwright spec** (chosen). Reuses Playwright's
   Chromium and its `webServer`.
2. **Lighthouse CI (`@lhci/cli`).** Its own Chrome launcher, config format and server for
   history. More to run and maintain for one page.
3. **PageSpeed Insights API.** Needs a public URL and an outside service, so it can't gate a PR
   before deploy.

## Decision outcome

Playwright for e2e; axe-core inside the Playwright e2e suite for accessibility; Lighthouse's
Node API from a separate Playwright config for performance. Every web app's e2e project
(`{app}-e2e`, ADR 0010) runs both gates against its production build. Making the gates reusable
across apps is #114.

### Locked parameters

**Playwright**

- E2E projects use `@playwright/test`, run through Nx targets (`nx e2e {app}-e2e`), never
  `playwright` directly.
- The `webServer` serves the app's **production build** (for `cybertec-io`, `astro preview`),
  and the `e2e` target `dependsOn` the app's `build`. Setting `BASE_URL` points the same suite at
  a deployed site instead (the post-deploy `smoke` target).
- Chromium only. These are responsive-behaviour and quality gates, not cross-browser QA. Adding
  browsers needs a reason recorded here.

**Accessibility (axe)**

- Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`: WCAG 2.2 level AA.
- Scanned at a desktop (1280×800) and a mobile (390×844) viewport.
- **Zero violations.** The assertion is `expect(violations).toEqual([])`.
- **Exceptions are documented, never silent.** An exception disables one named rule, for a
  named element where possible, with a comment that says why and links an issue. Lowering the
  WCAG level or dropping a tag set needs an amendment to this ADR.
- axe catches roughly a third of real accessibility problems. Passing it is a floor, not an
  audit.

**Performance (Lighthouse)**

- All four categories (performance, accessibility, best practices, SEO) **≥ 95**.
- **LCP < 2.0s** and **CLS < 0.05**.
- Audited on Lighthouse's default mobile profile (simulated slow 4G, throttled CPU) **and** its
  desktop profile. Both must pass.
- A missing category or metric, or a run that errors, **fails** the gate instead of passing.
- Third-party requests (analytics beacons) are blocked during the audit, so the gate never
  depends on an outside service and CI runs aren't counted as visits.
- Its own Playwright config and its own Nx target (`lighthouse`), separate from `e2e`: it is
  slower, and it runs with **one worker, serially**, so concurrent audits don't compete for CPU
  and skew the timings.
- Lowering a threshold needs an amendment to this ADR. A single app that can't meet one gets a
  documented per-app exception, not a lower workspace number.

**CI**

- `e2e` and `lighthouse` run in `lint-and-test-affected.yml` with the other targets: affected
  projects on a PR, every project on a push to `develop` / `main`. ~~Nx Cloud agents are kept up
  until both finish (`--stop-agents-after="e2e,lighthouse"`).~~ Superseded by the 2026-10-20
  amendment: there are no agents.

## Consequences

### Positive

- Accessibility and performance regressions fail the PR that introduces them.
- One browser toolchain: the Lighthouse audit reuses Playwright's Chromium and `webServer`.
- No external service or token, and no data leaves CI.
- The bar is written down, so changing it is a visible decision.

### Negative / risks

- **Lighthouse timings are noisy on shared runners.** Mobile LCP had little headroom when the
  gate landed (1.8s against 2.0s). Expect occasional flakes; fix the page or document an
  exception rather than retrying until green.
- **Slower CI.** Each web app adds a production build, a browser launch and two Lighthouse runs
  to the PRs that affect it.
- **axe is a floor.** Zero violations doesn't mean accessible; manual checks (keyboard, screen
  reader) are still needed for anything interactive.
- ~~**Only one app is gated so far.** The gate code lives in `apps/cybertec-io/e2e` until #114
  makes it reusable; a new web app has to copy it until then.~~ Resolved by the 2026-10-17
  amendment: the gates live in `@cybertecpty/playwright-testing`.

## More information

- ADR 0007 — unit / integration test runner; leaves e2e to this ADR.
- ADR 0010 — `{app}-e2e` project layout and naming.
- ADR 0012 — Astro content sites (`cybertec-io`).
- #94 / #115 — the gates' original issue and PR, with the first Lighthouse numbers.
- #114 — make the gates reusable across web apps.
- [`axe-core` rule tags](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#axe-core-tags).

## Amendment (2026-10-17): the gates are shared spec factories

- Status: accepted
- Deciders: djmcgrath
- Implemented by: `libs/shared/playwright/testing` (`@cybertecpty/playwright-testing`), the
  `lighthouse` entry in `nx.json` `targetDefaults`, the Playwright lint block for the lib in
  `eslint.config.mjs`; `cybertec-io-e2e` migrated as the first consumer (#114)

The gate code lived in `apps/cybertec-io/e2e`, so a second web app would have copied it and a
threshold change would have meant editing every app. Both specs also checked only one page.

### Decision

- **The gates live in `playwright-testing`** at `libs/shared/playwright/testing` (`type:testing`,
  `scope:frontend`, `domain:shared`), which exports spec factories rather than spec files:
  `defineLighthouseTests` (`playwright-lighthouse.utils.ts`) and `defineAxeTests`
  (`playwright-axe.utils.ts`). Each `-e2e` project calls them from its own one-line spec,
  `lighthouse/lighthouse.spec.ts` and `e2e/a11y.spec.ts`, and carries no copy of the gate code.
  The factories call Playwright's `test()`, so they only work at the top level of a spec file.
- **`paths` is required.** Each app lists the routes it covers. Each path × preset (Lighthouse)
  or path × viewport (axe) is its own test, so a failing report names the route.
- **The locked parameters above are the defaults:** `DEFAULT_LIGHTHOUSE_THRESHOLDS`,
  `WCAG_22_AA_TAGS` and `AXE_VIEWPORTS`. Thresholds can be overridden per app and per path, in the
  app's spec where review sees them. Lowering one is the documented per-app exception this ADR
  already requires, so it gets a comment saying why. Changing a default still needs an amendment.
- **Lighthouse `presets` can be set per path** (e.g. desktop only on a secondary page) to keep
  run time down. **axe takes an optional per-path `setup(page)`**, run after the page loads and
  before the scan, so interaction states (an open menu, a submitted empty form) get checked.
- **The `lighthouse` target is defined once** in `nx.json` `targetDefaults`, with
  `dependsOn: ["^build"]`, so an `-e2e` project declares `"lighthouse": {}`. The Playwright
  `timeout` is per test, so it already applies to each route and doesn't grow with more routes.
- **`playwright.lighthouse.config.ts` stays per project**, because the `webServer` command depends
  on the app type: `astro preview` for Astro, a static server for Angular. For an Angular app the
  static server has to fall back to `index.html`, so deep links resolve.
- **The lib's gate code gets the Playwright lint rules**, matched by folder
  (`libs/shared/playwright/**/*.ts`). Its own unit specs run under Jest and keep the Jest rules.

### Out of scope

Revisit each with the first app that needs it.

- **Pages behind a login.** Lighthouse drives its own fresh Chromium session, with none of
  Playwright's cookies or saved login state, so a protected route gets audited as the login
  redirect. Options: a pre-audit login hook that sets cookies over the DevTools port, or
  Lighthouse's `extraHeaders`. axe runs inside Playwright, so it can use `storageState`.
- **In-app route changes in single-page apps.** Lighthouse's navigation mode only measures a cold
  load of each URL. Measuring client-side route changes needs its timespan mode.
- **Dynamic routes** (`/items/:id`). The app supplies concrete URLs and the seed data behind them.

### Consequences

- A new web app gets both gates from two one-line specs, a short
  `playwright.lighthouse.config.ts` and `"lighthouse": {}`.
- A change to the lib re-runs `e2e` and `lighthouse` for every web app on the PR, since each
  `-e2e` project depends on it in the project graph.
- Lighthouse run time grows with the number of routes: about 30–60s per path and preset, run
  serially.

## Amendment (2026-10-20): CI runs without Nx Cloud

- Status: accepted
- Deciders: djmcgrath
- Implemented by: `.github/workflows/lint-and-test-affected.yml`,
  `.github/workflows/deploy-affected.yml` (#188)

The Nx Cloud organization was disabled for exceeding the free plan, and `nx record` failed the
required `ci` check on every PR. The usage does not reset until Nov 1. Options:

1. **Upgrade to the paid Team plan.** Rejected: the maintainer does not want to pay for Nx Cloud.
2. **Wait for the Nov 1 reset.** Rejected: the required check, and so every merge, is blocked for
   11 days.
3. **Run CI without Nx Cloud.** Chosen.

CI and the deploy workflow set `NX_NO_CLOUD=true`. `nx start-ci-run`, `nx record --` and
`nx fix-ci` are gone from `lint-and-test-affected.yml`. The CI section above no longer holds:
`e2e` and `lighthouse` run on the one runner with the other targets, and there are no agents to
keep up. The Nx Cloud remote cache and self-healing are gone too, which also affects the
mentions in ADR 0001 (distributed agents) and ADR 0006 (remote cache absorbing CI lint time).

`nxCloudId` stays in `nx.json`, so re-enabling Nx Cloud is a revert of the #188 changes to
`lint-and-test-affected.yml` and `deploy-affected.yml`, plus the docs notes listed above.
