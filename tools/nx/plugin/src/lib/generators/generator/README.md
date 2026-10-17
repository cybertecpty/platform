# `nx-gen` generator

Scaffold a generator inside a `type:plugin` project, wrapping `@nx/plugin:generator` with the
workspace conventions in `.claude/rules/generators.md`.

## Usage

```sh
nx g @cybertecpty/nx-plugin:nx-gen {name} --project={plugin}
```

e.g. `nx g @cybertecpty/nx-plugin:nx-gen release-manifest --project=release-plugin` adds
`tools/release/plugin/src/lib/generators/release-manifest/generator.ts`.

## What it changes on top of `@nx/plugin:generator`

- Targets the plugin by project name, rejecting a project not tagged `type:plugin`, and always
  writes to `src/lib/generators/{directory}/generator.ts`.
- Replaces the ambient `schema.d.ts` with a type-checked `schema.ts` exporting
  `{Name}GeneratorOptions`, written from a template. It fails loudly if upstream stops emitting
  `schema.d.ts`.
- Replaces the `libs/{name}` starter and its spec with minimal ones, and drops upstream's example
  `files/` template.
- Adds a generator-local `README.md`: the description (or a TODO), a usage command and options.
- Re-exports the generator and its options type from the plugin's `src/index.ts`, once.
- Alpha-sorts the plugin's `generators.json` and its `package.json` dependencies, which upstream
  reorders by moving `@nx/devkit` to the top.

## Options

- `name` (required, positional): the generator's key in `generators.json` and, by default, its
  folder.
- `project` (required): the `type:plugin` project to add the generator to.
- `directory`: the folder under `src/lib/generators/`, when it should differ from `name`. This
  plugin's own `nx-gen` lives in `generators/generator/`.
- `description`: recorded in `generators.json` and the README.
- `unitTestRunner`: `jest` (default) or `none`, which writes no spec.
- `skipLintChecks`: don't add the eslint configuration for the plugin's json files.
- `skipFormat`: skip formatting.
