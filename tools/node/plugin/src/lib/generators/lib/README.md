# `lib` generator

Creates a Node library under `libs/<domain>[/<subdomain>...]/[<group>/]infra`, wrapping
`@nx/node:library` with the workspace's naming, directory, and tag conventions (ADR 0009).

## What it does

- Restricted to `--type=infra` — the one backend-only, non-Nest `type:` value left after
  `js-plugin:lib` (`tools/js/plugin/src/lib/generators/lib`) covers the framework-agnostic set
  (`models`/`testing`/`types`/`utils`). `api`/`services` are Nest-specific and out of scope for this
  generator; a future Nest-plugin owning `@nx/nest:library` is the right home for those.
- Hardcodes `scope:backend` — unlike `js-plugin:lib`'s `--scope` input, `type:infra` isn't one of
  ADR 0004's three scope-polymorphic types, so there's nothing to ask.
- Derives the project's `name`, `directory`, and `scope:`/`type:`/`domain:` tags from
  `--domain`/`--group`/`--name` via the shared `@cybertecpty/nx-utils` helpers
  (`projectNameFromOpts`, `projectDirFromOpts`, `createProjectTags`) rather than taking a raw
  `--directory`.
- Forwards every other option to `@nx/node:library` unchanged, with workspace defaults applied
  where the native generator's own default doesn't match this workspace's conventions
  (`unitTestRunner: jest`, `linter: eslint`, `strict: true`).
- Re-sorts `tsconfig.base.json`'s `paths` map alphabetically after delegating.
- Adds the `typecheck` target stub (issue #48) unless `--unitTestRunner=none`.
- Formats generated files unless `--skipFormat` is passed.

## Usage

```bash
pnpm nx g @cybertecpty/node-plugin:lib infra --domain=<domain> [options]
```

## Options

| Option               | Type    | Required | Default  | Notes                                                                                                                       |
| -------------------- | ------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `type`               | string  | yes      | —        | Positional 0. Restricted to `infra`.                                                                                        |
| `domain`             | string  | yes      | —        | Product domain, optionally with `/`-separated subdomains (e.g. `billing/checkout`).                                         |
| `group`              | string  | no       | —        | Distinguishes this library from siblings of the same type. `infra` is typically one-per-domain, so this is usually omitted. |
| `name`               | string  | no       | derived  | Literal project-name override. Does not change where the project lives.                                                     |
| `linter`             | string  | no       | `eslint` | `eslint` \| `none`.                                                                                                         |
| `unitTestRunner`     | string  | no       | `jest`   | `jest` \| `none` (ADR 0007 — Jest only).                                                                                    |
| `tags`               | string  | no       | —        | Freeform tags appended after the derived `scope:`/`type:`/`domain:` tags.                                                   |
| `buildable`          | boolean | no       | `true`   | Forwarded to `@nx/node:library` unchanged.                                                                                  |
| `compiler`           | string  | no       | `tsc`    | `tsc` \| `swc`.                                                                                                             |
| `publishable`        | boolean | no       | `false`  |                                                                                                                             |
| `importPath`         | string  | no       | —        | Required for a publishable library.                                                                                         |
| `simpleModuleName`   | boolean | no       | `false`  |                                                                                                                             |
| `rootDir`            | string  | no       | —        |                                                                                                                             |
| `babelJest`          | boolean | no       | `false`  |                                                                                                                             |
| `strict`             | boolean | no       | `true`   |                                                                                                                             |
| `enableTypedLinting` | boolean | no       | `false`  | ADR 0006 — off by default for lint performance.                                                                             |
| `useProjectJson`     | boolean | no       | —        |                                                                                                                             |
| `skipTsConfig`       | boolean | no       | `false`  |                                                                                                                             |
| `skipFormat`         | boolean | no       | `false`  |                                                                                                                             |

## Examples

```bash
# libs/billing/infra, tagged scope:backend/type:infra/domain:billing
pnpm nx g @cybertecpty/node-plugin:lib infra --domain=billing

# libs/billing/checkout/orchestration/infra, tagged domain:billing-checkout
pnpm nx g @cybertecpty/node-plugin:lib infra --domain=billing/checkout --group=orchestration

# a publishable library with an explicit compiler
pnpm nx g @cybertecpty/node-plugin:lib infra --domain=platform \
  --publishable --importPath=@cybertecpty/platform-infra --compiler=swc
```
