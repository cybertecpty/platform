# `ng-lib` generator

Creates an Angular library under `libs/<domain>[/<subdomain>...]/[<group>/]<type>`, wrapping
`@nx/angular:library` with the workspace's naming, directory, and tag conventions (ADR 0009).

## What it does

- `--type` is one of `core`, `data-access`, `feature` and `ui` (the Angular library types), or
  `testing` and `utils` (the `platform:frontend` forms, ADR 0009). A `types` library comes from
  `nx g @cybertecpty/js-plugin:ts-lib`. `--platform` is not an option: every library is
  `platform:frontend`.
- `--domain` is required. The project's `name`, `directory` and `platform:`/`type:`/`domain:` tags
  are derived from `--domain`/`--group`/`--name` through the shared `@cybertecpty/nx-utils` helpers,
  so there is no `--directory`.
- Applies per-type defaults for `routing`, `skipModule` and `standalone`, and forces the ones a type
  cannot have:

  | Type          | `routing`              | `skipModule`          | `standalone`           |
  | ------------- | ---------------------- | --------------------- | ---------------------- |
  | `core`        | `false`                | `true`                | `false`                |
  | `feature`     | `true`                 | `true`                | `false`                |
  | `ui`          | always `false` (warns) | `true`                | `false`                |
  | `data-access` | always `false` (warns) | always `true` (warns) | always `false` (warns) |
  | `utils`       | always `false`         | always `true`         | always `false`         |
  | `testing`     | `false`                | `true`                | `false`                |

  A cell without "always" is a default the caller can change. With `standalone` and `skipModule`
  at these defaults a library is generated without a starter component or module; a `feature`
  library gets a `lib.routes.ts`.

- Adds a folder skeleton from the files in `files/<type>/` (`.gitkeep` files for `core`,
  `data-access`, `feature`, `ui` and `testing`). A `utils` library also gets
  `src/lib/<topic>.utils.ts`, its spec, and a barrel export. `<topic>` is the project name without
  its `-utils` suffix, so `billing-format-utils` gets `billing-format.utils.ts`.
- Forces a `type:testing` library to `buildable: false` and `publishable: false`
  (`forceTestingLibNotBuildable` in `@cybertecpty/nx-utils`): a production library importing a
  buildable testing-helpers library would otherwise pull it in as a real buildable dependency.
- Uses `vitest-analog` as the unit test runner (ADR 0018). Replaces the scaffold's
  `vite.config.mts` with a `vitest.config.mts` that merges the root `vitest.base.mts` and keeps the
  Analog plugin and `src/test-setup.ts` (`configureAngularVitestProject`), and allows `.mts`
  imports in `tsconfig.spec.json`. `--unitTestRunner=jest` is rejected.
  `vitest-angular` is accepted by the schema, but `@nx/angular` rejects it while the workspace's
  Vitest is outside the range it pins (`^4.0.8`).
- Removes the root `vitest.config.ts` and the `@nx/vite` and `vite` dependencies the upstream
  generator adds (`withoutUpstreamVitestSideEffects` in `@cybertecpty/nx-utils`).
- Adds `vitest/globals` to a `type:testing` library's `tsconfig.lib.json` `compilerOptions.types`,
  since its own source (mocks, fixtures) commonly uses Vitest globals outside `*.spec.ts`.
