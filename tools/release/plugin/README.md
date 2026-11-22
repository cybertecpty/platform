# release-plugin

The workspace's own Nx plugin for releases (`platform:tools`, `type:plugin`, not application code). Its
generators cut a release as described in `docs/adr/0011-release-flow.md`.

## Generators

Each generator's folder under `src/lib/generators/` has its own `README.md` with the full list of
options.

- [`release`](src/lib/generators/release/README.md): version, changelog, tag, and promote a release via
  a branch and pull request.

  ```sh
  pnpm nx g @cybertecpty/release-plugin:release
  ```

- [`release-manifest`](src/lib/generators/release-manifest/README.md): write a
  `release-manifest.json` at a project's root.

  ```sh
  pnpm nx g @cybertecpty/release-plugin:release-manifest {project} {version} --sourceCommit={commit}
  ```

- [`package-version`](src/lib/generators/package-version/README.md): set the version field of an
  existing `package.json` to an explicit semantic version or a release-type bump.

  ```sh
  pnpm nx g @cybertecpty/release-plugin:package-version {path} {version-or-release-type}
  ```

## Building

Run `pnpm nx build release-plugin` to build the library.

## Running unit tests

Run `pnpm nx test release-plugin` to execute the unit tests via [Vitest](https://vitest.dev/).
