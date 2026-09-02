# 8. ESLint plugin layer — NgRx, Jest, deprecation, and directive-comment rules

- Status: proposed
- Date: 2026-09-02
- Deciders: djmcgrath
- Implemented by: the NgRx, Jest, `no-deprecated`, and `eslint-comments` blocks in
  `eslint.config.mjs`; the `@ngrx/eslint-plugin`, `eslint-plugin-jest`, and
  `@eslint-community/eslint-plugin-eslint-comments` devDependencies; this ADR +
  `docs/agents/conventions.md` §8 / §9 notes

## Context and problem statement

After ADRs 0003, 0004, and 0006 the workspace `eslint.config.mjs` is: `@nx/eslint`'s
`recommended` set, the `lodash` / `zod` bundle-hygiene import bans (0003), the
`@nx/enforce-module-boundaries` scope/type/domain matrix (0004), and
`typescript-eslint`'s `recommendedTypeChecked` type-aware rules (0006). That base is
deliberately **framework- and tooling-agnostic** — it knows TypeScript and the Nx
project graph, nothing else.

Four gaps sit outside what a generic ruleset can see:

1. **NgRx SignalStore footguns.** `signalStore` / `signalState` have failure modes a
   generic linter cannot recognize — unprotected mutable state, a store feature written
   without its generic type parameter, `type()` calls that should be `type<T>()`. NgRx
   ships `@ngrx/eslint-plugin` for exactly this. ADR 0005 locks Angular as the frontend
   stack and SignalStore is its state library, so the rules will have targets.

2. **Jest test smells.** A `fit` / `fdescribe` / `.only` left in a file silently runs a
   _partial_ suite green in CI. An `expect(x)` with no matcher asserts nothing. Two
   `it()` blocks with identical titles hide one result. `nx lint` on `recommended` sees
   none of this. `eslint-plugin-jest`'s `flat/recommended` does, and ADR 0007 makes Jest
   the runner for every project.

3. **Deprecated-API use.** `@typescript-eslint/no-deprecated` flags any symbol annotated
   `@deprecated`. It lives in `strict-type-checked`, which ADR 0006 deliberately did
   _not_ adopt (its `no-unsafe-*` family is too noisy) — but 0006 explicitly left the
   door open to promoting individual strict rules. Angular 22 and NestJS 11 (ADR 0005)
   deprecate across minor versions; catching a deprecated call at lint time beats
   discovering it during an `nx migrate`.

4. **Lint-suppression hygiene.** A deliberately strict ruleset (bundle bans, boundary
   matrix, ~40 type-aware rules) generates friction, and friction gets resolved with
   `// eslint-disable-next-line`. Without a rule forcing it, those comments are
   unnamed (`eslint-disable` with no rule id turns off _everything_ on that line),
   unexplained, and never cleaned up when the underlying code changes.

## Decision drivers

- The base ruleset is framework-agnostic by design; framework- and tool-aware checks
  are a separate, additive layer — not edits to the base.
- One central config, applied across the whole workspace — the same principle as ADR
  0004's boundary matrix and ADR 0006's typed linting.
- A lint suppression should be auditable: which rule, and why.
- Don't take on a plugin whose value is speculative at zero projects — but a plugin
  whose rules are **inert until matching code exists** (NgRx, Jest) costs nothing to
  wire early, and `no-deprecated` / `eslint-comments` pay off from the first file.
- Framework plugin rules should not leak onto code they don't apply to (NgRx rules on
  a NestJS service, Jest globals in production code).

## Considered options

Per gap, the choice was _add now_ / _defer to first relevant project_ / _don't add_,
plus a preset choice for each plugin and a scoping choice for NgRx.

- **NgRx** — `configs.signals` vs `configs.all` vs `configs.signalsTypeChecked`; and
  scope by `**/*.ts` / `{apps,libs}/**/*.ts` / a per-project spread / a `**/*.store.ts`
  filename glob.
- **Jest** — `flat/recommended` vs `flat/all`; scoped to spec + mock files.
- **`no-deprecated`** — promote the single rule vs adopt `strictTypeChecked` wholesale
  (rejected by 0006) vs leave it off.
- **`eslint-comments`** — `recommended` alone vs `recommended` + `require-description`
  vs also `no-use` / `no-restricted-disable`; plus ESLint's built-in
  `reportUnusedDisableDirectives`.

## Decision outcome

**Add all four**, as four additive blocks after the base rules and before
`eslint-config-prettier`.

### NgRx — `configs.signals`, scoped `{apps,libs}/**/*.ts`

- **`configs.signals`, not `configs.all`.** `signals` is the SignalStore-only subset —
  `enforce-type-call`, `prefer-protected-state`,
  `signal-store-feature-should-use-generic-type`. `all` additionally bundles the classic
  Store / Effects / component-store rules for APIs this workspace may never use. If
  classic NgRx appears, add `configs.store` / `configs.effects` then.