- Re-sorts `tsconfig.base.json`'s `paths` map alphabetically after delegating.
- Adds the `typecheck` target stub (issue #48) unless `--unitTestRunner=none`.
- Forwards every other option to `@nx/angular:library`.
- Formats generated files unless `--skipFormat` is passed.

## Usage

```bash
pnpm nx g @cybertecpty/angular-plugin:ng-lib {type} --domain={domain} [options]
```

## Options

| Option           | Type    | Required | Default         | Notes                                                                                     |
| ---------------- | ------- | -------- | --------------- | ----------------------------------------------------------------------------------------- |
| `type`           | string  | yes      | —               | Positional 0. `core` \| `data-access` \| `feature` \| `testing` \| `ui` \| `utils`.       |
| `domain`         | string  | yes      | —               | Product domain, optionally with `/`-separated subdomains (e.g. `billing/checkout`).       |
| `group`          | string  | no       | —               | Distinguishes this library from siblings of the same type within its domain.              |
| `name`           | string  | no       | derived         | Literal project-name override. Does not change where the project lives.                   |
| `unitTestRunner` | string  | no       | `vitest-analog` | `vitest-analog` \| `vitest-angular` \| `none` (ADR 0018 — Vitest only).                   |
| `buildable`      | boolean | no       | `false`         | Always `false` for `testing`.                                                             |
| `publishable`    | boolean | no       | `false`         | Always `false` for `testing`. Requires `importPath`.                                      |
| `importPath`     | string  | no       | —               | Required for a publishable library.                                                       |
| `routing`        | boolean | no       | by type         | See the table above.                                                                      |
| `lazy`           | boolean | no       | `false`         | `RouterModule.forChild` when `true`, a plain routes array when `false`.                   |
| `parent`         | string  | no       | —               | Parent route configuration to register the library's routes in.                           |
| `standalone`     | boolean | no       | by type         | A starter standalone component. See the table above.                                      |
| `skipModule`     | boolean | no       | by type         | See the table above.                                                                      |
| `prefix`         | string  | no       | `ct`            | Selector prefix. `ct` is for Cybertec, and keeps selectors apart from Cypress's `cy`.     |
| `style`          | string  | no       | `scss`          | `css` \| `scss` \| `sass` \| `less` \| `none`. Applies to a starter standalone component. |
| `linter`         | string  | no       | `eslint`        | `eslint` \| `none`.                                                                       |
| `strict`         | boolean | no       | `true`          | Stricter type checking and build optimization options.                                    |
| `tags`           | string  | no       | —               | Freeform tags appended after the derived `platform:`/`type:`/`domain:` tags.              |
| `skipFormat`     | boolean | no       | `false`         |                                                                                           |

The component options of `@nx/angular:library` (`displayBlock`, `inlineStyle`, `inlineTemplate`,
`viewEncapsulation`, `changeDetection`, `selector`, `skipSelector`, `skipTests`, `flat`) apply to a
starter standalone component and are forwarded unchanged. `addModuleSpec`, `compilationMode`,
`enableTypedLinting`, `skipPackageJson` and `skipTsConfig` are forwarded unchanged too; see
`schema.json` for their descriptions.

## Buildable and publishable libraries

A `--buildable` or `--publishable` library gets a `package.json` from `@nx/angular:library` whose
`peerDependencies` are `@angular/common` and `@angular/core`. A library generated without a starter
component imports neither, so `@nx/dependency-checks` fails the first `nx lint`. Run
`nx lint {project} --fix` once after generating it, and the peers are corrected to what the library
imports (`@angular/router` for a routed one). The library builds without that step.

A `--publishable` library is not part of any `nx release` group: `nx.json` has only the `apps`
group, and publishing libraries to npm is deferred until a real package exists (ADR 0011). Nx logs
"Could not find a release group that includes {project}" when one is generated. The message is
informational, and the library is still created. The `ts-lib` generator behaves the same way.

## Examples

```bash
# libs/billing/ui, named billing-ui, tagged domain:billing,platform:frontend,type:ui
pnpm nx g @cybertecpty/angular-plugin:ng-lib ui --domain=billing

# libs/billing/checkout/feature, with lib.routes.ts
pnpm nx g @cybertecpty/angular-plugin:ng-lib feature --domain=billing/checkout

# libs/billing/format/utils, with billing-format.utils.ts and its spec
pnpm nx g @cybertecpty/angular-plugin:ng-lib utils --domain=billing --group=format
```
