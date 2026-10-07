# `ts-lib` generator

Creates a TypeScript library under `libs/<domain>[/<subdomain>...]/[<group>/]<type>`, wrapping
`@nx/js:library` with the workspace's naming, directory, and tag conventions (ADR 0009).

## What it does

- Restricted to `--type` values that are genuinely framework-agnostic (`models`, `testing`,
  `types`, `utils`) plus `infra` — backend-only but not Nest-specific, so it doesn't belong behind
  a future Nest-plugin either. `core`/`feature`/`ui`/`data-access` are Angular-only
  (`@nx/angular:library`); `api`/`services` are Nest-only (`@nx/nest:library`).
- `--scope` is required for `models`/`testing`/`types`/`utils` (all four are scope-polymorphic,
  ADR 0009). For `infra` it's optional — that type is always `scope:backend`, applied
  automatically whether or not `--scope` is given. An explicit `--scope=backend` for `infra` is
  accepted (it agrees); any other value is rejected, not silently overridden.
- Derives the project's `name`, `directory`, and `scope:`/`type:`/`domain:` tags from
  `--domain`/`--group`/`--name` via the shared `@cybertecpty/nx-utils` helpers
  (`projectNameFromOpts`, `projectDirFromOpts`, `createProjectTags`) rather than taking a raw
  `--directory`.
- Forwards every other option to `@nx/js:library` unchanged, with workspace defaults applied
  where the native generator's own default doesn't match this workspace's conventions
  (`unitTestRunner: jest`, `linter: eslint`, `testEnvironment: node`, `strict: true`).
- Forces a `type:testing` library to `bundler: none` even if a buildable bundler is requested —
  a production library importing a buildable testing-helpers lib would otherwise pull it in as a
  real buildable dependency.
- Adds `jest` to a `type:testing` library's `tsconfig.lib.json` `compilerOptions.types` — its own
  source (mocks, builders, fixtures) commonly uses Jest globals outside `*.spec.ts`.
- Re-sorts `tsconfig.base.json`'s `paths` map alphabetically after delegating.
- Adds the `typecheck` target stub (issue #48) unless `--unitTestRunner=none`.
- Formats generated files unless `--skipFormat` is passed.

## Usage

```bash
pnpm nx g @cybertecpty/js-plugin:ts-lib <type> --domain=<domain> [options]
```

## Options

| Option               | Type    | Required                     | Default  | Notes                                                                                                              |
| -------------------- | ------- | ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `type`               | string  | yes                          | —        | Positional 0. `infra` \| `models` \| `testing` \| `types` \| `utils`.                                              |
| `domain`             | string  | yes                          | —        | Product domain, optionally with `/`-separated subdomains (e.g. `billing/checkout`).                                |
| `scope`              | string  | yes, except for `type=infra` | —        | `backend` \| `frontend` \| `shared`. Optional for `infra` (always `backend`); any value but `backend` is rejected. |
| `group`              | string  | no                           | —        | Distinguishes this library from siblings of the same type within its domain.                                       |
| `name`               | string  | no                           | derived  | Literal project-name override. Does not change where the project lives.                                            |
| `bundler`            | string  | no                           | `none`   | `swc` \| `tsc` \| `rollup` \| `vite` \| `esbuild` \| `none`. Forced to `none` for `testing`.                       |
| `linter`             | string  | no                           | `eslint` | `eslint` \| `none`.                                                                                                |
| `unitTestRunner`     | string  | no                           | `jest`   | `jest` \| `none` (ADR 0007 — Jest only).                                                                           |
| `tags`               | string  | no                           | —        | Freeform tags appended after the derived `scope:`/`type:`/`domain:` tags.                                          |
| `publishable`        | boolean | no                           | `false`  |                                                                                                                    |
| `importPath`         | string  | no                           | —        | Required for a publishable library.                                                                                |
| `useProjectJson`     | boolean | no                           | —        |                                                                                                                    |
| `enableTypedLinting` | boolean | no                           | `false`  | ADR 0006 — off by default for lint performance.                                                                    |
| `skipTsConfig`       | boolean | no                           | `false`  |                                                                                                                    |
| `skipPackageJson`    | boolean | no                           | `false`  |                                                                                                                    |
| `skipTypeCheck`      | boolean | no                           | `false`  |                                                                                                                    |
| `includeBabelRc`     | boolean | no                           | —        |                                                                                                                    |
| `testEnvironment`    | string  | no                           | `node`   | `jsdom` \| `node`.                                                                                                 |
| `strict`             | boolean | no                           | `true`   |                                                                                                                    |
| `minimal`            | boolean | no                           | `false`  | No `README.md` generated for the library itself.                                                                   |
| `skipFormat`         | boolean | no                           | `false`  |                                                                                                                    |

## Examples

```bash
# libs/billing/orchestration/utils, tagged scope:backend
pnpm nx g @cybertecpty/js-plugin:ts-lib utils --domain=billing --scope=backend --group=orchestration

# libs/billing/checkout/models, tagged domain:billing-checkout, scope:shared
pnpm nx g @cybertecpty/js-plugin:ts-lib models --domain=billing/checkout --scope=shared

# libs/billing/infra, tagged scope:backend automatically — no --scope needed
pnpm nx g @cybertecpty/js-plugin:ts-lib infra --domain=billing
```
