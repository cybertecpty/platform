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
  `tsc --noEmit -p {projectRoot}/tsconfig.spec.json` from `nx.json`
  `targetDefaults.typecheck`; CI runs it via `nx affected -t ... typecheck` on a PR and `nx run-many` on a push. A new
  project needs both the stub and a `tsconfig.spec.json` (spec-less projects are
  fine — `files: []` in the base `tsconfig.json` suppresses `TS18003`). The
  `nx-plugin` generator emits the stub for scaffolded plugins. See issue #48.
  - **The lib source is checked only through `tsconfig.spec.json`.** Specs import the source,
    so it is type-checked with the spec config's `types`, which must include `node` for
    `jest.config.cts` (`module.exports`). Narrowing `types` in `tsconfig.lib.json` (e.g.
    dropping `node` so a `scope:shared` lib can't use `process`) therefore changes only what
    the editor shows, not what `typecheck` or CI catches.
- A stray `.ts` file outside every project `tsconfig` fails typed-lint project-service
  resolution — add it to a `tsconfig`, the ESLint `ignores` list, or
  `projectService.allowDefaultProject`.
