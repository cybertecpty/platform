# js-plugin

The workspace's own Nx plugin for TypeScript (`platform:tools`, `type:plugin`, not application code). It
wraps `@nx/js:library` and applies the naming, directory, tag and test conventions from
`docs/adr/0009-lib-directory-layout.md` and `docs/adr/0018-vitest-test-runner.md`.

## Generators

Each generator's folder under `src/lib/generators/` has its own `README.md` with the full list of
options.

- [`ts-lib`](src/lib/generators/library/README.md): create a TypeScript library under
  `libs/<domain>/[<group>/]<type>` or `tools/[<group>/]<type>` (ADR 0009), wrapping `@nx/js:library`.
  `--app` places it under `apps/<app>/...` and tags it `app:<app>` (ADR 0023).

  ```sh
  pnpm nx g @cybertecpty/js-plugin:ts-lib {type} --domain={domain} --platform={platform}
  ```

## Building

Run `pnpm nx build js-plugin` to build the library.

## Running unit tests

Run `pnpm nx test js-plugin` to execute the unit tests via [Vitest](https://vitest.dev/).
