# 22. Name source files after their main export, with no suffix for the kind of module

- Status: accepted
- Date: 2026-11-25
- Deciders: djmcgrath
- Implemented by: `.claude/rules/file-naming.md` and `.claude/rules/testing.md`; the test-artifact
  blocks in `eslint.config.mjs` (`testArtifactFiles`, `vitestTestCode`); the renames in #390
- Amends: ADR 0004 (2026-11-13 amendment), ADR 0008 (2026-10-17 amendment) and ADR 0017
  (2026-11-13 amendment); each carries a 2026-11-25 amendment pointing here

## Context and problem statement

`.claude/rules/file-naming.md` required every module in a library or tool to carry a suffix naming
its kind, as `<name>.<kind>.ts`: `.util`, `.utils`, `.types`, `.const`, `.contracts` and `.routes`.
Test artifacts carried `.mock`, `.stub`, `.fake` or `.fixture` (ADR 0008, 2026-10-17 amendment). No
ADR recorded the rule for production files; the rule file was its only home.

Three things made it a poor fit:

- **The suffix repeated what the path and the name already said.** `nx-tree.utils.ts` sat in
  `nx-utils`, and `playwright-axe.utils.ts` in `playwright-testing`. Picking between `.util` and
  `.utils` needed a judgment on each file ("named for one thing, or for a topic?"), and the rule
  needed several paragraphs to explain it.
- **A new convention appeared beside it.** The Angular libraries added in #388 named files after
  their main export (`provide-logger.ts`, `inject-logger.ts`), which is how most TypeScript code
  names files, and #390 asked whether the suffix rule should stay.
- **Almost no tool read the suffix.** Only `.spec` and `.test-d` are matched by Vitest and the lint
  globs, `.routes` follows Angular's convention, and the test-artifact kinds were matched by one
  ESLint glob.

## Decision drivers

- **A file's name should say what is in it.** `derive-port.ts` does; `playwright-port.utils.ts`
  makes a reader open it to learn the one thing it exports.
- **Keep a suffix only where a tool or a framework reads it.**
- **No judgment calls in the rule.** A reader should not have to decide between `.util` and
  `.utils`.
- **Don't lose the lint coverage the test-artifact suffixes gave.**
- **One rule for every lib and tool.** A split between Angular libs and the rest would need its own
  explanation.

## Considered options

1. **Keep the suffix rule.** Rejected: the cost above, with a benefit that tooling does not use.
2. **Name files after the main export or topic; keep only the suffixes a tool reads.** **(chosen)**
3. **Name files after the main export, but keep the suffixes the first draft of #390 listed as
   possibly needed** (`.mock`, `.stub`, `.fake`, `.fixture`, `.contracts`, `.const.mts`). Rejected:
   each of them survives as something other than a suffix (see the outcome), so none was needed.
   Keeping them would leave a rule with two ways to name a file.
4. **Apply the new rule only to the Angular libs, as an experiment.** Rejected: one workspace with
   two naming schemes, for a rule whose point is simplicity.

## Decision outcome

Chosen option: **2 — name files after the main export or topic.**

### Locked parameters

- **A file is named after its main export, in kebab-case**: `derivePort` is in `derive-port.ts`,
  `defineAxeTests` in `define-axe-tests.ts`. A file with several equal exports is named for their
  topic (`project-options.ts`, `nx-release-results.ts`).
- **The kind-of-module suffixes are retired**: `.util`, `.utils`, `.types`, `.const`, `.contracts`,
  `.mock`, `.stub`, `.fake` and `.fixture`, with their plurals.
- **Three suffixes remain**, because a tool or a framework convention reads them: `.spec` and
  `.test-d` (the test runners and lint globs) and `.routes` (Angular's convention for a route
  config, which the `ng-lib` generator follows).
- **The rule applies to every library and tool**, not only the Angular ones, and to existing files.
  #390 renamed them.
- **A tool that loads a file by name decides its extension, not its name.** `.mts` stays on
  `dep-constraints-const.mts`, which bare Node and ESLint import as ESM.
- **A test artifact's kind is a word in its name, not a suffix** (`executor-context-fixture.ts`,
  `library-generator-fake.ts`). Test artifacts live in a `type:testing` lib, and ESLint finds them by
  that folder: the Vitest rules apply to `{libs,tools}/**/testing/src/**/*.ts`, except the shared
  Playwright lib, whose gate code gets the Playwright rules.
- **Generated server-contract types live in `src/lib/generated/` of a `type:types` lib**, named for
  their content (`orders.ts`). The folder is the marker that separates generated code from
  hand-written code; a hand-written file does not go there.

## Consequences

### Positive

- A file's name says what it holds, and the rule fits in a few lines with no judgment call.
- Specs, type tests and routes are the only suffixes, and each is read by a tool.
- A folder is a better marker than a suffix for generated code: it shows in the path, and ESLint,
  Prettier and `.gitattributes` can each exclude or flag it with one entry.

### Negative / risks

- **A name no longer shows whether a file holds types or runtime code.** The `type:types` libs show
  it by their tag, and the `.test-d` files by their suffix.
- **Two libraries can have a file with the same name**, which look the same in an editor tab and a
  stack trace. The rule asks for a name that says what the file does when that happens:
  `angular-plugin` has `vitest-config.ts` beside `nx-utils`' `vitest.ts`.
- **A test artifact outside a `testing` lib's `src` is no longer linted as test code, and nothing
  reports it.** It would get the production rules, so an `any` in it fails lint, which is loud. A
  left-in `.only` in one would not be caught. `testing.md` already requires artifacts to live in a
  `testing` lib.
- **Every file in a `testing` lib's `src` gets the Vitest rules and relaxations**, including setup
  files and helpers that are not artifacts (`test-setup.ts`). Those rules only act on test
  constructs.
- **A misnamed file is caught in review.** No lint rule checks a name against its exports.

### Unverified

- **No generator writes into `src/lib/generated/` yet.** ADR 0017 left the generator unchosen, so the
  folder is a promise that its output will go there.
- **The `{libs,tools}/**/testing/src` glob** matches only directories named `testing`. A
  `type:testing` lib whose last directory has another name would not be linted as test code. Of the
  six `type:testing` projects today, five end in `testing`; the sixth is the .NET tests project,
  which has no TypeScript.

## More information

- ADR 0004 (`nx-module-boundaries`), 2026-11-13 amendment: generated contract types live in a
  `type:types` lib.
- ADR 0008 (`eslint-plugin-layer`), 2026-10-17 amendment: the suffix glob that this decision
  replaces.
- ADR 0017 (`dotnet-backend`), 2026-11-13 amendment: the `.contracts.ts` marker that this decision
  replaces.
- ADR 0009 (`lib-directory-layout`): why a testing lib's last directory is `testing`.
- Issue #390.

## Amendment (2026-11-27): a signal store ends in `-store`

- Status: accepted
- Deciders: djmcgrath
- Implemented by: `.claude/rules/file-naming.md`; issue #401 (the `signal-store` generator)

This is not an exception to the decision. `-store` is part of the export's name, so the rule already
gives it: `BookSearchStore` is in `book-search-store.ts`, and its spec is `book-search-store.spec.ts`.
It is joined with a dash, not a dot, so it is not one of the retired kind-of-module suffixes
(`.store.ts` would be). NgRx's own SignalStore docs name store files this way (`book-search-store.ts`,
`counter-store.ts`), so the workspace follows them. A store feature is named for its function
(`with-request-status.ts`).

The `**/*.store.ts` glob that ADR 0008 lists as a scoping option would match nothing under this rule.
