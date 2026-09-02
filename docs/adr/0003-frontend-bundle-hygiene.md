# 3. Frontend bundle hygiene — restricted dependency entry points

- Status: accepted
- Date: 2026-09-02
- Deciders: djmcgrath
- Implemented by: `eslint.config.mjs` import-restriction rules; this ADR + `docs/agents/conventions.md` §8 note

## Context and problem statement

This workspace will ship Angular browser applications alongside NestJS services (framework
choice is a separate, pending ADR). Browser bundle size is a user-facing performance
concern, and some widely-used libraries ship an entry point that silently defeats
tree-shaking:

- **`lodash`** — the CommonJS main entry (`import _ from 'lodash'`) and the per-method
  paths (`lodash/pick`) pull the whole library into a bundle regardless of how much is
  used. The ESM distribution `lodash-es` tree-shakes correctly, and there is no downside
  to using it on the backend.
- **`zod`** — zod 4's classic API (`import { z } from 'zod'`, and the version-pinned
  `zod/v4` entry) is not tree-shakeable. Zod ships `zod/mini` (a functional,
  tree-shakeable API) plus `zod/v4/core` for error/type primitives. Backend code has no
  bundle budget and the classic API is materially nicer to write, so this constraint is
  frontend-only.

We want these constraints enforced mechanically at lint time, not left to code review,
and we want the reasoning recorded so the rules are not deleted the first time someone
hits the friction — `zod/mini` is deliberately more verbose than the classic API.

## Decision drivers

- A bundle regression should fail a check, not depend on a reviewer noticing an import.
- "Is this frontend?" should be answered by the same axis the rest of the workspace
  uses — the `scope:frontend` project tag (module-boundaries work, pending ADR) — not a
  parallel path convention.
- Type-only imports (`import type`) are erased at build and cost nothing; they must not
  be blocked.
- Backend developer experience should not pay for a browser constraint.

## Considered options

1. **Lint-enforced restricted imports** — ban the non-shakeable entry points; steer to
   the shakeable ones via the rule message.
2. **Bundle-size budgets** (`size-limit`, bundler asset-size limits, Angular `budgets`).
3. **Convention only** — document the preference, rely on review.

## Decision outcome

Chosen option: **1 — lint-enforced restricted imports**, with option 2 as a
complementary future addition, not a substitute.

- Option 2 catches a regression _after_ it lands and only in aggregate — it reports that
  the bundle grew, not which import did it, and not at the point the code is written.
  Worth adding later as a backstop; it does not remove the need for the import rule.
- Option 3 is what we are trying to avoid — the constraint is invisible until someone
  measures, and `lodash` / `zod` are exactly the imports muscle memory reaches for.

### Locked parameters

- **lodash — workspace-wide.** `lodash` and `lodash/*` are banned in all source
  (`**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}`); use `lodash-es`. Enforced by
  `@typescript-eslint/no-restricted-imports` (the TS-aware rule, `allowTypeImports: true`
  per entry so `import type` passes); the base `no-restricted-imports` is set to `off` in
  the same block to avoid double-reporting.
- **zod — `scope:frontend` only.** `zod` and `zod/v4` are banned for projects tagged
  `scope:frontend`, via `bannedExternalImports` on that tag's `depConstraints` entry in
  `@nx/enforce-module-boundaries`. Frontend code uses `zod/mini` for schema builders and
  `zod/v4/core` for error/type primitives. `zod/mini`, `zod/v4/mini` and `zod/v4/core`
  stay allowed — the bans are exact-match, not prefix (verified against Nx's
  `mapGlobToRegExp`).
- **The zod ban rides with `scope:frontend` tagging.** Until the module-boundaries matrix
  lands, the `scope:frontend` `depConstraints` entry exists solely to carry
  `bannedExternalImports`; its `onlyDependOnLibsWithTags` is `['*']` (graph
  unconstrained). When the real matrix is written, the ban stays on that entry. Widening
  either ban, or moving zod off the frontend scope, requires reopening this ADR.
- **Shared dependencies stay single-version in the root `package.json`** (`lodash-es`,
  `zod`), per the pnpm single-version policy (ADR 0001).

## Consequences

### Positive

- A disallowed import fails `nx lint` with a message that names the replacement.
- The frontend/backend split is expressed once, on the `scope:frontend` tag, and reused
  here rather than duplicated as a file glob.
- `import type` from either library is unaffected.

### Negative / risks

- Frontend validation code uses `zod/mini`'s functional API, which is more verbose than
  `z.string().min(5)`. This is the accepted cost of a tree-shakeable schema layer in the
  browser; the rule message points at the mini docs.
- Both rules are inert until a project has a `lint` target and CI runs it — and the zod
  ban additionally needs `scope:frontend` tags to be assigned. Adding a frontend project
  without the tag silently opts it out.
- `zod/v3` (the v3 compatibility API, also not tree-shakeable) is **not** currently
  banned. Add it to `bannedExternalImports` if v3-compat imports appear in frontend code.
- The mechanism is a denylist, not a bundler-level guarantee: a non-shakeable entry point
  in a future dependency is not caught until someone adds a rule for it.

## More information

- `eslint.config.mjs` — the `@typescript-eslint/no-restricted-imports` block and the
  `scope:frontend` `depConstraints` entry.
- `docs/agents/conventions.md` §8 "Dependency reuse" — points here for entry-point
  constraints when adding a utility or validation library.
- The module-boundaries ADR (pending) defines the full `scope:` / `type:` / `domain:` tag
  matrix; its `scope:frontend` entry carries the zod `bannedExternalImports` list.
- zod docs: "Zod Mini" (the tree-shakeable API) and `zod/v4/core` (shared error/type
  primitives). lodash: `lodash-es` is the ESM build; the `lodash` CJS package and
  `lodash.*` per-method packages do not tree-shake in a bundler.
