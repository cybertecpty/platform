---
paths:
  - '{libs,tools}/**/src/**/*.{ts,mts}'
---

# Naming source files

Loads when working on a library or tool source file. Test artifacts follow the same rule; their
kinds are in `testing.md`.

## The rule

Name a file after its main export, in kebab-case: `derivePort` is in `derive-port.ts`,
`defineAxeTests` in `define-axe-tests.ts`. A file with several equal exports takes the name of
their topic (`project-options.ts`, `nx-release-results.ts`). The name says what the file holds;
there is no suffix for the kind of module, so `.util`, `.utils`, `.types`, `.const`, `.contracts`,
`.mock`, `.stub`, `.fake` and `.fixture` are not used.

Three suffixes stay, because a tool or a framework convention reads them:

| Suffix    | Why                                                                           |
| --------- | ----------------------------------------------------------------------------- |
| `.spec`   | Vitest and the lint globs match it: `derive-port.spec.ts`                     |
| `.test-d` | Vitest's type-test runner matches it: `object-props.test-d.ts`                |
| `.routes` | Angular's convention for a route config, which the `ng-lib` generator follows |

- **A file named for one thing holds that thing and what supports it.** An abstract base with its
  subclasses and their types is one file named after the base: split it only if a subclass stops
  sharing the base's purpose.
- **Several unrelated exports are a smell.** Split the file by topic rather than inventing a
  catch-all name.
- **Don't repeat the lib's path in the name.** `playwright/testing` has `define-axe-tests.ts`, not
  `playwright-axe-tests.ts`. Keep a prefix only when the name would be ambiguous without it.
- **Don't reuse a name another lib already uses for something else.** Two files with
  the same name open as the same editor tab and read the same in a stack trace; name the second for
  what it does (`angular-plugin` has `vitest-config.ts` beside `nx-utils`' `vitest.ts`).
- **A spec mirrors its file's name**: `derive-port.spec.ts` tests `derive-port.ts`. A type-only
  file has no spec; its type-level tests are `<name>.test-d.ts`.
- **A tool that loads a file by name decides the extension, not the name.** Keep `.mts` on
  `dep-constraints-const.mts`, which bare Node and ESLint import as ESM.
- **`.routes` is named for the library.** A routed Angular library has one routes file, so the
  `ng-lib` generator names it after the library (`billing-feature.routes.ts`) instead of using
  Nx's `lib.routes.ts`.

## Exemptions

Files a tool loads by name or convention keep that name, and so does anything that is not a
module of helpers:

- `index.ts` (the barrel), `main.ts`, `generator.ts`, `executor.ts`, `schema.ts`
- `commitlint-formatter.ts`, which bare `node` loads by name (`commitlint.md`)
- `dependency-changelog-renderer.ts`, which `nx.json` loads by path (`release.changelog`)
- config files such as `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`
- template files under a `files/` folder, and `*.spec.ts` / `*.test-d.ts` files

## Repeating the scan

List the files that still carry a retired suffix:

```bash
git ls-files 'libs/**' 'tools/**' | grep -E '\.(util|utils|types|const|contracts|mocks?|stubs?|fakes?|fixtures?)\.m?ts(__tmpl__)?$'
```

Then check by eye that each remaining file is named for its main export or topic. There is no
lint rule for that, because a misnamed file is visible in review.
