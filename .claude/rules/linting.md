---
paths:
  - '**/eslint.config.mjs'
---

# ESLint configuration

Moved here from `docs/agents/conventions.md` §8. Loads when editing an ESLint config.

- Typed linting is on workspace-wide (ADR 0006): `typescript-eslint`'s
  `recommendedTypeChecked` runs against every `.ts` / `.cts` / `.mts` file via the base
  `eslint.config.mjs`, so `no-floating-promises`, `no-misused-promises`,
  `no-unnecessary-condition` and the rest fail `nx lint`. Per-project
  `enableTypedLinting` stays **off** (generator default) — the parser wiring is central,
  not copied into each lib. A lib that genuinely can't be type-linted adds a local
  `tseslint.configs.disableTypeChecked` override rather than the workspace opting out.
- On top of that base ruleset, `eslint.config.mjs` carries a **plugin layer** (ADR
  0008): `@ngrx/eslint-plugin` `configs.signals` on `{apps,libs}/**/*.ts` (SignalStore
  footguns), `eslint-plugin-jest` `flat/recommended` on spec files and test
  artifacts (`*.{mock,stub,fake,fixture}.ts` and plurals, `.claude/rules/testing.md`), `@typescript-eslint/no-deprecated` on all TS (flags
  `@deprecated` symbols — the one `strictTypeChecked` rule promoted),
  `@typescript-eslint/consistent-type-imports` (separate `import type` statements; Node's type
  stripping erases only those, and a plain import of a type from a `@cybertecpty/*` alias fails
  at load) with `no-import-type-side-effects`; the project service lets the rule read the
  decorator-metadata compiler options, so decorated classes keep their runtime imports (both
  rules are off for `*.{spec,test}.ts`, which Jest / Vitest transform),
  `@eslint-community/eslint-plugin-eslint-comments`, and a curated list of
  `eslint-plugin-unicorn` rules (never its preset), and `eslint-plugin-perfectionist`'s
  `sort-modules` alone on TS files, which enforces conventions §8's declaration order.
  Adding or removing a whole plugin, or swapping its preset, is an ADR 0008 change;
  promoting or demoting an individual rule is a normal config edit.
- `eslint-comments` details: `require-description` and `no-unlimited-disable` are errors, and
  ESLint's `reportUnusedDisableDirectives` flags stale ones. A block `/* eslint-disable rule */`
  needs a matching `/* eslint-enable rule */`.
- `sort-modules` details: types (`interface` / `type` / `enum`), then classes, exported functions,
  private functions, alphabetical within each; `eslint --fix` reorders. It never moves `const` /
  `let` and sorts only the runs of declarations between them (and between expression
  statements), so a type below a `const` is a reviewer catch. Don't enable perfectionist's import
  or export rules: `prettier-plugin-organize-imports` owns import order.
