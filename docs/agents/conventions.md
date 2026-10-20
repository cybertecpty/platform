# Agent Conventions

How coding agents work in this repo. **This file is authoritative for `platform`.**
It was seeded from the `cybertecpty` Claude Code plugin's injected `conventions.md`
(source: `cybertecpty/agent-tooling` → `shared/conventions/`), then curated to what
applies here. Some rules describe tooling that isn't wired up yet — §0 says which.
This file supersedes the plugin's copy, which is being removed.

This file holds the rules every session needs. Detail that only matters for one activity or
one part of the repo lives next to it and loads on demand:

| Detail                                               | Lives in                             | Loads when                                   |
| ---------------------------------------------------- | ------------------------------------ | -------------------------------------------- |
| PR mechanics, remotes, commit message format & types | `.claude/skills/commit-push-pr`      | committing / opening a PR                    |
| What counts as review feedback                       | `.claude/skills/address-pr-feedback` | addressing PR comments                       |
| Review priorities & comment style                    | `.claude/skills/review-pr`           | reviewing a PR or diff                       |
| When a decision needs an ADR, how to write one       | `.claude/skills/write-adr`           | a decision picks between real alternatives   |
| Vetting a new dependency                             | `.claude/skills/add-dependency`      | before `pnpm add`                            |
| Generator templates & the five generator surfaces    | `.claude/rules/generators.md`        | working in `tools/*/plugin/**`               |
| Spec style, test-artifact naming, coverage           | `.claude/rules/testing.md`           | editing specs, test artifacts, Jest config   |
| `tsconfig` layout, `baseUrl`, `typecheck` stub       | `.claude/rules/project-config.md`    | editing `project.json` / `tsconfig*.json`    |
| Typed linting & the ESLint plugin layer              | `.claude/rules/linting.md`           | editing an `eslint.config.mjs`               |
| Commitlint formatter internals                       | `.claude/rules/commitlint.md`        | working on `tools/git/utils/**`, `.husky/**` |
| Doc placeholders, Prettier's Markdown normalization  | `.claude/rules/markdown.md`          | editing `*.md`                               |

`.claude/rules/*.md` are Claude Code path-scoped rules (`paths:` frontmatter); other agents should
read the relevant file directly. Companion docs in this folder:

- [`principles.md`](principles.md) — cross-cutting agent working principles
- [`issue-tracker.md`](issue-tracker.md) — GitHub Issues workflow
- [`triage-labels.md`](triage-labels.md) — the five-role triage vocabulary
- [`domain.md`](domain.md) — how to consume `CONTEXT.md` / `docs/adr/`
- [`merge-conflicts.md`](merge-conflicts.md) — resolving conflicts on shared files (lockfile, barrels, docs)

---

## 0. Current state vs. intended

The repo is a fresh rebuild (`dfc4c32 chore: first commit`, 2026-08-31). Some rules
below describe the **intended** setup and are **not wired yet** — treated here as
policy so they're in place when the tooling lands, but don't assume they're active:

