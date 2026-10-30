# `check-coverage-output` executor

Fail when the `test` target of a .NET tests project does not cache the coverage report (ADR 0017).

Run it as `@cybertecpty/dotnet-plugin:check-coverage-output`. The plugin adds it as the `check-coverage-output` target to every .NET project tagged `type:testing`.

## What it checks

The `test` target of the project, as resolved in the project graph (what Nx actually runs), must list `{workspaceRoot}/coverage/{projectRoot}` among its outputs. Otherwise a cache hit restores no report, and the project passes the 80% gate while dropping out of the PR coverage comment. A failure is logged as `project: "test" target outputs do not include ...`.

## Cache

The result is cached. Besides the project's own files and the plugin's code, its inputs include `nx.json` (plugin order and target defaults decide the resolved outputs) and the installed `@nx/dotnet` version (which infers the outputs the plugin extends).

## Options

None.
