# `nx-plugin` generator

Scaffold another tools plugin at `tools/{group}/plugin`, wrapping `@nx/plugin:plugin` with the
workspace naming, directory and tag conventions (ADR 0009).

## Usage

```sh
nx g @cybertecpty/nx-plugin:nx-plugin {group}
```

e.g. `nx g @cybertecpty/nx-plugin:nx-plugin release` generates `release-plugin` at
`tools/release/plugin`.

## What it changes on top of `@nx/plugin:plugin`

- Takes a `group` instead of a raw `directory`, and derives the project name
  (`{group}-plugin`), directory and tags from the shared ADR 0009 helpers.
- Always tags the project `scope:tools` and `type:plugin`, which `nx-gen` and `nx-exec` require.
- Adds a `typecheck` target stub, so the plugin's specs are type-checked in CI from the start
  (issue #48).
- Skips the `buildable` → `bundler` step: a plugin's build is driven by `compiler`, and it has no
  bundler.

## Options

- `group` (required, positional): the `tools/{group}/plugin` folder segment and the project-name
  prefix.
- `name`: overrides the derived `{group}-plugin` project name. The directory still comes from
  `group`.
- `tags`: extra comma-separated tags, appended to `scope:tools` / `type:plugin`.

Every other option (`importPath`, `linter`, `unitTestRunner`, `compiler`, `e2eTestRunner`,
`publishable`, …) is forwarded to `@nx/plugin:plugin` unchanged; `--help` lists them.
