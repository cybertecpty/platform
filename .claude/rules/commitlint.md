---
paths:
  - 'tools/git/utils/**'
  - '.husky/**'
  - 'commitlint.config.mjs'
  - '.github/workflows/commitlint.yml'
---

# Commitlint formatter internals

Moved here from `docs/agents/conventions.md` §3. Loads when working on the commit-message
tooling.

The custom formatter lives in the `git-utils` project
(`tools/git/utils/src/lib/commitlint-formatter.ts`). It is a `.ts` file loaded by
**bare `node`** — no ts-jest, no bundler — so: `import type` only (a value import of a
type throws at load), erasable syntax only (no enums / namespaces / parameter
properties), and `NODE_OPTIONS=--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` in
`.husky/commit-msg` and `commitlint.yml` silences node's reparse notice. `engines.node`
is `>=22.18.0` because that is where native type stripping became unflagged.
