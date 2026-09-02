# 6. Typed linting — type-aware ESLint rules via the base config

- Status: accepted
- Date: 2026-09-02
- Deciders: djmcgrath
- Implemented by: the typed-linting blocks in `eslint.config.mjs`; the `@nx/js:library`
  generator default in `nx.json` left at `enableTypedLinting: false`; this ADR +
  `docs/agents/conventions.md` §8 note

## Context and problem statement

`typescript-eslint`'s highest-value rules need type information — a TypeScript program
loaded at lint time: `no-floating-promises`, `no-misused-promises`, `await-thenable`,
`no-unnecessary-condition`, `restrict-template-expressions`, `no-unsafe-*`. Without them
`nx lint` is a syntactic check that never sees an un-awaited promise or a condition that
is always truthy. This workspace ships Angular browser apps and NestJS services (ADR 0005) — both async-heavy — so those are exactly the bugs worth catching before review.

Nx exposes type-aware parsing per project as `@nx/js:library --enableTypedLinting`
(default `false`; its schema says "We do not enable this by default for lint performance
reasons"). That flag only wires the **parser** into the generated project's own
`eslint.config.mjs` — `parserOptions.projectService` + `tsconfigRootDir`. It does **not**
add any type-aware **rules**; `@nx/eslint`'s shared config is the non-type-checked
`recommended` set.

So there are two independent choices — where the parser wiring lives, and which ruleset
runs — and two places they could live: per project (each lib opts in through the
generator flag) or centrally (the workspace base `eslint.config.mjs`).

## Decision drivers

- The async-bug rules should fail `nx lint`, not wait for a reviewer.
- One place to change the ruleset, applied across the whole workspace — the same
  principle as ADR 0004's boundary matrix.
- A new lib should need zero per-project lint wiring — no typed-linting parser stanza in
  its own `eslint.config.mjs`.
- Don't pay the `strictTypeChecked` noise tax to get the `recommendedTypeChecked` signal.

## Considered options

1. **Central** — `recommendedTypeChecked` + parser wiring in the base config, scoped to
   TS extensions; the generator's `enableTypedLinting` left off.
2. **Per project** — `enableTypedLinting: true` as the generator default, each lib
   carrying its own parser block; a central rules block still required on top.
3. **Central with `strictTypeChecked`** instead of `recommendedTypeChecked`.
4. **No typed linting** — stay on the non-type-checked `recommended` set.

## Decision outcome

Chosen option: **1 — central, `recommendedTypeChecked`.**

- Option 2 drifts: whether a lib is type-linted depends on the flag passed at generation,
  the parser stanza (the `project: null` conflict workaround plus `tsconfigRootDir`) is
  copied into and maintained in every lib's config, and it _still_ needs a central rules
  block — so the config ends up in two places instead of one. The lint-performance
  concern that motivates Nx's per-project default is real, but the mitigations are
  `nx affected` plus Nx Cloud cache in CI, and `projectService` (faster than the legacy
  `project` glob) in editors. A lib that turns out pathological can opt out with a local
  `disableTypeChecked` override — the inverse of opting in.
- Option 3's `no-unsafe-*` family fires at every boundary with an `any`-typed or untyped
  value; in practice most of it gets switched off. `recommendedTypeChecked` is the
  baseline; individual strict rules can be promoted later.
- Option 4 gives up the one class of check nothing else provides — a floating promise, or
  an `async` function passed where a `void` callback is expected (a click handler that
  never awaits). For this stack that is the whole point.

### How it is wired in `eslint.config.mjs`

- `tseslint.configs.recommendedTypeChecked` is spread into the array, with
  `files: ['**/*.{ts,tsx,cts,mts}']` `.map`ped onto each entry. This keeps the export a
  plain array, consistent with the existing `nx.configs[...]` spreads, rather than
  wrapping everything in `tseslint.config()` to get scoped `extends`.
- A following block sets `languageOptions.parserOptions.projectService: true` plus
  `tsconfigRootDir: import.meta.dirname`, **after** the ruleset spread so
  `recommendedTypeChecked`'s base entry cannot overwrite `parserOptions`.
- `**/*.{js,cjs,mjs,jsx}` gets `tseslint.configs.disableTypeChecked` — config files
  (`eslint.config.mjs`, jest configs, generator scripts) are outside every TS program and
  type-aware rules error there ("parserServices" / "not found by the project service").
- `**/*.{spec,test}.{ts,tsx,cts,mts}` turns off `no-unsafe-argument`,
  `no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-member-access`, `no-unsafe-return`,
  and `unbound-method` — spec code leans on `any` from mocks and fixtures.
  `no-floating-promises` deliberately stays **on**: an un-awaited promise in a test means
  the assertion never runs and the test passes green.

### Locked parameters

- **Ruleset is `recommendedTypeChecked`, TS extensions only** (`.ts .tsx .cts .mts`).
  Moving to `strictTypeChecked`, or widening the file globs, requires reopening this ADR.
  Promoting or demoting an individual rule is a normal `eslint.config.mjs` edit.
- **Parser wiring is `projectService: true` + `tsconfigRootDir`, central, set after the
  ruleset spread.** Not `parserOptions.project` (the legacy per-tsconfig glob).
- **Lib generators are not set to `enableTypedLinting: true`.** They stay at the schema
  default (`false`), so a non-buildable `@nx/js` lib's generated `eslint.config.mjs` is
  `[...baseConfig]` only and the parser wiring is never copied per project.
  `@nx/nest:library` and `@nx/angular:library` do not read the `@nx/js:library` default
  anyway; if either grows its own parser wiring it must be turned off there too.
- **`disableTypeChecked` on JS/CJS/MJS and the test-file relaxation are part of the
  contract** — a config that removes them will fail on config files, or drown spec files
  in `no-unsafe-*`.
- **ESLint flat config does not read `.gitignore`.** A git-ignored directory that
  contains `.ts` / `.mts` / `.cts` files needs an explicit `ignores` entry or
  `projectService` fails the lookup for those files. `**/.remember` is listed for this
  reason; add others as they appear.

## Consequences

### Positive

- Floating / misused promises, always-true conditions, unsafe `any` flow, and
  `restrict-template-expressions` fail `nx lint` for every project, from one config
  block.
- A new lib needs no per-project lint wiring. Verified against `@nx/eslint` 23.1.1: a
  non-buildable `@nx/js:library` (the `bundler: none` default) generates exactly
  `export default [...baseConfig];`. A buildable lib adds one `files: ['**/*.json']`
  block for `@nx/dependency-checks`, and `@nx/angular:library` adds `@angular-eslint`
  blocks — both are framework / tooling config, not typed-linting wiring.
- Changing the ruleset workspace-wide is a one-line edit.
- Typed linting is orthogonal to ADR 0003 (bundle-hygiene import bans) and ADR 0004
  (module-boundary tags) — it rides `parserOptions`, not `depConstraints`, so the three
  lint policies compose without interacting.

### Negative / risks

- Type-aware linting loads the type-checker: `nx lint` on a project, and editor lint, are
  slower than syntactic linting. `nx affected` plus Nx Cloud remote cache absorb CI; the
  editor cost is the one a developer feels, and a pathological lib can opt out locally.
- A `.ts` / `.mts` / `.cts` file that no project `tsconfig` includes fails with a
  project-service parsing error — hit immediately on a `.remember` scratch file during
  rollout. Fix: a `tsconfig` `include`, an `ignores` entry, or a glob under
  `projectService.allowDefaultProject`.
- Inert until projects have a `lint` target and CI runs it — same caveat as ADR 0003 /
  0004, and **unverified against a real graph** (no projects yet). The `@nx/js:library`
  scaffold's 3-file tsconfig split — an empty-`include` root `tsconfig.json` delegating to
  `tsconfig.lib.json` / `tsconfig.spec.json` via `references` — needs a deliberate check
  that `projectService` resolves `src/**/*.ts` types through it on the first real lib.
- The `disableTypeChecked` and test-override blocks are maintenance surface: a new
  type-aware rule category in a future `typescript-eslint` release may need adding to
  them.
- Pinned to `typescript-eslint` 8.x flat-config shapes (`configs.recommendedTypeChecked`
  as an array, `configs.disableTypeChecked` as one object). A major upgrade should
  re-check the spread / `.map` wiring.

## More information

- `eslint.config.mjs` — the ruleset spread, the parser-wiring block, the
  `disableTypeChecked` block for JS/CJS/MJS, the test-file override, and the `.remember`
  `ignores` entry.
- `nx.json` — `generators."@nx/js:library"` defaults (`bundler: none`,
  `unitTestRunner: jest`); `enableTypedLinting` is left at its `false` default.
- ADR 0003 (`frontend-bundle-hygiene`) and ADR 0004 (`nx-module-boundaries`) — the other
  two lint-policy ADRs. Both use `@nx/enforce-module-boundaries` `depConstraints`; typed
  linting does not, and is independent of the tag matrix.
- ADR 0005 (`application-frameworks`) — Angular + NestJS, the async-heavy stack these
  rules target, and the path-alias TypeScript layout `projectService` resolves against.
- `docs/agents/conventions.md` §8 "Coding standards" — points here.
- `typescript-eslint` docs: "Linting with Type Information"; `recommendedTypeChecked` vs
  `strictTypeChecked`; `parserOptions.projectService` and `disableTypeChecked`.
- `@nx/js:library` generator schema — `enableTypedLinting` (default `false`, "For flat
  configs, this configures the recommended `parserOptions.projectService` and
  `tsconfigRootDir` … We do not enable this by default for lint performance reasons").
