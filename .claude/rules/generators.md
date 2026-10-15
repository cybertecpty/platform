---
paths:
  - 'tools/*/plugin/**'
---

# Nx plugin generators & executors

Moved here from `docs/agents/conventions.md` §8. Loads when working in an Nx plugin project.

- Use template files with `generateFiles` for generator output whenever viable. Name
  those files with a `__tmpl__` suffix (e.g. `generator.ts__tmpl__`) and pass
  `{ tmpl: '' }` in the substitutions — not the `.template` suffix Nx also strips.
  `__tmpl__` is what the workspace already uses (`generators/plugin/files/src/lib/.gitkeep__tmpl__`),
  and a `__tmpl__` name falls outside the `src/**/*.ts` / `**/!(*.ts)` globs that lint,
  typecheck, and asset-copy would otherwise apply to it.
- Keep generator/executor folders to actual implementations; supporting constants,
  helpers, and types go in sibling `src/lib/defaults/`, `src/lib/utils/`, etc.

## Generator changes — update all surfaces together

1. `generator.ts` (runtime) 2. `schema.ts` (option types) 3. `schema.json` (CLI
   schema) 4. `generator.spec.ts` (unit coverage) 5. generator-local `README.md`.
