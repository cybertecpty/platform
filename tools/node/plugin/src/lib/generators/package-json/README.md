# `package-json` generator

Creates a minimal `package.json` file in a target directory.

## What it does

- Generates `<dir>/package.json` when the file does not already exist.
- Prefixes the provided package `name` with the workspace npm scope, resolved via
  `getWorkspaceScope` from [`@cybertecpty/nx-utils`](../../../../../nx/utils) — never hardcoded.
- Sets `version` to `0.0.1` by default, or an explicit semantic version when `--vers` is provided.
  The version is written directly by this generator; it does not delegate to
  `@cybertecpty/release-plugin`'s `package-version` generator, since that generator's
  release-type bump semantics don't apply to a version being stamped into a file for the first
  time.
- Marks the package as private by default; omits the `private` field entirely (rather than writing
  `false`) when `--private=false` is passed.
- Optionally writes `main`, `engines.node` (from `--nodeEngine`), and `scripts.start` (from
  `--startScript`) for deployable Node packages — each is omitted when not supplied.
- Optionally copies selected dependency versions from the root `package.json`'s `dependencies` or
  `devDependencies` into the generated package's `dependencies`, via `--dependencies`.
- Throws a single error listing every requested `--dependencies` name that isn't found in either
  root map, before writing anything — a missing name is far more likely to be a typo or an
  already-removed dependency than something safe to skip silently.
- Skips generation and logs a warning when `package.json` already exists at the target path.
- Replaces an existing `package.json` only when `--overwrite` is provided. This is a full
  overwrite, not a field-level merge — any hand-edited custom fields on the existing file are
  discarded.
- Formats files unless `--skipFormat` is provided.

## Usage

```bash
pnpm nx g node-plugin:package-json <dir> --name <package-name> [options]
```

## Options

| Option         | Type         | Required | Default   | Notes                                                                          |
| -------------- | ------------ | -------- | --------- | ------------------------------------------------------------------------------ |
| `dir`          | string       | yes      | —         | Positional 0. Directory where `package.json` is created.                       |
| `name`         | string       | yes      | —         | Package name without the workspace npm scope.                                  |
| `dependencies` | string array | no       | —         | Names to copy from the root `package.json`'s `dependencies`/`devDependencies`. |
| `main`         | string       | no       | —         | Entry point to write to the generated package.                                 |
| `nodeEngine`   | string       | no       | —         | Semver range to write to `engines.node`.                                       |
| `overwrite`    | boolean      | no       | `false`   | Replace an existing `package.json`. Existing custom fields are discarded.      |
| `private`      | boolean      | no       | `true`    | Marks the generated package as private. Omitted entirely when `false`.         |
| `skipFormat`   | boolean      | no       | `false`   | Skip formatting generated files.                                               |
| `startScript`  | string       | no       | —         | Command to write to `scripts.start`.                                           |
| `vers`         | string       | no       | `'0.0.1'` | Explicit semantic version to write into `package.json`.                        |

## Examples

```bash
# Create libs/tools/package.json with the workspace scope and default version
pnpm nx g node-plugin:package-json libs/tools --name widget

# Create a public package.json with an explicit version
pnpm nx g node-plugin:package-json libs/contracts --name api-contracts --private=false --vers=2.3.4

# Create an Azure-ready Angular SSR package.json from root package versions
pnpm nx g node-plugin:package-json apps/cybertecpty --name cybertecpty --main=server/server.mjs --nodeEngine="^20.19.0 || ^22.12.0 || ^24.0.0" --startScript="node server/server.mjs" --dependencies=@angular/common,@angular/core,@angular/platform-browser,@angular/router,@angular/service-worker,@angular/ssr,@nx/angular,express --overwrite
```