| Area                                                      | Now                                                            | Planned |
| --------------------------------------------------------- | -------------------------------------------------------------- | ------- |
| Bot PR flow (`cybertec-bot`, `cybertecpty/bots` team)     | ✅ live                                                        | —       |
| CI (`lint-and-test-affected.yml`)                         | ✅ live — one runner, `NX_NO_CLOUD=true` (#188)                | —       |
| Nx Cloud (distribution, remote cache, self-healing)       | ❌ none — org disabled over the free plan; not paid for (#188) | —       |
| Branch protection on `develop` / `main`                   | ✅ live — rulesets `protect-develop` / `protect-main`          | —       |
| Reviewer routing (`.github/CODEOWNERS` → `@djmcgrath101`) | ✅ live — auto-requests maintainer review on every PR          | —       |
| Automated PR reviewer (e.g. Copilot code review)          | ❌ none — needs a paid plan; maintainer review only (#110)     | later   |
| Pre-commit hook (`husky` + `lint-staged`)                 | ✅ live — formats/`eslint --fix`es staged files (#24)          | —       |
| Claude Code hooks (`.claude/hooks/`, `settings.json`)     | ✅ live — bot-identity guard, end-of-turn format (§1, §8)      | —       |
| Commitlint / `commit-msg` hook                            | ✅ live — `commit-msg` hook + CI PR-title check (#32)          | §3      |
| `@cybertecpty/*` publish on merge to `main`               | ❌ no release flow, no packages                                | §2      |
| `cybertec-back-merge` app                                 | ✅ live — `back-merge` job in `deploy-affected.yml` (ADR 0015) | —       |
| pnpm (`pnpm-lock.yaml`, `pnpm exec nx`)                   | ✅ live — pnpm@10.34.5, `node-linker=isolated` (PR #17)        | —       |
| Application frameworks (Angular 22, NestJS 11)            | ✅ live — `@nx/angular` / `@nx/nest`, path-alias TS (ADR 0005) | —       |

Where a rule depends on unwired tooling, it says so inline.

---

## 1. Git identity & PR mechanics

Applies when an agent commits, pushes, or opens PRs in this repo. A developer's own
manual git is unaffected. **Ship through the `commit-push-pr` skill** — it is the executable
checklist and holds the mechanics (remotes, `gh` flags, account switching, commit format).

- **Maintainer:** `djmcgrath101` — `gh` rests here between sessions.
- **Bot:** `cybertec-bot` — authors agent commits and PRs. Member of the
  `cybertecpty/bots` team, which has `write` on this repo.

The invariants:

- Author agent commits as the bot with explicit
  `git -c user.name="cybertec-bot" -c user.email="cybertec-bot@cybertec.io" commit ...` flags.
  Do **not** change the repo's `.git/config` user. End the message with the model trailer
  (`Co-Authored-By: Claude <model> <noreply@anthropic.com>`).
- Push agent work via the **`cybertec-bot`** remote, never `origin`.
- Switch `gh` to `cybertec-bot` **before** the first GitHub write, and leave it resting at
  `djmcgrath101` at session end.
- As the bot, arm `gh pr merge {n} --auto --squash` for PRs into `develop`. It waits for the
  required `ci` check **and** the maintainer's approval — it will not merge unreviewed code.
- Only the human maintainer approves and merges protected branches. Do not grant the bot
  bypass rights to force a self-merge. If the bot loses authorization for a protected branch,
  report that rather than working around it.

**Enforced by a hook.** In Claude Code, `.claude/hooks/guard-bot-identity.cjs` (PreToolUse on
Bash / PowerShell) denies `git push origin …`, and denies bot-owned `gh pr` writes (`create`,
`merge`, `comment`, `edit`, `close`, `reopen`, `ready`) unless `gh` is on `cybertec-bot` or the
same command switches to it first. `gh pr review` (maintainer approval) is not touched. Set
`CLAUDE_BOT_GUARD=off` (e.g. in `.claude/settings.local.json` `env`) to bypass. Tests:
`node --test .claude/hooks/*.test.cjs`.

### Post-merge cleanup

After one of the agent's own PRs merges and its remote branch is auto-deleted, prune
the stale local branch and the worktree attached to it (worktree first). Scope strictly to
branches and worktrees this agent's workflow created — never touch carryover from another
session (§5). Confirm `MERGED` via `gh pr list --state merged --head {branch}`; `[gone]`
alone is not proof. `develop` squash-merges, so `git branch -d` refuses a merged branch
("not fully merged"); once `MERGED` is confirmed, `git branch -D` is expected. The commands
are in [§5 Clean up](#clean-up).

### GitHub MCP boundary

- The GitHub MCP server authenticates as the **personal** account here. Use it for
  **reading** — PR diffs, review threads, CI status, issues, search.
- Do **not** use it to commit, push, create/merge PRs, comment, or resolve threads
  for bot-authored code work — that path is `git` + `gh` as the bot.
- Exception: creating/updating **backlog issues** through the GitHub MCP is fine.
  Backlog issues are intentionally personal-authored, not bot-attributed products.

---

## 2. Branch model & protection

- **`develop`** — integration branch and the **GitHub default branch** (ADR 0002). All
  feature/fix/chore PRs target `develop`; `gh pr create` with no `--base` and the web
  compare/PR UI default to it. Because it's the default branch, `Closes #N` / `Fixes #N`
  in a PR body closes the issue on merge to `develop` — no manual close step.
- **`main`** — release / published-package branch. Promotion PRs must pass `--base main`
  explicitly (the default is now `develop`), and carry **no** closing keywords — the issues
  they promote were already closed when the work merged to `develop`.
- Never push directly to `develop` or `main`. Never force-push a shared branch — add
  a new commit. (The one automated exception is the `main` → `develop` back-merge below.)

**Branch protection (live).** Rulesets `protect-develop` and `protect-main` enforce,
on both branches:

- a pull request is required — no direct pushes;
- one approving review, from the maintainer (`require_code_owner_review` off, so a
  CODEOWNERS review is requested but not itself gating; approvals dismissed on any new
  push);
- the `ci` GitHub Actions check must pass (non-strict — the branch need not be up to
  date first);
- all review threads resolved before merge;
- no force-push, no branch deletion;
- merge methods: squash or merge commit.

Repo admins (currently just the maintainer) can bypass both. On `protect-develop` only,
the `cybertec-back-merge` GitHub App is also a bypass actor (ADR 0015). `cybertec-bot`
and agent sessions have no bypass on either branch.

**Back-merge (live).** After every push to `main`, the `back-merge` job in
`deploy-affected.yml` merges `main` into `develop` and pushes it directly as the App — a
real two-parent merge (`--no-ff`), never a squash. On conflict it aborts and fails; then
back-merge by hand on a `chore/back-merge-main-{date}` branch through a normal PR, merged
as a **merge commit**.

**Intended (not wired yet — see §0):**

- `main` publishes `@cybertecpty/*` to npm on merge, once a release flow and
  publishable packages exist. Release PRs into `main` merge as **merge commits, not
  squash** — squashing orphans the `{project}@{version}` tag the release generator
  creates on the release branch, breaking the next release's baseline.

---

## 3. Issue & one-PR-per-issue workflow

When working a multi-issue initiative, default to **one issue → one branch → one PR**.
Small PRs keep the issue/PR/commit trail traceable and avoid stacking work on a base
review has not accepted.

- Cut a fresh branch off `develop` per issue: `feat/{issue#}-{slug}`,
  `fix/{issue#}-{slug}`, `docs/...`, `chore/...`.
- Open the PR into `develop` when that issue's work is complete.
- **Coupled-issue exception:** work two+ issues on one branch only when splitting
  them would leave a broken intermediate state. Deliberate exception, not a license
  to bundle loosely related work.
- **Dependent work:** before starting the next issue, check whether it depends on
  code in an open, unmerged PR. If so, wait for the _merge_ (not just approval)
  before proceeding.

### Acceptance criteria — spec before code

The issue's acceptance criteria are the contract for the PR. The `ready-for-agent` bar is in
[`triage-labels.md`](triage-labels.md).

1. **Before coding, restate the criteria** — list them back (in the session, or as the first
   step of the plan) so a misreading surfaces before any code exists.
2. **If they are missing or vague** — untestable, contradictory, or open questions remain — do
   not guess and do not start coding. Run `mattpocock-skills:grilling` with the maintainer (or,
   with no one to grill, draft the questions yourself), then post the proposed criteria,
   out-of-scope list and answers to the issue as a comment and label it `needs-info`. Start
   coding only after the maintainer confirms (a reply, or relabelling `ready-for-agent`), then
   fold the confirmed criteria into the issue body.
3. **In the PR body, tick each criterion** — copy the checklist under an "Acceptance criteria"
   heading and tick each item with a pointer to its evidence (test, file, command output). An
   item not met stays unticked with a reason, or moves to a follow-up issue named in the PR.

Issues without the template (pre-template backlog, quick chores) follow the same steps.

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) — `type(scope): subject`,
lowercase subject, header and body lines ≤ 100 — enforced by the `.husky/commit-msg` hook and a
CI check on the **PR title** (the subject that lands, since `develop` squash-merges). The full
rules and the type table are in the `commit-push-pr` skill; the formatter internals in
`.claude/rules/commitlint.md`.

The subject parenthetical `(#123)` is a scan reference, not a closer. GitHub auto-closes
only from body/footer keywords (`Closes #123`) on merge to the **default branch**,
which is `develop` (ADR 0002) — so a feature PR's `Closes #123` fires when it merges
to `develop`. Keep closing keywords out of `develop → main` promotion PRs.

---

## 4. Reviews & monitor events

Maintainer approval is the only review gate; no automated reviewer is configured (#110). Before
acting on a PR comment or monitor event, confirm it is genuine reviewer feedback — the
actionable / noise split is in the `address-pr-feedback` skill. If nothing qualifies, say so and
stop — do not fabricate a no-op fix.

---

## 5. Concurrent sessions & worktrees

**Default: one git worktree per agent session.** Two sessions on the same clone share one
working tree, index, and `HEAD`, so a checkout, stash, reset, or `git add` in one mutates the
other's state. A worktree gives each session its own working tree, index, and `HEAD` while
sharing the repository, so there is nothing to race over. Sharing a clone is the exception
(see [Sharing a clone](#sharing-a-clone-the-exception)).

### What git enforces

- **One branch per worktree.** Git refuses to check out a branch that is already checked out
  in another worktree. Don't override it (`git worktree add --force`).
- **Shared across worktrees:** the object store, branches and tags, remotes, `.git/config`,
  and the stash. A stash made in one worktree shows up in `git stash list` in all of them.
  **Never** stash, reset, or delete a branch, stash or worktree you did not create — it may be
  another session's in-flight work.
- **Per worktree:** `HEAD`, the index, the working files, and everything gitignored —
  `node_modules`, `.nx`, `.env`.

### The main clone

Keep the main clone as a read-mostly integration checkout: sitting on `develop`, used to
`git fetch`, to read, and to create and remove worktrees. Don't start agent work in it. A
developer's own manual work there is unaffected.

### Set up

Create the worktree as a sibling of the main clone, from a fresh `origin/develop`, and install
before you commit:

```bash
git fetch origin
git worktree add --no-track -b {branch} ../platform-{name} origin/develop
cd ../platform-{name}
pnpm install --frozen-lockfile
```

- `--no-track` keeps the branch from tracking `origin/develop`; you push through the
  `cybertec-bot` remote (§1), never `origin`.
- Branch name: `{type}/{issue#}-{slug}` (§3). Folder: `platform-{name}`, next to the main clone,
  on the same drive as the pnpm store so installed files hardlink instead of copying.
- **`pnpm install` is mandatory before the first commit.** `core.hooksPath` is the relative
  `.husky/_`, which `pnpm install` generates. A worktree that hasn't run it has no hooks, and
  it fails silently: no `commit-msg` check, no `lint-staged`.
- `.env` is gitignored, so a new worktree has none. It only matters for deploys; copy it from
  the main clone if you need one.
- From here, work as in any clone: run everything from inside the worktree and ship with the
  `commit-push-pr` skill:
  ```bash
  pnpm exec nx run-many -t build test -p cybertec-io shared-utils
  pnpm exec nx serve cybertec-io
  pnpm exec nx e2e cybertec-io-e2e
  ```

Two worktrees can build, test, lint, typecheck, serve and run e2e at the same time without
manual intervention. What to know:

- **The first Nx run in a new worktree is cold:** the `.nx` cache and the Nx daemon are per
  worktree.
- **Prefix local Nx runs with `NX_NO_CLOUD=true`** if a task fails on the Nx Cloud client (on
  Windows, `EISDIR` — see the `commit-push-pr` skill). CI doesn't use Nx Cloud (#188); this is
  for local runs only.
- **`nx serve cybertec-io` takes the next free port** (4321, then 4322, …), so read the URL from
  its log.
- **`e2e` and `lighthouse` preview ports are derived per worktree and per target** (4400-4899),
  and a port already in use fails with "already used". If two worktree paths hash to the same
  port, pin one with a whole number from 1024 to 65535 (anything else throws):
  ```bash
  E2E_PORT=4777 pnpm exec nx e2e cybertec-io-e2e
  LIGHTHOUSE_PORT=4778 pnpm exec nx lighthouse cybertec-io-e2e
  ```
  In PowerShell: `$env:E2E_PORT = '4777'; pnpm exec nx e2e cybertec-io-e2e`. When `BASE_URL`
  is set (the post-deploy smoke target) there is no local preview, so the port variables don't
  apply. Details: `libs/shared/playwright/testing/README.md`.

### Clean up

Once the PR is confirmed `MERGED` (Post-merge cleanup, §1), remove the worktree, then its
branch — git refuses to delete a branch that is still checked out in a worktree. Stop what is
running in the worktree first: on Windows a dev server or the Nx daemon keeps files open, and
`git worktree remove` can leave the folder behind.

```bash
# in the worktree
pnpm exec nx daemon --stop
# then from the main clone
git worktree remove ../platform-{name}
git branch -D {branch}
```

- Ignored files (`node_modules`, `.nx`) don't block `git worktree remove`; leftover
  _untracked_ files do. If it refuses, check `git status` in the worktree for anything you
  want, then rerun with `--force`, which throws away uncommitted work.
- If a folder is left behind, delete it by hand once the process holding it has stopped, then
  run `git worktree prune`.

### Sharing a clone (the exception)

Use a shared clone only when you can't make a worktree. Then:

- Before any git write (branch, commit, stash, checkout, reset), check for signs
  another session is active. If one is changing the same clone, wait rather than
  race it.
- **Never** checkout over, or stash, reset, or delete, carryover you did not create — it may
  be another session's in-flight work.
- Prefer shipping your committed branch without checking it out:
  ```bash
  git push cybertec-bot {branch}
  gh pr create --head {branch}
  ```
- If you must check out a branch to edit it while another session has uncommitted
  changes, never stage those — use explicit paths in `git add`.

---

## 6. Session boundaries

At a major phase shift (different subsystem, different repo, different mental model,
an independently shippable deliverable), pause and propose moving the new phase to a
fresh session.

Before splitting, capture a durable handoff — memory pointer, ADR, agent doc, or
GitHub issue — with enough context for the next session to resume without replaying
the conversation.

Do **not** split mid-task before the mental model is externalized, for quick
same-phase follow-ups, or during rapid iteration where re-onboarding costs more than
the context.

---

## 7. Durable knowledge

Memory is per-machine and invisible to fresh clones and CI. It must never be the only
record of anything the repo depends on.

- Repo conventions → checked-in agent docs (this folder, `.claude/rules/`, `.claude/skills/`).
- Architecture decisions → ADRs in `docs/adr/` (`write-adr` skill: when one is needed, how to
  write it).
- Pending implementation work → GitHub issues, not added to a project board.
- Memory → a short pointer to the durable source. Committed docs win on conflict.
- Don't memorialize values with live sources (versions, branch names, remotes,
  labels, paths, flags). Store how to re-derive them; re-verify load-bearing facts
  against the live source before acting.

When a repo has checked-in agent docs covering routing, placement, naming, or
tagging, **use them directly** — don't re-derive the same answer from generator
source, schemas, or existing packages (high token cost, and you risk generalizing an
exception). Source exploration is for _extending or debugging_ a convention, not
_using_ one.

---

## 8. Coding standards

- Prefer minimal diffs and existing helpers.
- General-purpose helpers default to `utils/` unless a more specific concept owns
  them.
- Group files by functional cohesion — one honest reason to change per file.
- Type declarations before runtime implementation, then classes, exported functions and private
  functions, each alphabetized. Enforced by `perfectionist/sort-modules` (ADR 0008) — `eslint --fix`
  reorders; it does not move `const` / `let`, so a type below a `const` is a reviewer catch.
- Don't hand-sort imports — the formatter handles it.
- No `any` without an inline comment explaining why.
- Don't swallow errors — rethrow or return a structured failure.
- Exported functions have explicit return types.
- A shared helper's JSDoc says what it does, not who calls it. Don't name callers or call
  sites, which go stale as soon as another project uses the helper. A project's internal
  helpers may name the code they serve.
- Typed linting is on workspace-wide (ADR 0006) with an ESLint plugin layer on top (ADR 0008) —
  details in `.claude/rules/linting.md`.
- **Every `eslint-disable` must name specific rules and carry a reason** — write
  `// eslint-disable-next-line some-rule -- why this is safe here`, never a bare
  `// eslint-disable-next-line`.
- Generator and executor work: `.claude/rules/generators.md`. Config files:
  `.claude/rules/project-config.md`. Markdown: `.claude/rules/markdown.md`.

### Dependency reuse

Before adding a runtime or dev dependency, check whether the workspace already covers it — an
existing dependency, an Nx plugin, or a shared helper. The full vetting checklist (and the ADR
0003 entry-point bans: `lodash` → `lodash-es`, `zod` → `zod/mini` in frontend/shared code) is in
the `add-dependency` skill.

### Formatting

Run `nx format:write --files={paths}` after editing, and actually run it before
ticking a "prettier clean" box in a PR body — CI runs `nx format:check` and a stray
marker fails the required check.

In Claude Code, `.claude/hooks/format-edited.cjs` formats for you: a PostToolUse hook records
each file the session writes or edits, and a Stop hook runs Prettier over that list once at
the end of the turn. It runs per turn, not per edit, because `prettier-plugin-organize-imports`
**strips an import whose usage isn't written yet** — formatting after every edit would eat
imports mid-change. Only this session's files are formatted, so another session's work in a
shared clone is untouched. Other agents without the hook still run `nx format:write` themselves.

### Pre-commit hook

A `husky` `pre-commit` hook runs `lint-staged` (`eslint --fix` + `nx format:write` on staged
files) on every `git commit` (#24). It's a **convenience backstop**, not the gate — CI stays
authoritative. Details (what it touches, install, `--no-verify`) are in the `commit-push-pr`
skill.

### Windows / PowerShell

- No `&&` chaining in PowerShell — use `;` or separate lines.
- `gh api graphql` with inline queries breaks (PowerShell eats `$var` and embedded
  `"`). Write the query to a temp `.graphql` file and pass `-F query=@file`, or use
  `--input {json-file}` for the full body.
- Avoid the UTF-8 BOM when writing files other tools parse — prefer the editor tools
  or `node` over `Set-Content -Encoding utf8`.

---

## 9. Testing & verification

- Jest is the workspace test runner for every project — Angular, NestJS, and plain libs
  (ADR 0007). Generators are defaulted to `unitTestRunner: jest` in `nx.json`; there is
  no `@nx/vitest` plugin. Run tests through `nx test {project}`, never `jest` directly.
  - **Exception: Astro content sites use Vitest** via a per-project `vitest.config.ts`
    (ADR 0007 2026-09-23 amendment, ADR 0012).
- **Coverage: an 80% floor, CI-enforced** (ADR 0007 amendment). New runtime projects must
  clear 80% — check with `nx test {project} --coverage` before opening the PR.
  - **Exception: an Astro site with no `src/**/*.ts`** is exempt; its `test` target
    asserts on the built output instead (ADR 0007 2026-09-23 amendment).
- **Spec files are type-checked by the `typecheck` target, not `test`** — run it too.
- Spec style, test-artifact naming and coverage mechanics: `.claude/rules/testing.md`.

### Verification defaults

- **Run `pnpm verify` before every push.** It mirrors the required `ci` check on affected
  projects (vs `origin/develop`; fetch first): the `node --test` suites, `nx format:check`, and
  `nx affected -t lint test build typecheck`. On a PR, CI runs the same affected set plus `e2e`
  and `lighthouse`; on a push to `develop`/`main` it runs every project (`nx run-many`).
- Run through Nx: `nx test {project}`, `nx lint {project}`, `nx run-many ...`,
  `nx affected ...`. Prefix with pnpm: `pnpm exec nx …`.
- After TS/config/schema/barrel/generator changes, run targeted tests first, then a
  build check (`nx run-many -t build -p {affected}` or the narrowest equivalent) when
  declaration emit or compilation could be affected.
- After Nx config changes, reset the Nx graph before trusting results.
- Diagnose CI failures from the real run log, not by guessing.
- If your agent has no automatic format hook, run
  `nx format:write --files={paths}` after editing.

---

## 10. Review priorities

Architecture / module boundaries first, then correctness and trust-boundary bugs, then test
coverage, then partial generator changes, then maintainability. The full list and comment style
are in the `review-pr` skill.

**Scale review effort to risk.** Pick a tier (None / Light / Standard / Deep) from the riskiest
path the diff touches and state it in the PR's Test plan. Light is the default; multi-agent review
is reserved for generators, CI, agent hooks, lint/boundary config, release tooling and secrets. The
path → tier table is in the `review-pr` skill.

---

## 11. Nx workspace rules

- Run Nx through pnpm (`pnpm exec nx`), not a global CLI.
- Prefer Nx targets over underlying tools (`nx test` over `jest` directly).
- Use the Nx MCP server / `nx-workspace` / `nx-generate` skills when available.
- Don't guess generator flags — check `schema.json`, `--help`, or Nx docs.
- To move a project, use `nx g @nx/workspace:move --project={name}
--destination={new/path}` — never `git mv` (the generator also fixes
  `tsconfig.base.json` aliases, `project.json` roots, and workspace references).
- TypeScript layout is path-alias, not project references, and `tsconfig.base.json` has no
  `baseUrl` (ADR 0005) — details in `.claude/rules/project-config.md`.
- Angular and NestJS are the only application stacks (ADR 0005), except Astro for static
  content sites such as `apps/cybertec-io` (ADR 0005 amendment, ADR 0012). Add framework
  capability through `@nx/angular` / `@nx/nest` generators and `nx add`, not hand-installed
  `@angular/*` / `@nestjs/*` packages. Framework upgrades run through `nx migrate`.
