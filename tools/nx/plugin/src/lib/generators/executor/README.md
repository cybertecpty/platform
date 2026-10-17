# `nx-exec` generator

Scaffold an executor inside a `type:plugin` project, wrapping `@nx/plugin:executor` with the
workspace conventions in `.claude/rules/generators.md`.

## Usage

```sh
nx g @cybertecpty/nx-plugin:nx-exec {name} --project={plugin}
```

e.g. `nx g @cybertecpty/nx-plugin:nx-exec swa-deploy --project=azure-plugin` adds
`tools/azure/plugin/src/lib/executors/swa-deploy/executor.ts`.

## What it changes on top of `@nx/plugin:executor`

- Targets the plugin by project name, rejecting a project not tagged `type:plugin`, and always
  writes to `src/lib/executors/{directory}/executor.ts`.
- Replaces the ambient `schema.d.ts` with a type-checked `schema.ts` exporting
  `{Name}ExecutorOptions`, written from a template. It fails loudly if upstream stops emitting
  `schema.d.ts`.
- Makes `schema.json` strict: `additionalProperties: false` and an explicit `required`.
- Replaces the `console.log` starter with a `PromiseExecutor` that fails outside a project target
  and logs through `logger`, and writes a spec built on `createExecutorContextFixture` from
  `@cybertecpty/nx-testing`.
- Adds an executor-local `README.md`: the description (or a TODO), options and an example target.
- Refuses to run when the executor folder or its collection entry already exists, because upstream
  would silently overwrite a real implementation with the starter. Delete the folder first to
  regenerate.
- Re-exports the executor and its options type from the plugin's `src/index.ts`, using `@nx/js`'s
  `addGlobal`.
- Alpha-sorts the plugin's `executors.json` and its `package.json` dependencies, which upstream
  reorders by moving `@nx/devkit` to the top.

## Options

- `name` (required, positional): the executor's key in `executors.json` and, by default, its
  folder.
- `project` (required): the `type:plugin` project to add the executor to.
- `directory`: the folder under `src/lib/executors/`, when it should differ from `name`.
- `description`: recorded in `executors.json`, the executor's `schema.json` and its README.
- `unitTestRunner`: `jest` (default) or `none`, which writes no spec.
- `skipLintChecks`: don't add the eslint configuration for the plugin's json files.
- `skipFormat`: skip formatting.
