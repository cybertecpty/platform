# scripts

Executable workspace scripts (plain CommonJS, run by bare `node`, no build step). They are not
Nx projects; tests sit beside them as `*.test.cjs` and run through `node --test` in `pnpm verify`
and CI. Not named `bin/`: `.gitignore` ignores every `bin/` folder for .NET build output.

- **`eslint-fix-mechanical.cjs`** — the pre-commit ESLint runner behind `lint-staged`. It applies
  autofixes for the rules in `mechanical-rules.cjs` only and reports every other finding, so a rule
  whose fixer can change behaviour fails the commit instead of being rewritten. To allow another
  rule, add it to `MECHANICAL_RULES` only if its fix cannot change what the code does.
- **`dotnet-format-staged.cjs`** — the pre-commit `dotnet format` runner behind `lint-staged`. It
  converts the absolute paths lint-staged passes to repo-relative ones, because the `--include`
  option of `dotnet format` silently ignores an absolute Windows path (exit 0, nothing rewritten).
