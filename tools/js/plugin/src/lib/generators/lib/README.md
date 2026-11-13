# `ts-lib` generator

Creates a TypeScript library under `libs/<domain>[/<subdomain>...]/[<group>/]<type>`, or
`tools/[<group>/]<type>` for `--platform=tools`, wrapping `@nx/js:library` with the workspace's naming,
directory, and tag conventions (ADR 0009).

## What it does

- Restricted to `--type` values that are genuinely framework-agnostic (`testing`, `types`,
  `utils`). `core`/`feature`/`ui`/`data-access` are Angular-only (`@nx/angular:library`).
- Rejects the backend types `api`, `services` and `infra` with an error: the backend is .NET, and
  its libraries are created with `dotnet new`, not this generator (ADR 0017).
- `--platform` is required (all three types are platform-polymorphic, ADR 0009). `--platform=tools` places
  the project under `tools/[<group>/]<type>` (ADR 0009's `tools/` grammar).
- `--domain` is required for every platform except `tools`. A `tools/` project is domain-exempt — it
  gets no `domain:` tag — so `--domain` with `--platform=tools` is rejected, not silently dropped.
- Derives the project's `name`, `directory`, and `platform:`/`type:`/`domain:` tags from
  `--domain`/`--group`/`--name` via the shared `@cybertecpty/nx-utils` helpers
  (`projectNameFromOpts`, `projectDirFromOpts`, `projectTagsFromOptions`) rather than taking a raw
  `--directory`.
- Forwards every other option to `@nx/js:library` unchanged, with workspace defaults applied
  where the native generator's own default doesn't match this workspace's conventions
  (`unitTestRunner: vitest`, `linter: eslint`, `testEnvironment: node`, `strict: true`).
- Forces a `type:testing` library to `bundler: none` even if a buildable bundler is requested —
  a production library importing a buildable testing-helpers lib would otherwise pull it in as a
  real buildable dependency.
- Replaces the Vitest scaffold `@nx/js:library` writes with the ADR 0018 layout: a
  `vitest.config.mts` that extends the root `vitest.base.mts`, no `jest.config.*`, a Vitest
  `tsconfig.spec.json` (`configureVitestProject` in `@cybertecpty/nx-utils`). `--unitTestRunner=jest` is rejected with a pointer to ADR 0018.
- Adds `vitest/globals` to a `type:testing` library's `tsconfig.lib.json` `compilerOptions.types` —
  its own source (mocks, builders, fixtures) commonly uses Vitest globals outside `*.spec.ts`.
- Removes `node` from a `platform:shared` library's `tsconfig.lib.json` `compilerOptions.types`,
  so a Node global in its source fails `typecheck` (ADR 0004, issue #164). `platform:shared` also
  rejects `--unitTestRunner=none`, which would leave the library with no `typecheck` target.
- Re-sorts `tsconfig.base.json`'s `paths` map alphabetically after delegating.
- Adds the `typecheck` target stub (issue #48) unless `--unitTestRunner=none`.
- Formats generated files unless `--skipFormat` is passed.

## Usage

```bash
pnpm nx g @cybertecpty/js-plugin:ts-lib <type> --domain=<domain> [options]
```

## Options

| Option               | Type    | Required                | Default  | Notes                                                                                                  |
| -------------------- | ------- | ----------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `type`               | string  | yes                     | —        | Positional 0. `testing` \| `types` \| `utils`. `api` \| `services` \| `infra` are rejected (ADR 0017). |
| `domain`             | string  | yes, except for `tools` | —        | Product domain, optionally with `/`-separated subdomains (e.g. `billing/checkout`).                    |
| `platform`           | string  | yes                     | —        | `backend` \| `frontend` \| `shared` \| `tools`.                                                        |
| `group`              | string  | no                      | —        | Distinguishes this library from siblings of the same type within its domain.                           |
| `name`               | string  | no                      | derived  | Literal project-name override. Does not change where the project lives.                                |
| `bundler`            | string  | no                      | `none`   | `swc` \| `tsc` \| `rollup` \| `vite` \| `esbuild` \| `none`. Forced to `none` for `testing`.           |
| `linter`             | string  | no                      | `eslint` | `eslint` \| `none`.                                                                                    |
| `unitTestRunner`     | string  | no                      | `vitest` | `vitest` \| `none` (ADR 0018 — Vitest only).                                                           |
| `tags`               | string  | no                      | —        | Freeform tags appended after the derived `platform:`/`type:`/`domain:` tags.                           |
| `publishable`        | boolean | no                      | `false`  |                                                                                                        |
| `importPath`         | string  | no                      | —        | Required for a publishable library.                                                                    |
| `useProjectJson`     | boolean | no                      | —        |                                                                                                        |
| `enableTypedLinting` | boolean | no                      | `false`  | ADR 0006 — off by default for lint performance.                                                        |
| `skipTsConfig`       | boolean | no                      | `false`  |                                                                                                        |
| `skipPackageJson`    | boolean | no                      | `false`  |                                                                                                        |
| `skipTypeCheck`      | boolean | no                      | `false`  |                                                                                                        |
| `includeBabelRc`     | boolean | no                      | —        |                                                                                                        |
| `testEnvironment`    | string  | no                      | `node`   | `jsdom` \| `node`.                                                                                     |
| `strict`             | boolean | no                      | `true`   |                                                                                                        |
| `minimal`            | boolean | no                      | `false`  | No `README.md` generated for the library itself.                                                       |
| `skipFormat`         | boolean | no                      | `false`  |                                                                                                        |

## Examples

```bash
# libs/billing/orchestration/utils, tagged platform:backend
pnpm nx g @cybertecpty/js-plugin:ts-lib utils --domain=billing --platform=backend --group=orchestration

# libs/billing/checkout/types, tagged domain:billing-checkout, platform:shared
pnpm nx g @cybertecpty/js-plugin:ts-lib types --domain=billing/checkout --platform=shared

# tools/nx/testing, named nx-testing, tagged platform:tools,type:testing — no --domain
pnpm nx g @cybertecpty/js-plugin:ts-lib testing --platform=tools --group=nx
```
