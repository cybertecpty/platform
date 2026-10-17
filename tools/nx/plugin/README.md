# nx-plugin

The workspace's own Nx plugin (`scope:tools`, not application code) — thin wrappers
over the `@nx/*` generators that apply the naming, directory, and tag conventions from
`docs/adr/0009-lib-directory-layout.md` / `0010-app-directory-layout.md`.

## Generators

Each generator's folder under `src/lib/generators/` has its own `README.md` with the full list of
options.

- **`nx-plugin`** — scaffold another tools plugin under `tools/<group>/plugin`, wrapping
  `@nx/plugin:plugin`.

  ```sh
  nx g @cybertecpty/nx-plugin:nx-plugin {group}
  ```

  e.g. `nx g @cybertecpty/nx-plugin:nx-plugin release` generates `release-plugin` at
  `tools/release/plugin`. Pass `--name` to override the derived project name;
  `--help` lists the rest (all forwarded to `@nx/plugin:plugin`).

  The generated project gets a `typecheck` target stub, so the scaffolded plugin's
  `.spec.ts` files are type-checked in CI from day one (the config lives in
  `nx.json` `targetDefaults.typecheck`; see issue #48).

- **`nx-gen`** — scaffold a generator inside a `type:plugin` project, wrapping
  `@nx/plugin:generator`.

  ```sh
  nx g @cybertecpty/nx-plugin:nx-gen {name} --project={plugin}
  ```

  e.g. `nx g @cybertecpty/nx-plugin:nx-gen release-manifest --project=release-plugin`
  adds `release-manifest` at
  `tools/release/plugin/src/lib/generators/release-manifest/generator.ts`. Pass
  `--directory` when the folder should differ from the collection key (as this
  plugin's own `nx-gen` does, living in `generators/generator/`).

  On top of `@nx/plugin:generator` it swaps the ambient `schema.d.ts` for a
  type-checked `schema.ts` exporting `{Name}GeneratorOptions` (written from a template,
  as `nx-exec` does), replaces the `libs/${name}` starter with a minimal one, adds a
  README with a usage command, re-exports the generator from the
  plugin's `src/index.ts`, and alpha-sorts the plugin's `generators.json` and its
  `package.json` dependencies (which `@nx/plugin` reorders by hoisting `@nx/devkit`). It
  refuses to run when the generator's folder or collection entry already exists, because
  upstream would silently overwrite it.

- **`nx-exec`** — scaffold an executor inside a `type:plugin` project, wrapping
  `@nx/plugin:executor`.

  ```sh
  nx g @cybertecpty/nx-plugin:nx-exec {name} --project={plugin}
  ```

  e.g. `nx g @cybertecpty/nx-plugin:nx-exec swa-deploy --project=azure-plugin` adds
  `swa-deploy` at `tools/azure/plugin/src/lib/executors/swa-deploy/executor.ts`. Pass
  `--directory` when the folder should differ from the collection key.

  On top of `@nx/plugin:executor` it does the following:
  - refuses to run when the executor's folder or collection entry already exists, because
    upstream would silently overwrite it
  - swaps the ambient `schema.d.ts` for a type-checked `schema.ts` exporting
    `{Name}ExecutorOptions`
  - makes `schema.json` strict (`additionalProperties: false`)
  - replaces the `console.log` starter with a `PromiseExecutor` that fails outside a project
    target and logs through `logger`
  - writes a spec on `@cybertecpty/nx-testing`'s `createExecutorContextFixture`, and a README
    with an example target
  - re-exports the executor from the plugin's `src/index.ts`
  - alpha-sorts the plugin's `executors.json` and `package.json` dependencies

  The executor conventions are in `.claude/rules/generators.md`.

## Building

`nx build nx-plugin` — `tsc` via `@nx/js:tsc`.

## Tests

`nx test nx-plugin` — Jest via `ts-jest`. `nx typecheck nx-plugin` type-checks the spec
files (which `build` excludes).
