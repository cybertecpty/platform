# 19. Enforcing module boundaries between .NET projects with an inferred Nx executor

- Status: accepted
- Date: 2026-10-26
- Deciders: djmcgrath
- Implemented by: issue #195 (the check, its executor and its inferred target; the inferred
  target and CI wiring are still pending there), #216 (moving the matrix into a shared module)
- Builds on: ADR 0004 (`nx-module-boundaries`) for the matrix, and ADR 0017 (`dotnet-backend`),
  which chose a do-it-yourself check and left how it runs open

## Context and problem statement

ADR 0004's tag matrix limits which projects may depend on which. For TypeScript, the
`@nx/enforce-module-boundaries` ESLint rule enforces it by reading `import` statements. A C#
`ProjectReference` is not an import, so the rule never sees it: an API project can reference
an infra project directly and everything still compiles and passes. `@nx/dotnet` ships no
boundaries rule, and Nx Conformance, which would cover it, is Enterprise-only. ADR 0017 therefore
chose a small in-repo check but did not decide how it runs, where its rules come from, or what
it covers.

A scratch workspace with `@nx/dotnet@23.1.1` showed that the plugin gives a check everything it
needs. A `ProjectReference` becomes a `static` edge in the Nx project graph, tags come from a
`project.json` beside the `.csproj`, and every .NET node carries
`metadata.technologies: ["dotnet", "C#"]` (ADR 0017, 2026-10-21 amendment).

Only one other implementation exists: the community plugin `@nx-dotnet/core`, archived on
2025-11-04 and deprecated in favour of the official plugin. Its check
(`packages/core/src/tasks/check-module-boundaries.ts`) was compared with ours after the first
version was written, and the choices below were confirmed or adjusted against it. Skipping
implicit dependencies is the one behaviour taken from it.

## Decision drivers

- **One source for the rules.** ADR 0017 requires the check to read the matrix, not restate it.
- **Fail closed.** A project that is untagged or misconfigured must not pass by default. ESLint
  reports a project that no constraint applies to, and the check should match.
- **Run where the workspace already runs checks:** per project, cached, selected by
  `nx affected`, and part of the required CI check.
- **A new .NET project cannot silently escape the check.**
- **Testable as plain functions**, without ESLint, Nx or the .NET SDK.
- **No Enterprise features.**
- **The same answer as ESLint** for the cases that apply to .NET.

## Considered options

### Where the check runs

1. **A per-project Nx executor, with its target inferred onto every .NET project.** **(chosen)**
2. **A root script plus a CI step**, like `nx format:check`. Rejected: simplest, and it always
   runs, but it has no per-project cache and is not part of `nx affected`. The workspace enforces
   its conventions through executors, generators and inferred targets, and this follows suit.
3. **One cached target on a single project.** Rejected: `nx affected` selects it only when that
   project or its dependencies change, so a bad `ProjectReference` in some other project's
   `.csproj` would not trigger it.
4. **A hand-written target in each `project.json`.** Rejected: a project that lacks it escapes
   silently. Inference removes that hazard, the way the eslint and jest plugins do for `lint`
   and `test`.
