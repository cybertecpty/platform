# Agent Conventions

How coding agents work in this repo. **This file is authoritative for `platform`.**
It was seeded from the `cybertecpty` Claude Code plugin's injected `conventions.md`
(source: `cybertecpty/agent-tooling` → `shared/conventions/`), then curated to what
applies here. Some rules describe tooling that isn't wired up yet — §0 says which.
This file supersedes the plugin's copy, which is being removed.

Companion docs in this folder:

- [`principles.md`](principles.md) — cross-cutting agent working principles
- [`issue-tracker.md`](issue-tracker.md) — GitHub Issues workflow
- [`triage-labels.md`](triage-labels.md) — the five-role triage vocabulary
- [`domain.md`](domain.md) — how to consume `CONTEXT.md` / `docs/adr/`

---

## 0. Current state vs. intended

The repo is a fresh rebuild (`dfc4c32 chore: first commit`, 2026-08-31). Some rules
below describe the **intended** setup and are **not wired yet** — treated here as
policy so they're in place when the tooling lands, but don't assume they're active:

| Area                                                   | Now                                                   | Planned        |
| ------------------------------------------------------ | ----------------------------------------------------- | -------------- |
| Bot PR flow (`cybertec-bot`, `cybertecpty/bots` team)  | ✅ live                                               | —              |
| CI (`ci.yml`) + Nx Cloud distribution / self-healing   | ✅ live                                               | —              |
| Nx Cloud remote cache (`NX_CLOUD_ACCESS_TOKEN` secret) | ⚠️ token not set — CI runs without shared caching     | set the secret |
| Branch protection on `develop` / `main`                | ✅ live — rulesets `protect-develop` / `protect-main` | —              |
| Commitlint / format-on-save hook                       | ❌ not configured                                     | §3, §8         |
| `@cybertecpty/*` publish on merge to `main`            | ❌ no release flow, no packages                       | §2             |
| `cybertec-back-merge` app                              | app installed, not driving anything                   | §2             |
| pnpm                                                   | ❌ npm today                                          | ADR 0001       |

Where a rule depends on unwired tooling, it says so inline.

---

## 1. Git identity & PR mechanics

Applies when an agent commits, pushes, or opens PRs in this repo. A developer's own
manual git is unaffected.

### Accounts

- **Maintainer:** `djmcgrath101` — `gh` rests here between sessions.
- **Bot:** `cybertec-bot` — authors agent commits and PRs. Member of the
  `cybertecpty/bots` team, which has `write` on this repo.

### Commit identity

- Author agent commits as the bot. Do **not** change the repo's `.git/config` user.
- Use explicit flags:
  `git -c user.name="cybertec-bot" -c user.email="cybertec-bot@cybertec.io" commit ...`
- End the commit message with the model trailer
  (`Co-Authored-By: Claude <model> <noreply@anthropic.com>`).

### Push remote

- Push agent work via the **`cybertec-bot`** remote, never `origin`.
  - `cybertec-bot` → `git@github-cybertec-bot:cybertecpty/platform.git`
  - SSH host alias `github-cybertec-bot` in `~/.ssh/config`, key
    `~/.ssh/id_ed25519_cybertec_bot`.
  - `origin` → `https://github.com/cybertecpty/platform.git` (HTTPS via GCM,
    authenticates as the maintainer).
- `git push cybertec-bot HEAD` or `git push cybertec-bot {branch}`.
- Prefer shipping a committed branch without checking it out (see §6).

### Pull requests

- Switch the `gh` account **before** the first GitHub write:
  `gh auth switch --user cybertec-bot`, then
  `gh pr create --repo cybertecpty/platform --base develop --head {branch} ...`.
- Use `--body-file {path}` for multi-line bodies — never inline `--body` (PowerShell
  strips embedded quotes) and never `--body @-`.
- Switch to the maintainer account only for actions that genuinely need a seated
  account (e.g. requesting a Copilot review, approving). Switch **back** to
  `cybertec-bot` before bot-owned maintenance (arming auto-merge, bot comments,
  resolving bot-addressed threads), and leave `gh` resting at `djmcgrath101` at
  session end.

### Auto-merge

- Branch protection is live (§2), so auto-merge is safe: as `cybertec-bot`,
  `gh pr merge {n} --auto --squash` for PRs into `develop`. It pre-arms the merge
  and then waits for the required `main` check **and** the maintainer's approval —
  it will not merge unreviewed code.
