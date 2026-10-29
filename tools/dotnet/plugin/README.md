# dotnet-plugin

Nx plugin for the workspace's .NET projects (`scope:tools`, `type:plugin`). It holds the code that enforces the workspace's conventions on .NET projects, as ADR 0019 describes.

## Executors

- [`check-coverage-output`](src/lib/executors/check-coverage-output/README.md): fails when a .NET tests project's `test` target does not cache the coverage report.
- [`check-boundaries`](src/lib/executors/check-boundaries/README.md): fails when a .NET project references another .NET project in a way ADR 0004's dependency constraints forbid.

## Inferred target

The plugin adds the `check-boundaries` target to every .NET project, so no `project.json` lists it. It is registered in the workspace's `nx.json`, in the change that adds the workspace's first .NET project (until then the target does not exist, and neither does the Node warning below):

```json
{
  "plugins": [
    {
      "plugin": "@cybertecpty/dotnet-plugin",
      "options": { "targetName": "check-boundaries" }
    }
  ]
}
```

- Its `createNodes` (`src/lib/plugin/plugin.ts`) looks for `*.csproj`, `*.fsproj` and `*.vbproj` files and adds the target to the project in the folder of each. `targetName` is optional and defaults to `check-boundaries`.
- The target is cached. Its inputs are the project's own files, its dependencies' files (the check reads their references and tags) and the code that runs the check, so it re-runs when any of them changes, and `nx affected` selects it when a project's references change.
- The check needs the project's graph node to carry `dotnet` among its `technologies`. This plugin sets it on each project it finds, and `@nx/dotnet` sets the same value, so the check works with or without that plugin.
- A project whose `project.json` tags it `type:testing` also gets `{workspaceRoot}/coverage/{projectRoot}` added to the outputs of its `test` target (after `@nx/dotnet`'s own, via `...`). Coverlet writes its report there, so a cache hit restores it and the PR coverage comment keeps the project. This depends on the plugin being listed after `@nx/dotnet` in `nx.json`, and the plugin reads `project.json` without Nx noticing a change to it, so such a project also gets a cached `check-coverage-output` target that checks the resolved graph and fails, naming the project, when the `test` outputs lack the directory.
- It is part of the `nx affected` and `nx run-many` target lists in CI and in `pnpm verify`. With no .NET project, no project has the target and nothing runs.

### A Node warning in CI

With the Nx daemon off, which is the default in CI, every Nx command prints one line from Node: `Warning: Failed to load the ES module: …/plugin.ts`. Nx 23 loads a local TypeScript plugin with Node's native type stripping first, which fails for a `.ts` file with `import` statements in a CommonJS package, and then falls back to its transpiler. Everything works. Setting `NX_PREFER_NODE_STRIP_TYPES=false` removes the line, but it changes how Nx loads every local TypeScript plugin, so it is not set here (ADR 0019).

## Helpers

`src/lib/utils/` holds helpers used inside the plugin, such as `isDotNetProjectNode`, which tells a .NET project node from any other by the `technologies` metadata `@nx/dotnet` gives it.

## Building

Run `nx build dotnet-plugin` to build the library.

## Running unit tests

Run `nx test dotnet-plugin` to execute the unit tests via [Jest](https://jestjs.io).
