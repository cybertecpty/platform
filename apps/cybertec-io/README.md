# cybertec-io

The CyberTec marketing homepage ([cybertec.io](https://cybertec.io)) — a single-page,
static **Astro** site styled with **Tailwind CSS v4**.

See [ADR 0012](../../docs/adr/0012-astro-content-sites.md) for why Astro is allowed for
static content sites and how it fits into the Nx workspace.

## Local commands

Run through Nx from the workspace root:

```bash
pnpm nx serve cybertec-io          # start the Astro dev server
pnpm nx build cybertec-io          # static production build → dist/apps/cybertec-io
pnpm nx preview cybertec-io        # preview the production build
pnpm nx lint cybertec-io           # eslint (incl. @nx/dependency-checks)
pnpm nx typecheck cybertec-io      # astro check
pnpm nx test cybertec-io           # vitest assertions over the built output (builds first)
pnpm nx e2e cybertec-io-e2e        # playwright header-menu smoke (builds first)
```

`test` and `e2e` both depend on `build`, so they assert over and drive the real static
output. The e2e suite lives in the nested [`cybertec-io-e2e`](e2e) project
and needs the Playwright browser once locally: `pnpm exec playwright install chromium`.

To regenerate the brand raster assets (OG image and `favicon.ico`) after a brand-asset
change:

```bash
node apps/cybertec-io/scripts/generate-brand-rasters.mjs
```

## Deploy

Deploys to **Azure Static Web Apps** on push to `main`, through the shared affected-deploy
pipeline (`.github/workflows/deploy-affected.yml`): the `deploy` target runs the SWA CLI
against the built `dist/apps/cybertec-io`, authenticated by the `AZURE_STATIC_WEB_APPS_API_TOKEN`
secret of the `cybertec-io` GitHub Environment. The deploy is gated on `nx test cybertec-io`,
and a post-deploy smoke (`cybertec-io-e2e:smoke`) runs against the `metadata.baseUrl`
in `project.json`. To redeploy manually, use the workflow's `workflow_dispatch` from `main`.

## Structure

- `src/pages/` — routes (the homepage is `index.astro`).
- `src/layouts/` — the base document shell (`<head>`, fonts and their preloads, SEO and
  social meta, JSON-LD, favicons); each section owns its own `.site-container`.
- `src/components/` — page section components (`Hero.astro`, `Services.astro`, …).
- `src/styles/global.css` — Tailwind v4 entry: design tokens as CSS custom properties,
  `@theme` blocks mirroring them as utilities, and `@utility` primitives.
- `src/assets/` — build-processed assets (the portrait `daniel.jpg`, optimized and
  responsive via `astro:assets` `<Image>`).
- `public/` — assets served verbatim by stable URL:
  - `favicon.svg` + `favicon.ico` (multi-resolution fallback) and `og-image.png`
    (1200×630 social card).
  - `brand/` — the CT mark (copper/white/ink) and the primary-light wordmark lockup.
  - `fonts/` — the OFL license notices for the self-hosted `@fontsource` brand fonts
    (the font files themselves are bundled into `dist/_astro` at build).
  - `robots.txt` and `sitemap.xml`.
  - `staticwebapp.config.json` — Azure Static Web Apps headers.
- `tests/` — Vitest assertions over the built static output (`build-output.spec.ts`).
- `scripts/` — build-time tooling (`generate-brand-rasters.mjs`).
- `docs/` — the product requirements document and the vendored design handoff; see the
  banner in each for what supersedes them.
- `astro.config.mjs` — Astro config (Tailwind via `@tailwindcss/vite`); build output is
  redirected to the root `dist/`.
- `vitest.config.mts` — the unit test runner. Playwright config lives in `e2e/` (the `cybertec-io-e2e` project).
- `eslint.config.mjs` — the project's lint config.

## Conventions

- Styling is **Tailwind utilities** drawing on the design tokens; hand-written CSS is
  reserved for art-directed primitives that utilities can't express (blueprint grid,
  hairlines). No inline styles. For token colors at partial alpha, use the `--x-rgb`
  channel token (`rgb(var(--x-rgb)/<alpha>)`) rather than a hardcoded hex.
- Multi-column layouts use `auto-fit` + `minmax(...)` arbitrary-value grids so they
  collapse to one column on phones without media queries — never fixed column counts.
- Copy lives in each component's frontmatter arrays and mirrors
  [`docs/cybertec-website-prd.md`](docs/cybertec-website-prd.md) §7; update the PRD when
  the copy changes.