- **Not `configs.signalsTypeChecked`.** Its extra rules
  (`signal-state-no-arrays-at-root-level`, `with-state-no-arrays-at-root-level`) are
  opinions about state shape, and adopting it would make NgRx the first _type-checked_
  plugin config in the workspace. Revisit once there is real SignalStore code to judge
  the rules against.
- **Scoped `{apps,libs}/**/*.ts`.** ESLint flat-config `files` matches paths only, and
  ADR 0003 deliberately makes browser-reachability a `scope:frontend` **tag** with no
  parallel path convention — so the config cannot say "frontend" directly. The options:
  - `**/*.ts` — simplest; the rules are inert on non-NgRx files anyway, but a future
    rule that matched a backend construct would fire spuriously.
  - a per-project spread into each Angular project's generated `eslint.config.mjs` —
    tag-aligned and enforced, but that is per-project boilerplate (or a custom
    generator) for every Angular project.
  - `**/*.store.ts` — tight, but depends on file-naming discipline.
  - `{apps,libs}/**/*.ts` — coarse (it still covers NestJS apps and libs), needs no
    per-project wiring, and keeps the rules off `tools/**` and root scripts.

  Chose `{apps,libs}/**/*.ts` as the cheapest defensible option while there are no
  projects. The eventual Angular ADR takes the final scoping call — tighten to a
  per-project spread, or accept the glob.

### Jest — `flat/recommended`, on spec and mock files

- **`flat/recommended`, not `flat/all`.** `flat/all` turns on style opinions
  (`prefer-lowercase-title`, `max-expects`, `prefer-strict-equal`) that are a separate
  debate. `flat/recommended` is the bug-catching core: `no-focused-tests`,
  `no-disabled-tests`, `no-identical-title`, `valid-expect`, `expect-expect`,
  `no-conditional-expect`.
- **Files: `**/*.{spec,test}.ts` and `**/*.{mock,mocks}.ts`.** Spreading
  `flat/recommended` also installs the Jest globals (`describe`, `it`, `expect`) for
  those files.
- **The block also relaxes four base rules that fight test code:**
  - `@nx/enforce-module-boundaries: 'off'` — spec and mock files legitimately pull in
    test-helper libs and fixtures across scope/type boundaries, and `type:testing` libs
    are already `type:*`-broad under ADR 0004.
  - `@typescript-eslint/no-empty-function`, `no-explicit-any`, `no-non-null-assertion`
    off — mock stubs, `any`-typed fixture access, and `!` on known-present test data.

  This layers on ADR 0006's spec-file relaxation (the `no-unsafe-*` family +
  `unbound-method`) — same file-glob family, complementary rule sets.

### `@typescript-eslint/no-deprecated` — the one promoted strict rule

- `'error'`, its own block, `**/*.{ts,tsx,cts,mts}` — the same TS-only glob as ADR
  0006's typed linting. It reuses 0006's parser wiring (`projectService` +
  `tsconfigRootDir`) and is turned back off for JS/CJS/MJS by 0006's existing
  `disableTypeChecked` block.
