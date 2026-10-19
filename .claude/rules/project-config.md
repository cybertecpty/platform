---
paths:
  - '**/project.json'
  - '**/tsconfig*.json'
  - 'nx.json'
---

# Project & TypeScript configuration

Moved here from `docs/agents/conventions.md` §8, §9 and §11. Loads when editing `project.json`,
`tsconfig*.json`, or `nx.json`.

- `tsconfig*.json` must be plain JSON, no comments.
- **TypeScript layout is path-alias, not project references** (ADR 0005). Projects are
  wired through `tsconfig.base.json` `compilerOptions.paths`; there is no `composite`
  setup and no `@nx/js/typescript` plugin. Angular cannot use project references — don't
  re-introduce them. Let generators add `paths` entries; don't hand-edit unless fixing a
  generator gap.
- **No `baseUrl` in `tsconfig.base.json`.** `moduleResolution: "bundler"` resolves
  `paths` relative to the config file, so `baseUrl` is redundant — and TS 6.0 makes it a
  hard error (`TS5101`) under full-diagnostic consumers like `ts-jest`. If a generator
  re-adds it, remove it.
- **Every lib/tool project needs a `typecheck` stub.** Every lib/tool project carries a
  `"typecheck": {}` stub in its `project.json` that inherits
  `tsc --noEmit -p {projectRoot}/tsconfig.lib.json && tsc --noEmit -p {projectRoot}/tsconfig.spec.json`
  from `nx.json` `targetDefaults.typecheck`; CI runs it via `nx affected -t ... typecheck` on a PR
  and `nx run-many` on a push. A new project needs the stub, a `tsconfig.lib.json` and a
  `tsconfig.spec.json` (spec-less projects are fine — `files: []` in the base `tsconfig.json`
  suppresses `TS18003`). The `nx-plugin` generator emits the stub for scaffolded plugins. See
  issue #48.
  - **The lib source is checked twice: once with `tsconfig.lib.json`, then again through
    `tsconfig.spec.json`.** Specs import the source, so the spec pass type-checks it with the
    spec config's `types`, which must include `node` for `jest.config.cts` (`module.exports`).
    The lib pass is the one that enforces the lib config's narrower `types`.
  - **A `scope:shared` lib's `tsconfig.lib.json` must not load `node` types** (ADR 0004: shared
    code stays browser-safe), so a Node global like `process` or `Buffer` in its source fails
    `typecheck`. Set `types` explicitly (`[]`, or `["jest"]` for a testing lib) — with no
    `types`, every `@types` package loads, `node` included. The workspace `ts-lib` generator
    removes `node` for `--scope=shared`; a lib made any other way gets `node` from the Nx
    generator, so remove it by hand. `.github/scripts/shared-lib-types.test.cjs` (run by
    `pnpm verify` and CI) fails if any project tagged `scope:shared` loads it or has no
    `typecheck` target. See issue #164.
  - **The lib pass checks everything in `tsconfig.lib.json`'s `include`, test artifacts too.** A
    `*.mock.ts` or `*.fixture.ts` in a lib's `src` that uses `jest.fn()` fails with TS2304 unless
    the lib config's `types` has `jest` (a `type:testing` lib gets it from the generator) or its
    `exclude` lists the artifact.
  - **The `scope:shared` guard has two blind spots.** It reads only `compilerOptions.types`, so
    Node types that arrive through a `/// <reference types="node" />` or a dependency's typings
    pass it, and it finds projects through `project.json` tags, not a `package.json` `nx.tags`
    field. Keep shared libs' tags in `project.json` and don't reference `node` types in them.
- A stray `.ts` file outside every project `tsconfig` fails typed-lint project-service
  resolution — add it to a `tsconfig`, the ESLint `ignores` list, or
  `projectService.allowDefaultProject`.