- Only the human maintainer approves and merges protected branches. Do not grant
  the bot bypass rights to force a self-merge.
- If the bot loses authorization for a protected branch, report that rather than
  working around it.

### Post-merge cleanup

After one of the agent's own PRs merges and its remote branch is auto-deleted, prune
the stale local branch (and any worktree attached to it). Scope strictly to branches
this agent's workflow created — never touch carryover from another session (§6).
Confirm `MERGED` via `gh pr list --state merged --head {branch}`; `[gone]` alone is
not proof. Prefer `git branch -d` (refuses unmerged work).

### GitHub MCP boundary

- The GitHub MCP server authenticates as the **personal** account here. Use it for
  **reading** — PR diffs, review threads, CI status, issues, search.
- Do **not** use it to commit, push, create/merge PRs, comment, or resolve threads
  for bot-authored code work — that path is `git` + `gh` as the bot.
- Exception: creating/updating **backlog issues** through the GitHub MCP is fine.
  Backlog issues are intentionally personal-authored, not bot-attributed products.

---

## 2. Branch model & protection

- **`develop`** — integration branch. All feature/fix/chore PRs target `develop`.
- **`main`** — release / published-package branch.
- Never push directly to `develop` or `main`. Never force-push a shared branch — add
  a new commit.

**Branch protection (live).** Rulesets `protect-develop` and `protect-main` enforce,
on both branches:

- a pull request is required — no direct pushes;
- one approving review, from the maintainer (`require_code_owner_review` off; approvals
  dismissed on any new push);
- the `main` GitHub Actions check must pass (non-strict — the branch need not be up to
  date first);
- all review threads resolved before merge;
- no force-push, no branch deletion;
- merge methods: squash or merge commit.

Repo admins (currently just the maintainer) can bypass. A CI-status or release
automation account that needs to push directly would have to be added as a bypass
actor — none is today.

**Intended (not wired yet — see §0):**

- `main` publishes `@cybertecpty/*` to npm on merge, once a release flow and
  publishable packages exist. Release PRs into `main` merge as **merge commits, not
  squash** — squashing orphans the `{project}@{version}` tag the release generator
  creates on the release branch, breaking the next release's baseline.
- `main` → `develop` back-merges (via the `cybertec-back-merge` app or manually) are
  real two-parent merges.

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

### Commit subjects & issue references

- When a commit addresses a tracked issue, append the number to the
  conventional-commit subject: `type(scope): message (#123)`. Optional — only when an
  issue actually exists; don't fabricate one.
- The subject parenthetical is a scan reference, not a closer. GitHub auto-closes
  only from body/footer keywords (`Closes #123`) **and** only on merge to `main` —
  so a PR merged to `develop` typically leaves its issue open until the work ships.

### Commit message format

Conventional Commits: `type(scope): subject`. When commitlint is configured (see
§0), these are enforced by a `commit-msg` hook — write the message to a file and
`git commit -F {file}`:

- subject **lowercase** (acronyms too);
- body lines ≤ 100 characters (blocking);
- blank line before any footer (warning only — the commit still lands).

---

## 4. Reviews & monitor events

A monitor event can re-surface any new PR comment. Before acting, confirm it is
genuine reviewer feedback.

**Actionable:** humans, `copilot-pull-request-reviewer[bot]`, `gemini-code-assist[bot]`.

**Noise — skip:** CI-status bots, comments authored by `cybertec-bot`, comments with
an "addressed by" signature from the same workflow, already-resolved/outdated threads
(unless the underlying feedback still applies).

If nothing qualifies, say so and stop — do not fabricate a no-op fix.

---

## 5. Concurrent sessions & shared working tree

Two sessions on the same clone share one working tree, index, and `HEAD`. Checkouts,
stashes, resets, and staging in one session mutate the other's state.

- Before any git write (branch, commit, stash, checkout, reset), check for signs
  another session is active. If one is changing the same clone, wait rather than
  race it.
- **Never** stash, checkout, reset, or delete carryover you did not create — it may
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

- Repo conventions → checked-in agent docs (this folder).
- Architecture decisions → ADRs in `docs/adr/`.
- Pending implementation work → GitHub issues on the matching project board.
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
- Use template files with `generateFiles` for generator output whenever viable.
- Keep generator/executor folders to actual implementations; supporting constants,
  helpers, and types go in sibling `src/lib/defaults/`, `src/lib/utils/`, etc.
