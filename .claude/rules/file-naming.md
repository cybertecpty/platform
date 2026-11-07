---
paths:
  - '{libs,tools}/**/src/**/*.{ts,mts}'
---

# Naming source files

Loads when working on a library or tool source file. Test artifacts (`.mock`, `.stub`, `.fake`,
`.fixture` and their plurals) are in `testing.md`; this file covers the production side.

## The rule

A module in a lib or tool carries a suffix naming what it holds, as `<name>.<kind>.ts`. The
name says the topic (`git-tags`, `release-branch`), and the suffix is singular or plural by how
much the file exports, the same way as `.fixture` / `.fixtures` in `testing.md`:

| Suffix                  | For                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `.util`                 | one util: a function or class, with the types and subclasses that support it        |
| `.utils`                | a set of related functions named for a topic, or expected to grow into one          |
| `.types`                | types only, no runtime code (the `type:types` libs)                                 |
| `.const` (`.const.mts`) | constants only; keep the `.mts` extension when a tool loads the file as ESM by name |

- **Judge by the file's name and role, not today's export count.** A file named for one thing
  (`uniq-multi-map`, `file-archiver`) is `.util`; a file named for a topic (`records`,
  `git-tags`) is `.utils`, even while it holds one function, because the next function on that
  topic goes in the same file.
- **A base class with its subclasses is one util.** `file-archiver.util.ts` exports an abstract
  base, two subclasses and their types, and that is one `.util`: split them only if a subclass
  stops sharing the base's purpose.
- **Several unrelated functions are a smell, not a suffix.** Split the file by topic rather than
  rename it `.utils`.
- Specs mirror the full name: `git-tags.utils.spec.ts` tests `git-tags.utils.ts`, and a type-only
  `.types.ts` file has no spec (type-level tests use `.types.test-d.ts`).
- Inside a group's lib, keep the group prefix the other files use (`nx-tree.utils.ts` in
  `tools/nx/utils`).

## Exemptions

Files a tool loads by name or convention keep that name, and so does anything that is not a
module of helpers:

- `index.ts` (the barrel), `main.ts`, `generator.ts`, `executor.ts`, `schema.ts`
- `commitlint-formatter.ts`, which bare `node` loads by name (`commitlint.md`)
- `dependency-changelog-renderer.ts`, which `nx.json` loads by path (`release.changelog`)
- config files such as `jest.config.cts`, `eslint.config.mjs`, `vitest.config.mts`,
  `playwright.config.ts`
- template files under a `files/` folder, and `*.spec.ts` / `*.test-d.ts` files
- test artifacts, which follow `testing.md`

## Repeating the scan

List the source files that are neither exempt nor suffixed, then check each suffix against its
exports:

```bash
git ls-files 'libs/**/*.ts' 'tools/**/*.ts' | grep -vE '\.(spec|test-d|utils?|types|const|fixtures?|fakes?|mocks?|stubs?)\.m?ts$' | grep -vE '(^|/)(index|main|generator|executor|schema|commitlint-formatter|dependency-changelog-renderer)\.ts$|/files/|config\.'
```

A misnamed file is visible in review, so there is no lint rule for it.
