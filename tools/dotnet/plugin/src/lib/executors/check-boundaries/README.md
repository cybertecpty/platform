# `check-boundaries` executor

Fail when a .NET project references another .NET project in a way ADR 0004's dependency constraints forbid. The design and the alternatives it was weighed against are in ADR 0019.

Run it as `@cybertecpty/dotnet-plugin:check-boundaries`.

## What it checks

For the project it runs on, the executor looks at each `ProjectReference` dependency in the Nx project graph and checks it against the dependency-constraint matrix:

- Every row of the matrix applies, whatever its tag axis (`scope:`, `type:` or `domain:`), when the project has the row's source tag (or all of a combo row's source tags).
- The referenced project must carry at least one of the row's `onlyDependOnLibsWithTags` and none of its `notDependOnLibsWithTags`. Tag patterns are exact tags, `*` wildcards and `/regex/` patterns, as in `@nx/enforce-module-boundaries`.
- A project that no row applies to is a violation too.
- Only direct references are checked; unlike ESLint, banned tags are not followed through other projects.

Every violation is logged as `source -> target: ...` and the executor fails after logging all of them, so one run shows everything that needs fixing.

## What it skips

- Implicit dependencies (from `implicitDependencies`, not a `ProjectReference`), as ESLint does.
- Dependencies on external packages, which have no project in the graph.
- Dependencies on projects that are not .NET projects. A .NET project is one whose graph node lists `dotnet` among its `technologies`.

## When it fails without checking

It logs an error and fails when it runs without a project name, or on a project that is not a .NET project.

## The matrix

The rules come from the shared `DEP_CONSTRAINTS` module in `nx-utils`, the same array the ESLint configuration uses. The executor gets it from `loadDepConstraints()` in `nx-utils`, which `require`s the module by absolute path (ADR 0004, 2026-10-22 amendment): the module is an `.mts` file that Jest cannot load and that the transpiler Nx runs executors with cannot find through an import by name. The executor loads the matrix before looking at any dependency, so a failure to load it fails the run even for a project with no dependencies.

## Options

None.

## Example

```json
{
  "targets": {
    "check-boundaries": {
      "executor": "@cybertecpty/dotnet-plugin:check-boundaries"
    }
  }
}
```

A violation is reported like this:

```
checkout-api -> checkout-infra: A project tagged with "type:api" can only depend on libs tagged with "type:services", "type:utils"
```
