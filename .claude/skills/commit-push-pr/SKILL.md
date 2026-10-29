---
name: commit-push-pr
description: >
  Bot-flow commit -> push -> PR for this repo. Commits as cybertec-bot, pushes via the
  cybertec-bot SSH remote, creates the PR as cybertec-bot, and arms auto-merge (branch
  protection gates it on CI + maintainer approval). The gh account switches to cybertec-bot
  BEFORE gh pr create so the PR is bot-attributed. Use this instead of
  commit-commands:commit-push-pr for agent work in platform.
---

# Bot flow: commit -> push -> PR

The mechanics and rationale are in [`docs/agents/conventions.md`](../../../docs/agents/conventions.md)
§1 (git identity & PR mechanics). This skill is the executable checklist.

Accounts: maintainer `djmcgrath101` (gh rests here), bot `cybertec-bot` (member of the
`cybertecpty/bots` team, which has write on the repo). Remotes: `origin` (HTTPS,
maintainer) and `cybertec-bot` -> `git@github-cybertec-bot:cybertecpty/platform.git`.

## Before you start: check, claim, worktree

Do this when you pick up an issue, before writing code. Skip it only when resuming a branch and
worktree this session created. `/implement {n}` commits to whatever branch is checked out, so
run steps 1 to 3 first and implement inside the new worktree, not on `develop` in the main clone.

**1. Check for an existing claim.** Someone may already own the issue. Read-only, any `gh` account:

```bash
gh issue view {n} --repo cybertecpty/platform --json assignees,state --jq '{state, assignees: [.assignees[].login]}'
gh pr list --repo cybertecpty/platform --state open --search "{n} in:title,body" --json number,title,headRefName
git fetch origin
git ls-remote --heads origin "*/{n}-*"
git ls-remote --heads cybertec-bot "*/{n}-*"
git worktree list
```

An assignee, an open PR, a `{type}/{n}-*` branch on either remote, or a local worktree on such a
branch all mean the issue is taken. **Stop and report it** instead of starting a second branch.
Resume only a branch and worktree this session created (conventions §5). An assignee of
`cybertec-bot` does not tell you which session holds it, so treat it as someone else's unless you
made the claim. Also check the issue's blockers and any open PR it depends on (conventions §3).

**2. Claim it.** Switch to the bot first (the same switch as Steps, step 3), then assign the issue
to the bot:

```bash
gh auth switch --user cybertec-bot
gh issue edit {n} --repo cybertecpty/platform --add-assignee cybertec-bot
```

The assignee is the claim. An early draft PR (`gh pr create --draft`) also counts, and carries the
branch name, so open one if the work will take more than one sitting. If you abandon the issue
before merging, release it with
`gh issue edit {n} --repo cybertecpty/platform --remove-assignee cybertec-bot` and close the draft
PR. Do not leave a claim on work nobody is doing. A merged PR with `Closes #{n}` closes the issue,
so the claim needs no manual release.

**3. Create the worktree.** One worktree per session, from a fresh `origin/develop`. The full
recipe, and why each flag is there, is conventions §5 (Set up):

```bash
git fetch origin
git worktree add --no-track -b {type}/{n}-{slug} ../platform-{name} origin/develop
cd ../platform-{name}
pnpm install --frozen-lockfile
```

`pnpm install` is mandatory before the first commit: it generates `.husky/_`, and a worktree
without it commits with no `commit-msg` or `pre-commit` hook, silently. Run every later command
from inside the worktree. Do not start agent work in the main clone.

### Splitting work across subagents

A subagent that edits files, stages, commits, or checks out a branch gets its own worktree and
branch, never the parent's: two writers in one working tree race over the index and `HEAD`
(conventions §5). Create it from the parent's branch so it starts from the same work:

```bash
git worktree add --no-track -b {branch}-{part} ../platform-{name}-{part} {branch}
cd ../platform-{name}-{part}
pnpm install --frozen-lockfile
```

In Claude Code, the Agent tool's `isolation: "worktree"` makes the worktree for you; run
`pnpm install --frozen-lockfile` in it before the subagent commits. The parent integrates the
subagent's commits into its own branch (merge or cherry-pick), then removes the subagent
worktree and branch it created, per step 10. Read-only subagents (search, review, fetching CI
status) share the parent's worktree and need nothing extra.

