# git-utils

Workspace tooling for git and commit workflows (`scope:tools`, not application code).

## Contents

- **`commitlint-formatter`** — the terse failure formatter used by
  `commitlint.config.mjs`. Kept as a `.ts` file loaded directly by `node` (the
  `commit-msg` hook and the `commitlint` CI job); see the header comment in
  `src/lib/commitlint-formatter.ts` for the load-time constraints.

## Tests

`nx test git-utils` — Jest via `ts-jest`.