5. **An MSBuild target in each `.csproj` that runs a Node script before every build**
   (`@nx-dotnet/core`'s approach). Not chosen now: it fails the build in the IDE and on
   `dotnet build`, which our option does not, but it needs Node wherever .NET builds, builds the
   Nx graph on every build, and adds hand-edited XML to every `.csproj`. It remains a possible
   follow-up that calls the executor through Nx, so the cache is kept.
6. **Roslyn or MSBuild analyzers** (StructureGuard, ArchonAnalysers, SeamGuard, ReferenceCop).
   Not chosen: each has its own rule format, so the matrix would have to be translated or
   generated, and several are preview or alpha packages. They could give live editor feedback,
   so they are worth revisiting for that.
7. **Nx Conformance.** Rejected: Enterprise-only (ADR 0017).

### Where the rules come from

1. **The shared matrix module, imported by both the ESLint config and the check.** **(chosen)**
2. **Read `depConstraints` out of the ESLint configuration at check time**
   (`@nx-dotnet/core`'s default, via `new ESLint().calculateConfigForFile`). Rejected: it runs
   ESLint on every check, depends on how ESLint resolves the rule's options, couples the check
   to ESLint's API, and, as implemented there, returns no rules when loading fails.
3. **A separate rule file for .NET** (`@nx-dotnet/core`'s `.nx-dotnet.rc.json` fallback).
   Rejected: a second copy of the matrix, which ADR 0017 rules out.

## Decision outcome

Chosen: **an Nx executor, `check-boundaries`, in a `dotnet-plugin` project, put on every .NET
project by an inferred target, reading the ADR 0004 matrix from its shared module.**

### Locked parameters

- **Executor and target:** `@cybertecpty/dotnet-plugin:check-boundaries`. A small local plugin
  with `createNodes`, registered in `nx.json`, adds the target to every .NET project. Its cache
  inputs are the project's own files, its dependencies' files and the matrix, so it re-runs when
  any of them changes and `nx affected` selects it when a project's references change.
- **The check itself** is `checkDepConstraints(source, target, constraints)` in `nx-utils`: pure,
  with the constraints passed in, so `nx-utils` never loads the matrix.
- **The matrix** is `DEP_CONSTRAINTS` in `nx-dep-constraints.const.mts`. The executor loads it
  lazily through the `@cybertecpty/nx-utils/dep-constraints` path alias (ADR 0004, 2026-10-22
  amendment).
- **Which projects and edges:** nodes whose `technologies` include `dotnet`; their `static`
  edges to other .NET nodes. Implicit dependencies (from `implicitDependencies`) are skipped, as
  in ESLint and `@nx-dotnet/core`, and so are targets that are not .NET nodes, such as external
  packages.
- **Which rules:** every row of the matrix, whatever its tag axis. A target must carry at least
  one of a row's `onlyDependOnLibsWithTags` (an empty list allows only an untagged target) and
  none of its `notDependOnLibsWithTags`. A combo row needs all of its `allSourceTags`. Tag
  patterns are exact tags, `*` wildcards with other regular-expression characters taken
  literally, and `/regex/` patterns, as in `@nx/enforce-module-boundaries`.
- **Direct references only.** `notDependOnLibsWithTags` is not followed through other projects,
  unlike ESLint.
- **Fails closed.** A source that no row applies to is itself a violation.
- **Reporting:** every violation for an edge, each starting `source -> target:` followed by the
  broken rule in Nx's wording.
- **Project metadata** is as ADR 0017 requires: a `project.json` beside each `.csproj` with an
  explicit kebab-case `name` and the three tags.

### How this differs from `@nx-dotnet/core`

| Aspect             | `@nx-dotnet/core`                                       | This ADR                                 |
| ------------------ | ------------------------------------------------------- | ---------------------------------------- |
| Rules              | ESLint's resolved config, or `.nx-dotnet.rc.json`       | One shared matrix module                 |
| Runs               | MSBuild target before every build                       | Cached executor via Nx and CI            |
| Project graph      | Builds its own with `createProjectGraphAsync()`         | Uses the graph Nx hands the executor     |
| Rules fail to load | Returns no violations                                   | The executor throws and the target fails |
| Untagged project   | Passes                                                  | Reports it                               |
| Implicit edges     | Skipped                                                 | Skipped                                  |
| Non-.NET target    | Not filtered; reads `graph.nodes[target].data` directly | Skipped                                  |
| Wildcards          | Nx's `hasTag` logic, regular-expression characters raw  | Same logic, other characters escaped     |
| Empty allowed list | Every dependency fails                                  | Only a tagged target fails, as in Nx     |
| Message            | Dumps the whole constraint as JSON                      | Names the source, target and rule        |

Both check direct references only and apply every row regardless of tag axis.

## Unverified until the first .NET project exists

1. **Loading the matrix at runtime.** The executor runs as compiled CommonJS and loads an
   ES-module `.mts` file through the alias, which relies on Node loading an ES module with
   `require` and stripping types from the `.mts` source. Node can `require` the compiled
   `.mjs` output (checked: it yields all 19 rows), but loading the `.mts` source through the
   alias has not been run under Nx on the CI Node version.
2. **The thin host.** The check enforces ADR 0004's ban on `type:testing` depending on
   `type:app`, so .NET integration tests that reference the app project fail it. ADR 0017's
   item 5 is to try a thin host first. If it is not enough, the fallback is a matrix change in
   ADR 0004.
3. **The inferred target.** Its `createNodes`, cache inputs and `nx affected` selection have not
   been built or exercised against a real graph.

## Consequences

### Positive

- One matrix drives both enforcers, so the TypeScript and .NET answers cannot drift apart.
- A violation fails a cached, per-project target that `nx affected` selects when the project's
  references change, in the same required CI check as lint and test.
- A new .NET project gets the check without anyone adding it, and an untagged project is
  reported instead of passing.
- The logic is plain functions with tests that need no Nx runtime, ESLint or .NET SDK.

### Negative / risks

- **Nothing fails at `dotnet build` or in the IDE.** Violations show up through Nx and CI only.
  An MSBuild hook that calls the executor, or an analyzer for live editor feedback, would close
  this gap. Neither is built.
- **Direct references only.** ESLint also catches a banned tag reached through other projects.
- **The `.mts` loading path exists because of Jest.** The alias and the lazy `import()` are there
  because Jest does not transform `.mts` files. After the Vitest migration (ADR 0018), check
  whether the matrix can be exported from the `nx-utils` barrel and the alias dropped.
- **The alias cannot be a literal `import()` specifier.** When `@nx/js:tsc` builds the plugin it
  rewrites the alias to point at the `.mts` file in `nx-utils`' build output, and TypeScript 6.0.3
  crashes ("Debug Failure") resolving that mapping. The executor therefore holds the specifier in
  a constant and casts the result to its type, which leaves that one import unchecked by the
  compiler.
- **More machinery:** a plugin project, an executor and a `createNodes` to maintain, against a
  root script's single file.
- **It relies on `@nx/dotnet` behaviour observed at 23.1.1:** the `static` edges, the
  `technologies` metadata and tags read from `project.json`. A plugin upgrade could change them.
- **Every .NET project needs correct tags and a kebab-case `name`.** The scaffolding generator
  (#219) is meant to guarantee that, and until it exists they are written by hand.

## More information

- ADR 0004 (`nx-module-boundaries`) — the matrix, its 2026-10-22 amendment on where it lives and
  how it is imported, and what the .NET check covers.
- ADR 0017 (`dotnet-backend`) — chose the do-it-yourself check, and records the scratch
  `@nx/dotnet` observations and item 5 (the thin host).
- ADR 0018 (`vitest-test-runner`) — the migration after which the matrix export can be
  reconsidered.
- Issues #195 (this check), #216 (moving the matrix into a shared module) and #219 (the
  scaffolding generator).
- `@nx-dotnet/core`: https://github.com/nx-dotnet/nx-dotnet — `check-module-boundaries.ts` and
  its spec under `packages/core/src/tasks/`, and `addPrebuildMsbuildTask` in
  `packages/core/src/generators/utils/generate-project.ts` for the MSBuild hook.
- Code: `tools/nx/utils/src/lib/nx-dep-constraints.utils.ts`, `nx-dep-constraints.const.mts`,
  and `tools/dotnet/plugin`.