- This is the individual strict-rule promotion 0006 anticipated ("individual strict
  rules can be promoted later"), not a move to `strictTypeChecked`.

### `eslint-comments` — `recommended` + `require-description` + built-in unused-check

- **`eslintComments.recommended`** — `disable-enable-pair` (a block `/* eslint-disable
*/` needs a matching `eslint-enable`), `no-unlimited-disable` (a disable must name
  rules), `no-duplicate-disable`, `no-unused-enable`, `no-aggregating-enable`. All code
  extensions.
- **plus `require-description: 'error'`** — not in `recommended`; forces every directive
  comment to carry a reason.
- **plus `linterOptions.reportUnusedDisableDirectives: 'error'`** — a global config
  entry (no `files`). This is the ESLint built-in that superseded
  `eslint-comments/no-unused-disable`, which the plugin deprecated in 4.7.0.
- **`no-use` and `no-restricted-disable` stay off** — too blunt (they ban directive
  comments outright / by rule).

Net contract: every `eslint-disable` in the repo must name specific rules, carry a
description, pair with an `eslint-enable` when it is a block disable, and not be dead.

### Locked parameters

- **NgRx config is `configs.signals`, scoped `{apps,libs}/**/*.ts`.** Switching to
  `configs.all` or `configs.signalsTypeChecked`, or changing the scoping strategy,
  reopens this ADR — or the Angular ADR takes the scoping decision explicitly.
- **Jest config is `flat/recommended`** on `**/*.{spec,test}.ts` +
  `**/*.{mock,mocks}.ts`. The four rule relaxations in that block
  (`@nx/enforce-module-boundaries`, `no-empty-function`, `no-explicit-any`,
  `no-non-null-assertion`) are part of the contract — a change that removes them will
  drown spec files, and one that keeps `enforce-module-boundaries` on will flag
  legitimate fixture imports.
- **`@typescript-eslint/no-deprecated` is `error`, TS extensions only**, riding ADR
  0006's parser wiring and `disableTypeChecked`. It is the only `strictTypeChecked`
  rule promoted; adopting more is a normal `eslint.config.mjs` edit, adopting the whole
  set reopens ADR 0006.
- **`eslint-comments` is `recommended` + `require-description: error` +
  `reportUnusedDisableDirectives: error`.** `no-use` and `no-restricted-disable` stay
  off.
- **Curating an individual rule** within an adopted preset (promote, demote, add an
  option) is a normal `eslint.config.mjs` edit. **Adding or removing a whole plugin, or
  swapping its preset**, reopens this ADR.

## Consequences

### Positive

- NgRx SignalStore mistakes, left-in focused tests, missing assertions, deprecated-API
  use, and unaudited lint suppressions all fail `nx lint`, from one central config.
- Composes cleanly with ADRs 0003 / 0004 / 0006: the NgRx and Jest blocks ride
  `plugins` + `rules`, `no-deprecated` rides 0006's `parserOptions`, `eslint-comments`
  is rule-only. None touch `@nx/enforce-module-boundaries` `depConstraints`, so the
  policies do not interact.
- Every `eslint-disable` written from here carries a rule id and a reason — greppable
  and reviewable, and dead ones are flagged.
- The framework plugins are wired before the first Angular project exists, so that
  project's first SignalStore is linted on day one with no per-project setup.

### Negative / risks

- **`require-description` is real friction** — no more quick bare
  `// eslint-disable-next-line`. Deliberate; called out in conventions §8 so it is not a
  surprise.
- **The NgRx `{apps,libs}` glob is the path convention ADR 0003 avoided.** A NestJS file
  that somehow tripped an `@ngrx/*` rule would get a spurious error. Unlikely — the
  rules match SignalStore call shapes — but the escape hatch is per-project scoping,
  deferred to the Angular ADR.
- **The Jest block turns `@nx/enforce-module-boundaries` off for specs**, which diverges
  from Nx's generated per-project configs (they keep it on). A frontend spec importing a
  backend lib will not be flagged at lint time. Accepted: `type:testing` libs are
  already `type:*`-broad, specs legitimately wire fixtures across boundaries, and a spec
  reaching into production code it should not is a code-review catch (review-priorities
  §10), not a lint one.
- **`no-deprecated` depends on upstream `@deprecated` JSDoc accuracy** — false negatives
  where a dependency under-annotates. It also adds a type-aware rule, but 0006 already
  pays the type-checker cost.
- **Four more version pins** across ESLint 9 / `typescript-eslint` 8 major bumps.
  `@ngrx/eslint-plugin` tracks the NgRx major line (22.x alongside Angular / NgRx 22) —
  an `nx migrate` of Angular must bump it in lockstep or the plugin's peer range breaks.
- **No projects yet** — the NgRx and Jest rules are unexercised against real
  application code (the same caveat as ADRs 0003 / 0004 / 0006 / 0007). Verified only
  against probe files: `jest/no-focused-tests` on a `.test.ts`,
  `@typescript-eslint/no-deprecated` on a locally-annotated symbol, and
  `eslint-comments/require-description` on a bare directive.

## More information

- `eslint.config.mjs` — the NgRx block, the Jest block, the `no-deprecated` block, and
  the `linterOptions` + `eslint-comments` blocks, all between the bundle-hygiene block
  and `eslint-config-prettier`.
- `package.json` — the three devDependencies: `@ngrx/eslint-plugin` (tracks the NgRx
  major), `eslint-plugin-jest`, `@eslint-community/eslint-plugin-eslint-comments`.
- ADR 0003 (`frontend-bundle-hygiene`) and ADR 0004 (`nx-module-boundaries`) — the
  import-ban and boundary-matrix lint policies this layers on; also the source of the
  "no frontend path convention" constraint behind the NgRx scoping decision.
- ADR 0006 (`typed-linting`) — the `recommendedTypeChecked` base, the parser wiring and
  `disableTypeChecked` block `no-deprecated` reuses, and the spec-file relaxation the
  Jest block extends.
- ADR 0005 (`application-frameworks`) — Angular + NestJS, the stacks the NgRx and Jest
  plugins target.
- ADR 0007 (`jest-test-runner`) — Jest as the runner `eslint-plugin-jest` lints for.
- `docs/agents/conventions.md` §8 "Coding standards" (the plugin layer + the
  `eslint-disable` contract) and §9 "Testing & verification" (the Jest lint rules).
- Plugin docs: `@ngrx/eslint-plugin` rule reference; `eslint-plugin-jest`
  `flat/recommended`; `@typescript-eslint/no-deprecated`;
  `@eslint-community/eslint-plugin-eslint-comments` `require-description` +
  `disable-enable-pair`; ESLint `linterOptions.reportUnusedDisableDirectives`.
