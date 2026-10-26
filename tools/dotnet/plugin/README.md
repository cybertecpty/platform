# dotnet-plugin

Nx plugin for the workspace's .NET projects (`scope:tools`, `type:plugin`). It holds the code that enforces the workspace's conventions on .NET projects, as ADR 0019 describes.

## Executors

- [`check-boundaries`](src/lib/executors/check-boundaries/README.md): fails when a .NET project references another .NET project in a way ADR 0004's dependency constraints forbid.

## Helpers

`src/lib/utils/` holds helpers used inside the plugin, such as `isDotNetProjectNode`, which tells a .NET project node from any other by the `technologies` metadata `@nx/dotnet` gives it.

## Building

Run `nx build dotnet-plugin` to build the library.

## Running unit tests

Run `nx test dotnet-plugin` to execute the unit tests via [Jest](https://jestjs.io).
