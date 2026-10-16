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
  footguns), `eslint-plugin-jest` `flat/recommended` on spec / mock files
  (`.claude/rules/testing.md`), `@typescript-eslint/no-deprecated` on all TS (flags
  `@deprecated` symbols — the one `strictTypeChecked` rule promoted), and
  `@eslint-community/eslint-plugin-eslint-comments`.
  Adding or removing a whole plugin, or swapping its preset, is an ADR 0008 change;
  promoting or demoting an individual rule is a normal config edit.
- `eslint-comments` details: `require-description` and `no-unlimited-disable` are errors, and
  ESLint's `reportUnusedDisableDirectives` flags stale ones. A block `/* eslint-disable rule */`
  needs a matching `/* eslint-enable rule */`.
