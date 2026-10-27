# eslint-utils

Workspace tooling for ESLint (`scope:tools`, not application code).

## Contents

- **`bin/eslint-fix-mechanical`** — the pre-commit ESLint runner behind `lint-staged`. It applies
  autofixes for the rules in `mechanical-rules` only and reports every other finding, so a rule
  whose fixer can change behaviour fails the commit instead of being rewritten. Plain CommonJS so
  bare `node` loads it with no build step. To allow another rule, add it to `MECHANICAL_RULES` only
  if its fix cannot change what the code does.

## Tests

`nx test eslint-utils` — Jest via `ts-jest`.
