# angular-plugin

The workspace's own Nx plugin for Angular (`platform:tools`, `type:plugin`, not application code). It
wraps the `@nx/angular` generators and applies the naming, directory, tag and test conventions from
`docs/adr/0009-lib-directory-layout.md` and `docs/adr/0018-vitest-test-runner.md`.

## Generators

Each generator's folder under `src/lib/generators/` has its own `README.md` with the full list of
options.

- [`ng-lib`](src/lib/generators/library/README.md): create an Angular library (`core`,
  `data-access`, `feature`, `ui`, `testing` or `utils`) under
  `libs/<domain>[/<subdomain>...]/[<group>/]<type>`, wrapping `@nx/angular:library`.

  ```sh
  pnpm nx g @cybertecpty/angular-plugin:ng-lib {type} --domain={domain}
  ```

A `types` library, and any library that is not Angular-specific, comes from the `ts-lib` generator
of `js-plugin`.

## Building

Run `pnpm nx build angular-plugin` to build the library.

## Running unit tests

Run `pnpm nx test angular-plugin` to execute the unit tests via [Vitest](https://vitest.dev/).
