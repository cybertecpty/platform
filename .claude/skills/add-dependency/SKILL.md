---
name: add-dependency
description: >
  Checklist for adding or swapping a runtime or dev dependency in platform (pnpm add, a new
  npm package, an Nx plugin, a utility or validation library). Use before running pnpm add, or
  when deciding between a package and a few lines of our own code.
---

# Add a dependency

Moved here from `docs/agents/conventions.md` §8 "Dependency reuse".

Before adding a runtime or dev dependency, check whether the workspace already
covers it — an existing dependency, an Nx plugin, or a shared helper.

- Prefer a well-supported third-party package over a custom implementation when it
  meaningfully cuts risk, maintenance, or complexity. Prefer a few lines of our
  own code over a dependency for trivial logic.
- Vet a candidate before adding it: maintenance and release cadence, adoption,
  security posture (open advisories, `pnpm audit`), license compatibility,
  TypeScript support, and runtime / bundle impact.
- Add or update tests for the integration behavior and failure modes the new
  dependency introduces — don't lean on its own test suite.
- Some packages ship an import entry point that defeats bundler tree-shaking.
  Before adding a utility or validation library, check
  `docs/adr/0003-frontend-bundle-hygiene.md` for the entry-point rules — `lodash`
  → `lodash-es` workspace-wide, `zod` → `zod/mini` in `scope:frontend` and
  `scope:shared` code, both lint-enforced.
- Adding a dependency is a `build` change (`build(deps): ...`); if it sets a
  durable technical direction, it may also warrant an ADR (`write-adr` skill).
- Framework capability (`@angular/*`, `@nestjs/*`) comes through `@nx/angular` / `@nx/nest`
  generators and `nx add`, not hand-installed packages (conventions §11).
