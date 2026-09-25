# 12. Astro for static content sites

- Status: accepted
- Date: 2026-09-23
- Deciders: djmcgrath
- Implemented by (planned): the `apps/cybertec-io` migration; the ADR 0005 and ADR 0007
  amendments in this change

## Context and problem statement

ADR 0005 locked the application stack to Angular (frontend) and NestJS (backend), and
states that "adding a third application stack … requires a new ADR". This is that ADR.

The `cybertec.io` public site already exists as an Astro app from an archived version of
this repo. That version has no git history left, and it never used an Nx Astro plugin, so
there is nothing to preserve beyond the source files themselves. The question is whether
to bring the site in as Astro or rewrite it in Angular to stay inside ADR 0005.

A marketing or content site has a different profile from the product apps ADR 0005 was
written for: mostly static pages, little client state, and SEO and first-load performance
count for more than rich interactivity. Angular can serve it (SSR or prerendering), but that
means shipping a SPA framework to render mostly static HTML.

## Decision drivers

- The site already works in Astro. A rewrite costs effort and adds nothing for users.
- Content sites should ship close to zero JavaScript by default.
- Keep ADR 0005's intent: one frontend framework for product apps. The exception should be
  narrow enough that it doesn't become "pick any framework".
- Stay inside the workspace's existing guardrails: pnpm (ADR 0001), module-boundary tags
  (ADR 0004), typed linting (ADR 0006), the coverage gate (ADR 0007).

## Considered options

1. **Import the Astro app as-is, scoped to static content sites.**
2. **Rewrite the site in Angular** (SSG or prerendering via `@angular/ssr`).
3. **Keep the site outside the monorepo.**

## Decision outcome

Chosen option: **1 — Astro, scoped to static or mostly static content sites.**

- Option 2 keeps the stack uniform but spends a rewrite on a site that already works, and
  gets a heavier result for this kind of page.
- Option 3 loses shared tooling, shared libs (`type:models`, `type:utils`, `type:ui`
  tokens) and the CI and coverage gates, and it undoes "platform is the only product repo".

### Locked parameters

- **Scope: content sites only.** Marketing, docs and landing sites. An interactive product
  frontend is still Angular (ADR 0005). A second Astro app is fine under this ADR. Using
  Astro for a product app, or bringing in another framework, needs a new ADR.
- **No Nx Astro plugin.** There is no first-party `@nx/astro`, and the community
  `@nxtensions/astro` has historically trailed Nx majors. Astro apps are plain projects:
  a `project.json` defines `build`, `serve`, `preview` and `test` as `nx:run-commands`
  targets wrapping the Astro and Vitest CLIs, and carries the tags and `outputs`
  (`{workspaceRoot}/dist/{projectRoot}` for `build`). Target names follow Nx's own
  ecosystem convention — `serve` (not Astro's `dev` subcommand name) and `preview`,
  matching what `@nx/angular`, `@nx/vite`, and friends generate — so `nx serve <app>`
  and `nx preview <app>` work the same way across every app in the workspace regardless
  of framework. Only the underlying shell command (`astro dev`) uses Astro's own
  vocabulary.
- **Dependencies live in the root `package.json`,** under the single-version policy
  (ADR 0001, ADR 0003) that every other project follows. That includes `astro`, `sharp`,
  the `@fontsource` font packages and Tailwind. The app has no `package.json` of its own,
  and `pnpm-workspace.yaml` is unchanged (ADR 0005).
- **Styling: Tailwind CSS v4,** wired through `@tailwindcss/vite` in `astro.config.mjs`
  (Astro's current setup, as `astro add tailwind` does it). Not the deprecated
  `@astrojs/tailwind` integration, and not Tailwind v3.
  - The design tokens are CSS custom properties in `src/styles/global.css`, and they are
    exposed as utilities through v4's CSS-first `@theme` block in that same file. There
    is no `tailwind.config.*` file.
  - Hand-written CSS is for art-directed pieces that utilities can't express (the
    blueprint grid, hairlines). There are no inline styles.
  - The archived site was on v3. It moves to v4 during the import, using
    `@tailwindcss/upgrade`, with a visual check for classes v4 renamed.
- **Layout and naming follow ADR 0010:** flat `apps/<name>`, so `apps/cybertec-io`.
- **Tags (ADR 0004):** `scope:frontend`, `type:app`, `domain:shared`.
  - `scope:frontend` applies ADR 0003's browser-bundle rules (the `zod` / `lodash` bans) to
    anything the site ships to the client.
  - `domain:shared` is a placeholder until a product-domain ADR says otherwise. Nothing
    imports an app, so it does not widen any boundary.
- **UI islands:** if an interactive island needs a component framework, use one Astro
  officially integrates with. There is no official Angular integration, so interactive
  pieces should be plain Astro components or vanilla TS where possible. Adding a UI
  framework integration (`@astrojs/react` or similar) needs an amendment to this ADR.
- **TypeScript:** the app's `tsconfig.json` extends Astro's strict preset and pulls in the
  workspace `paths` from `tsconfig.base.json`, so shared libs resolve.
- **Linting:** add `eslint-plugin-astro` to the root flat config, scoped to `**/*.astro`,
  with typed linting (ADR 0006) where the Astro parser supports it.
- **Testing:** Vitest. See the ADR 0007 amendment of the same date.
- **Deployment is out of scope.** No hosting target is decided. The archived repo's deploy
  workflows and infra files are not carried over, and hosting gets its own issue or ADR.

## Consequences

### Positive

- The existing site moves in without a rewrite and picks up workspace CI, linting, the
  coverage gate and shared libs.
- Content pages ship static HTML with near-zero client JS.
- ADR 0005's "one product frontend framework" rule stays intact.

### Negative / risks

- A second frontend toolchain: Vite, Astro and Tailwind next to Angular's builder. There
  are two build pipelines to upgrade, and Astro and Tailwind upgrades don't go through
  `nx migrate`. They're manual `package.json` bumps.
- Tailwind is in the root `package.json` but only the Astro site uses it. If an Angular
  app adopts Tailwind later, it shares this major version.
- A second test runner in the tree (see the ADR 0007 amendment).
- No Nx plugin, so no generators or migrations for Astro. For now that's acceptable with one
  app. If more Astro sites appear, write a thin in-repo generator, as `ts-lib` wraps `@nx/js`.
- Angular `type:ui` libs can't be consumed by Astro pages. Only framework-agnostic libs
  (`models`, `utils`, `types`, CSS or design tokens) can be shared with the site.

## More information

- ADR 0005 (`application-frameworks`): the "third stack needs a new ADR" rule this
  satisfies. It has an amendment pointing here.
- ADR 0007 (`jest-test-runner`): the Vitest exception for Astro, in its 2026-09-23
  amendment.
- ADR 0004 (`nx-module-boundaries`) and ADR 0010 (`app-directory-layout`): tags and
  placement.
- ADR 0003 (`frontend-bundle-hygiene`): applies to the site through `scope:frontend`.
