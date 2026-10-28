# 19. Enforcing module boundaries between .NET projects with an inferred Nx executor

- Status: accepted
- Date: 2026-10-26
- Deciders: djmcgrath
- Implemented by: issue #195 (the check, its executor, its inferred target and the CI wiring),
  #216 (moving the matrix into a shared module)
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
- **The matrix** is `DEP_CONSTRAINTS` in `nx-dep-constraints.const.mts`. The executor gets it from
  `loadDepConstraints()` in `nx-utils`, which `require`s the file by absolute path (ADR 0004,
  2026-10-22 amendment).
- **The plugin** is registered in `nx.json` as `@cybertecpty/dotnet-plugin`, with the target name
  as its option, **in the change that adds the workspace's first .NET project**. Until then it
  stays unregistered, so the Node warning below does not print on every command for a check that
  has nothing to run. Its `createNodes` looks for `*.csproj`, `*.fsproj` and `*.vbproj` files and adds
  the target to the project in the folder of each.
- **Where it runs in CI:** `check-boundaries` is part of the `nx affected` and `nx run-many`
  target lists in the required `lint-and-test-affected` workflow, and of `pnpm verify`.
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

## Checked in a scratch workspace, and still unverified on a real project

A scratch workspace with `@nx/dotnet@23.1.1`, the real matrix and three class libraries that
reference each other (one reference forbidden) checked the following on Node 22.22:

- **The inferred target works.** `check-boundaries` appears on each project next to the plugin's
  own targets, with nothing about it in the `project.json` files.
- **The executor runs under Nx and loads the real matrix.** The project with only allowed
  references passes. The one with a forbidden reference fails with the `source -> target:`
  message, and `nx run-many` reports it.
- **Caching and invalidation work.** A second run with nothing changed is a cache hit, and
  changing a tag in a dependency's `project.json` re-runs the check and reports the new violation.
- **The plugin builds with `@nx/js:tsc`.**

What remains unverified:

1. **The CI Node version and the first real project.** The scratch run used the workspace's local
   Node. It needs to be repeated on the real walking skeleton, whose layout (nested test
   projects, the generated client) the scratch workspace did not have.
2. **The thin host.** The check enforces ADR 0004's ban on `type:testing` depending on
   `type:app`, so .NET integration tests that reference the app project fail it. ADR 0017's
   item 5 is to try a thin host first. If it is not enough, the fallback is a matrix change in
   ADR 0004.

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
- **The matrix is loaded by absolute path, not by an import.** Jest does not transform `.mts`
  files, and the transpiler Nx runs plugins with rewrites an import of an alias for one to a
  relative path with no extension. A first version of this design used a path alias with a
  dynamic `import()`. It failed under Nx, and the same alias also crashed TypeScript 6.0.3
  ("Debug Failure") when `@nx/js:tsc` built the plugin. The loader works from source, where the
  `.mts` file is. In a built copy of `nx-utils` the path falls back to the `.mjs` that `tsc`
  emits beside it, but that copy cannot run outside the workspace, because it requires the
  workspace alias `@cybertecpty/shared-utils`. That is fine, because Nx runs plugins and
  executors from source. The `require` is cast to its type, so the compiler
  does not check that call. After the Vitest migration (ADR 0018), check whether the matrix can
  be exported from the `nx-utils` barrel and the loader replaced by a plain import.
- **A Node warning on every Nx command when the daemon is off,** which is the default in CI. Nx
  23 loads a local TypeScript plugin with Node's native type stripping first. The plugin's
  package is CommonJS and its source uses `import`, so that attempt fails with "Failed to load
  the ES module" and Nx then falls back to its transpiler. Everything works, but the warning
  prints once per command, from the moment the plugin is registered (see above). Setting `NX_PREFER_NODE_STRIP_TYPES=false` removes it, at the cost of
  changing how Nx loads every TypeScript plugin, so it is not set here.
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
- ADR 0018 (`vitest-test-runner`) — the migration after which the matrix loader can be
  reconsidered.
- Issues #195 (this check), #216 (moving the matrix into a shared module) and #219 (the
  scaffolding generator).
- `@nx-dotnet/core`: https://github.com/nx-dotnet/nx-dotnet — `check-module-boundaries.ts` and
  its spec under `packages/core/src/tasks/`, and `addPrebuildMsbuildTask` in
  `packages/core/src/generators/utils/generate-project.ts` for the MSBuild hook.
- Code: `tools/nx/utils/src/lib/nx-dep-constraints.utils.ts`, `nx-dep-constraints.const.mts`,
  and `tools/dotnet/plugin`.

## Amendment (2026-10-27): registered, and checked on the first project

- Status: accepted
- Deciders: djmcgrath
- Implemented by: issue #229

The plugin is registered in `nx.json` with the first .NET project, as the locked parameters
required. On `gamers-source-api`, `gaming-collection-api`, `gaming-collection-services` and their tests
projects, the check passes
with allowed references and fails on a `type:testing` project that references a `type:app`
project, and it honours the `domain:*` wildcard of ADR 0004's 2026-10-27 amendment (the app references a lib of
another domain, and unit tests cover it; the forbidden edge was a manual run). Unverified
item 1 (the CI Node version and the real layout) is partly checked: the layout is real, but CI
has not run it yet. Nx prints the "Failed to load the ES module" Node warning once per command,
as predicted above.
