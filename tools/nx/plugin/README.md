# nx-plugin

The workspace's own Nx plugin (`scope:tools`, not application code) — thin wrappers
over the `@nx/*` generators that apply the naming, directory, and tag conventions from
`docs/adr/0009-lib-directory-layout.md` / `0010-app-directory-layout.md`.

## Generators

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
  type-checked `schema.ts`, renames the `Schema` interface to `Options`, replaces
  the `libs/${name}` starter with a minimal one, and re-exports the generator from
  the plugin's `src/index.ts`.

## Building

`nx build nx-plugin` — `tsc` via `@nx/js:tsc`.

## Tests

`nx test nx-plugin` — Jest via `ts-jest`. `nx typecheck nx-plugin` type-checks the spec
files (which `build` excludes).