- General-purpose helpers default to `utils/` unless a more specific concept owns
  them.
- Group files by functional cohesion — one honest reason to change per file.
- New/substantially-reorganized TS files: type declarations before runtime
  implementation; alphabetize within groups when it aids scanning.
- Don't hand-sort imports — the formatter handles it.
- `tsconfig*.json` must be plain JSON, no comments.
- No `any` without an inline comment explaining why.
- Don't swallow errors — rethrow or return a structured failure.
- Exported functions have explicit return types.

### Documentation placeholders

In shell/bash code blocks, use `{placeholder}` or `[placeholder]`, **not** `<...>` —
shells read `<`/`>` as redirection and a copy-paste can error or clobber a file. Keep
placeholder style consistent across a block.

### Formatting

Run `nx format:write --files={paths}` after editing. If a format-on-save /
import-organizer hook is configured (see §0), it **strips an import added without its
usage in the same edit** — so add an import and its first use atomically, in one
edit, not as two.

### Windows / PowerShell

- No `&&` chaining in PowerShell — use `;` or separate lines.
- `gh api graphql` with inline queries breaks (PowerShell eats `$var` and embedded
  `"`). Write the query to a temp `.graphql` file and pass `-F query=@file`, or use
  `--input {json-file}` for the full body.
- Avoid the UTF-8 BOM when writing files other tools parse — prefer the editor tools
  or `node` over `Set-Content -Encoding utf8`.

### Generator changes — update all surfaces together

1. `generator.ts` (runtime) 2. `schema.ts` (option types) 3. `schema.json` (CLI
   schema) 4. `generator.spec.ts` (unit coverage) 5. generator-local `README.md`.

---

## 9. Testing & verification

- Unit tests are `*.spec.ts`, beside the implementation.
- Name the top-level `describe` after the exported unit; write `it(...)` names as
  behavior statements.
- Prefer direct assertions over snapshots.
- For Nx generators / workspace utilities, use `createTreeWithEmptyWorkspace()` and
  assert against the in-memory `Tree`, generated files, and project config.

### Verification defaults

- Run through Nx: `nx test {project}`, `nx lint {project}`, `nx run-many ...`,
  `nx affected ...`. Prefix with the repo package manager (`npm exec nx …` today;
  `pnpm nx …` if ADR 0001's pnpm migration lands).
- After TS/config/schema/barrel/generator changes, run targeted tests first, then a
  build check (`nx run-many -t build -p {affected}` or the narrowest equivalent) when
  declaration emit or compilation could be affected.
- After Nx config changes, reset the Nx graph before trusting results.
- Diagnose CI failures from the real run log, not by guessing.
- If your agent has no automatic format hook, run
  `nx format:write --files={paths}` after editing.

---

## 10. Review priorities

When reviewing a PR, in order:

1. Architecture / module-boundary violations — changes that don't fit the Nx
   workspace structure, cross-boundary imports that violate scope/tag rules, new
   top-level packages that bypass placement conventions, duplicated helper logic
   where a shared helper should be extended.
2. Correctness, security, trust-boundary bugs — bad conditionals, off-by-one,
   unhandled edge cases, unhandled rejections, swallowed exceptions, missing
   validation of external input. Extra scrutiny on auth, query construction, and
   secrets. Prefer the repo's Zod request contracts at the API edge.
3. Missing/inadequate test coverage for changed behavior.
4. Generator changes that update only part of the required surface (§8).
5. Maintainability — anything that leaves a confusing handoff.

Comment style: point at the exact line, explain why it matters, match severity to
impact. Skip formatting/import-order/quote-style trivia handled by Prettier/ESLint.
If a change establishes a new durable pattern or tradeoff, ask whether it belongs in
an ADR.

---

## 11. Nx workspace rules

- Run Nx through the repo package manager, not a global CLI.
- Prefer Nx targets over underlying tools (`nx test` over `vitest` directly).
- Use the Nx MCP server / `nx-workspace` / `nx-generate` skills when available.
- Don't guess generator flags — check `schema.json`, `--help`, or Nx docs.
- To move a project, use `nx g @nx/workspace:move --project={name}
--destination={new/path}` — never `git mv` (the generator also fixes
  `tsconfig.base.json` aliases, `project.json` roots, and workspace references).