## Steps

### 1. Inspect state

```bash
git status
git diff HEAD
git branch --show-current
git log --oneline -5
```

Confirm there are changes to commit and the branch is **not** `develop` or `main`. If the
working tree is clean, say so and stop. In your own worktree there is no other session to race;
in a shared clone, see conventions §5 (Sharing a clone) before any git write.

### 2. Branch if needed

If you are on `develop`/`main` with changes to ship, do not cut a branch in the main clone. Make a
worktree and branch as in [Before you start](#before-you-start-check-claim-worktree)
(`feat/{issue#}-{slug}`, `fix/...`, `docs/...`, `chore/...`), then copy the changed files into it
(the stash is shared across worktrees, conventions §5). Only when you cannot make a worktree, use the shared-clone exception (conventions §5):

```bash
git checkout -b {branch} develop
```

### 3. Switch to the bot account — BEFORE any GitHub write

```bash
gh auth switch --user cybertec-bot
gh api user --jq .login   # verify: cybertec-bot
```

Non-negotiable and first. A PR cannot be re-attributed after creation — the only fix for a
maintainer-authored PR is to close and recreate it.

### 4. Stage only the relevant files

```bash
git add {specific-files}
```

Never `git add -A` / `git add .` without reviewing `git status` first.

### 5. Commit as the bot

Write the message to a file and pass `-F` (PowerShell mangles inline multi-line strings):

```bash
cat > /tmp/commit-msg.txt << 'EOF'
{type}({scope}): {lowercase subject}

{body — lines <= 100 chars}

Refs #{issue}
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
git -c user.name="cybertec-bot" -c user.email="cybertec-bot@cybertec.io" commit -F /tmp/commit-msg.txt
```

Conventional Commits: `type(scope): subject`, subject **lowercase** (acronyms too), body
lines <= 100, blank line before any footer. The `.husky/commit-msg` hook enforces this
(see [Commit message format](#commit-message-format) below for the valid types); `--no-verify` skips it but CI
still checks the PR title. Add `Closes #{issue}`
in the body when the commit should close an issue (subject-line `(#n)` is a reference, not a
closer). `develop` is the default branch (ADR 0002), so `Closes #{issue}` fires on merge to
`develop` — don't put closing keywords in `develop → main` promotion PRs.

The `pre-commit` hook (`husky` + `lint-staged`, conventions §8) runs ESLint (autofixing mechanical
rules only) + `nx format:write` on the staged files here. If you followed §8 and ran `nx format:write`
before staging, it's a no-op. If it changes files, they're re-staged into this commit —
re-check `git show HEAD` and amend the PR body if a "prettier clean" box needs it. Only add
`--no-verify` if the hook is actively failing the commit (say so in the PR).

### 6. Run verify, then push via the bot remote

```bash
git fetch origin
git diff origin/develop --stat
pnpm verify
git push cybertec-bot {branch}
```

The `--stat` must list only the files you meant to change. A file you did not touch, or a hunk
that removes lines `develop` gained since you branched, means the branch would revert someone
else's merged work: restore it with `git checkout origin/develop -- {file}`.

Push the branch **by name**, never `HEAD`. Another session on the same clone can check out a
different branch between your commit and your push. `HEAD` then pushes their branch, which leaves
a stray branch on the bot remote, and your PR fails with "No commits between develop and
{branch}".

To bring a newer `develop` into the branch, merge it (never force-push a shared branch). The
default merge message fails the `commit-msg` hook, so pass a conventional one and the bot identity:

```bash
git -c user.name="cybertec-bot" -c user.email="cybertec-bot@cybertec.io" \
  merge origin/develop -m "chore: merge develop into {branch}"
```

After resolving conflicts, commit with the same `-m`.

`pnpm verify` mirrors the required `lint-and-test-affected` check on affected projects (conventions §9). Don't push
until it passes; on Windows, prefix `NX_NO_CLOUD=true` if Nx Cloud teardown fails with `EISDIR`.

Never `origin` for bot work — `origin` is HTTPS via GCM (maintainer), not the bot's key.

### 7. Create the PR as the bot

The `--title` must itself be a valid Conventional Commit (`type(scope): subject`,
lowercase subject) — the `commitlint` CI check blocks the PR otherwise, and since
`develop` squash-merges it is the title that becomes the commit on `develop`.

```bash
cat > /tmp/pr-body.txt << 'EOF'
## Summary
{bullets}

## Test plan
{checklist}

Refs #{issue}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
gh pr create --repo cybertecpty/platform --base develop --head {branch} --title "{title}" --body-file /tmp/pr-body.txt --reviewer djmcgrath101
```

Capture the PR number from the `/pull/{n}` URL.

`.github/CODEOWNERS` already makes GitHub auto-request the maintainer's review, so
`--reviewer djmcgrath101` is belt-and-suspenders — keep it so the request still
fires if CODEOWNERS ever stops matching. If it errors (`Could not add requested reviewers`),
the PR has usually been created anyway: check the output for a `/pull/{n}` URL first. If it is
there, carry on — CODEOWNERS has already requested the review, and re-running would try to open
a duplicate PR. Only if no URL printed, drop the flag and re-run; do not block the PR on it.

### 8. Arm auto-merge

Branch protection is live (`docs/agents/conventions.md` §2), so this is safe:

```bash
gh pr merge {n} --repo cybertecpty/platform --auto --squash
```

Auto-merge pre-arms and then waits for the required `lint-and-test-affected` check **and** the maintainer's
approval — it will not merge unreviewed. If the bot is not authorized for the branch, report
that; do not grant bypass to force a self-merge.

Converting the PR to draft (`gh pr ready {n} --undo`, e.g. to park it while it's reworked) also
**turns auto-merge off**. After `gh pr ready {n}`, re-run the `gh pr merge … --auto --squash` above,
then check `gh pr view {n} --json autoMergeRequest`.

### 9. Switch back to the maintainer

```bash
gh auth switch --user djmcgrath101
```

Always last, even if an earlier step failed. `gh` rests at the maintainer between sessions.

### 10. Post-merge cleanup (later sessions)

When one of the agent's own PRs has merged and its remote branch is auto-deleted, remove the
worktree, then the stale local branch — but only after confirming `MERGED` via
`gh pr list --state merged --head {branch}`. `develop` squash-merges, so `git branch -d` refuses
("not fully merged") — the squash commit is not the branch tip. Once `MERGED` is confirmed,
`git branch -D` is expected. The worktree goes first because git refuses to delete a branch that
is still checked out in one. The full recipe is conventions §5 (Clean up):

```bash
# in the worktree: stop the Nx daemon, which holds files open on Windows
pnpm exec nx daemon --stop
# then from the main clone
git worktree remove ../platform-{name}
git branch -D {branch}
```

Scope this strictly to what **this session created**: the worktree you ran `git worktree add` for
and the branch you cut, named explicitly. Name each path and branch; never loop over
`git worktree list` or `git branch -vv` and remove whatever matches `[gone]` or "merged", and don't
use a bulk cleanup such as `commit-commands:clean_gone`, which removes every gone branch and its
worktree whoever made them. A worktree or branch you did not create may be another session's
in-flight work: leave it, and mention it if it looks stale. Subagent worktrees you created follow
the same steps. If you claimed the issue and abandoned it without merging, release the claim
(Before you start, step 2).

If `git worktree remove` refuses, check `git status` in the worktree for untracked files you want
before using `--force`, which discards uncommitted work. If a folder is left behind, delete it
once the holding process has stopped, then run `git worktree prune`.

## Constraints

- Never push to `develop`/`main` directly. Never force-push a shared branch — add a commit.
- The step 3 account switch is non-negotiable and must precede `gh pr create`.
- Multi-line PR/commit bodies go through `--body-file` / `-F`, never inline `--body`.

## Reference

Moved here from `docs/agents/conventions.md` §1 and §3, which keep only the invariants.

### Remotes

- `cybertec-bot` → `git@github-cybertec-bot:cybertecpty/platform.git` — SSH host alias
  `github-cybertec-bot` in `~/.ssh/config`, key `~/.ssh/id_ed25519_cybertec_bot`.
- `origin` → `https://github.com/cybertecpty/platform.git` (HTTPS via GCM, authenticates as the
  maintainer).
- `git push cybertec-bot {branch}`, never `HEAD` (step 6). In a shared clone (the exception),
  prefer shipping a committed branch without checking it out (conventions §5).

### Which `gh` account, when

- Use `--body-file {path}` for multi-line bodies — never inline `--body` (PowerShell strips
  embedded quotes) and never `--body @-`.
- `--reviewer djmcgrath101` and `.github/CODEOWNERS` (`* @djmcgrath101`) both request the
  maintainer's review. Branch protection _requires_ a maintainer approval, but "required" is not
  "requested" — without one of them a PR just sits `BLOCKED` with nobody pinged. Keep both.
- Switch to the maintainer account only for actions that genuinely need a seated account (e.g.
  approving). Switch **back** to `cybertec-bot` before bot-owned maintenance (arming auto-merge,
  bot comments, resolving bot-addressed threads), and leave `gh` resting at `djmcgrath101` at
  session end.

### Commit message format

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): subject`.
Enforced two ways from `@commitlint/config-conventional` plus a terse custom formatter: the
`.husky/commit-msg` hook locally, and a CI check on the **PR title** — the subject that lands,
since `develop` squash-merges. Write the message to a file and `git commit -F {file}`.

- subject **lowercase** (acronyms too), no trailing period. camelCase identifiers fail
  `subject-case` too: `move lastCallArg` is rejected, so describe it (`move the last-call helper`);
- header ≤ 100 characters; body / footer lines ≤ 100 (blocking);
- blank line before any footer (warning only — the commit still lands). A body line that starts
  with `word:` (e.g. a wrapped line beginning `definePreviewConfig: …`) is read as a footer and
  trips the same warning, so reword it or start that line with a plain word;
- breaking change: `!` after the type/scope — `feat(api)!: drop v1 endpoints`.

`--no-verify` skips the hook, but the CI check on the PR title still gates the merge.

When a commit addresses a tracked issue, append the number to the subject:
`type(scope): message (#123)`. Optional — only when an issue actually exists; don't fabricate one.

**Types** (scope is optional and free-form):

| type       | for                                                       |
| ---------- | --------------------------------------------------------- |
| `feat`     | a user-facing feature                                     |
| `fix`      | a bug fix                                                 |
| `docs`     | documentation only                                        |
| `refactor` | a code change that neither fixes a bug nor adds a feature |
| `perf`     | a code change that improves performance                   |
| `test`     | adding or correcting tests                                |
| `build`    | build system, dependencies, or tooling config             |
| `ci`       | CI workflows and scripts                                  |
| `chore`    | anything that doesn't touch `src` or tests                |
| `style`    | formatting only — whitespace, semicolons (not CSS)        |
| `revert`   | reverts a previous commit                                 |

### Pre-commit hook

Moved here from conventions §8. A `husky` `pre-commit` hook runs `lint-staged` on every
`git commit` (#24): staged `*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}` get `scripts/eslint-fix-mechanical.cjs`
(autofix limited to mechanical rules; other findings are reported and fail the commit) then
`nx format:write`; staged `*.{json,md,mdx,html,css,scss,yml,yaml}` get `nx format:write`.
lint-staged re-stages what it changed, so the commit lands clean.

- It's a **convenience backstop**, not the gate. CI (`nx format:check`,
  `nx run-many -t lint`) stays authoritative — `git commit --no-verify` bypasses the
  hook entirely.
- Installed by the `prepare` script on `pnpm install`; the hook shells out through
  `sh` (Git for Windows provides it). If `.husky/_/` is missing, run `pnpm install`.
- It fires on **bot commits** too. When the working tree is already formatted the hook is a
  no-op. Don't reach for `--no-verify` in the bot flow unless the hook is actively breaking a
  commit (step 5).
- lint-staged backs up the working tree as a stash before it runs and normally deletes it
  afterwards, but a `lint-staged automatic backup` entry has been seen left behind after a
  successful commit. It holds nothing the commit lacks. After committing, check
  `git stash list` and drop an entry your own commit left; leave any other stash alone
  (conventions §5).
