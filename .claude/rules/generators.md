---
paths:
  - 'tools/*/plugin/**'
---

# Nx plugin generators & executors

Moved here from `docs/agents/conventions.md` §8. Loads when working in an Nx plugin project.

- Use template files with `generateFiles` for generator output whenever viable. Name
  those files with a `__tmpl__` suffix (e.g. `generator.ts__tmpl__`) and pass
  `{ tmpl: '' }` in the substitutions — not the `.template` suffix Nx also strips.
  `__tmpl__` is what the workspace already uses (`generators/plugin/files/src/lib/.gitkeep__tmpl__`),
  and a `__tmpl__` name falls outside the `src/**/*.ts` / `**/!(*.ts)` globs that lint,
  typecheck, and asset-copy would otherwise apply to it.
- Keep generator/executor folders to actual implementations; supporting constants,
  helpers, and types go in sibling `src/lib/defaults/`, `src/lib/utils/`, etc.

## Scaffold with the workspace wrappers

Add a generator with `nx g @cybertecpty/nx-plugin:nx-gen {name} --project={plugin}` and an
executor with `nx g @cybertecpty/nx-plugin:nx-exec {name} --project={plugin}`, not the raw
`@nx/plugin` generators. Both wrappers apply the conventions below; the plugin's `README.md` lists
exactly what each one rewrites.

- The target must be a `type:plugin` project, named by `--project`, not a path.
- Each artifact gets its own folder: `src/lib/generators/{directory}/` or
  `src/lib/executors/{directory}/`. `--directory` defaults to `name` and is only for when the
  folder should differ from the collection key.
- `name` must start with a letter, because it becomes part of TypeScript identifiers
  (`{name}Generator`, `{Name}ExecutorOptions`). `directory` is only a folder, so it may start with
  a digit.
- File names are fixed: `generator.ts` / `generator.spec.ts` or `executor.ts` /
  `executor.spec.ts`.
- `schema.d.ts` becomes a type-checked `schema.ts`, and its interface is named
  `{Name}GeneratorOptions` / `{Name}ExecutorOptions`, not `…Schema`.
- The plugin's `src/index.ts` re-exports the default function and its options type, and the
  `generators.json` / `executors.json` collection is alpha-sorted.
- Each artifact folder has its own `README.md`: its purpose, its options, and a usage command
  (generators) or an example target (executors).

Executors also follow these rules:

- `schema.json` is strict: `version: 2`, `additionalProperties: false`, an explicit
  `required`, and a description on every property.
- The executor is a default-exported `PromiseExecutor<{Name}ExecutorOptions>`, with JSDoc. It
  fails with `{ success: false }` and a `logger.error` when `context.projectName` is missing,
  logs through `logger` (never `console`), and returns a structured `{ success }`.
- Specs build their context with `createExecutorContextFixture` from `@cybertecpty/nx-testing`,
  not a hand-rolled `ExecutorContext`.
- Out of scope until a real need appears: batch implementations, custom hashers, and wiring a
  target into a consuming project.

## Generator changes — update all surfaces together

1. `generator.ts` (runtime) 2. `schema.ts` (option types) 3. `schema.json` (CLI
   schema) 4. `generator.spec.ts` (unit coverage) 5. generator-local `README.md`.
