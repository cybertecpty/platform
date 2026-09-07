# nx-plugin

The workspace's own Nx plugin (`scope:tools`, not application code) — thin wrappers
over the `@nx/*` generators that apply the naming, directory, and tag conventions from
`docs/adr/0009-lib-directory-layout.md` / `0010-app-directory-layout.md`.

## Generators

- **`nx-plugin`** — scaffold another tools plugin under `tools/<group>/plugin`, wrapping
  `@nx/plugin:plugin`.

  ```sh
  nx g @cybertecpty/nx-plugin:nx-plugin <group>
  ```

  e.g. `nx g @cybertecpty/nx-plugin:nx-plugin release` generates `release-plugin` at
  `tools/release/plugin`. Pass `--name` to override the derived project name;
  `--help` lists the rest (all forwarded to `@nx/plugin:plugin`).

## Building

`nx build nx-plugin` — `tsc` via `@nx/js:tsc`.

## Tests

`nx test nx-plugin` — Jest via `ts-jest`. `nx typecheck nx-plugin` type-checks the spec
files (which `build` excludes).
