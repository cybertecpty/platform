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

## Steps

### 1. Inspect state

```bash
git status
git diff HEAD
git branch --show-current
git log --oneline -5
```

Confirm there are changes to commit and the branch is **not** `develop` or `main`. If the
working tree is clean, say so and stop. If another session is active on this clone, see
conventions §5 before any git write.

### 2. Branch if needed

If on `develop`/`main`, cut a feature branch off `develop` first:
`feat/{issue#}-{slug}`, `fix/...`, `docs/...`, `chore/...`.

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

The `pre-commit` hook (`husky` + `lint-staged`, conventions §8) runs `eslint --fix` +
`nx format:write` on the staged files here. If you followed §8 and ran `nx format:write`
before staging, it's a no-op. If it changes files, they're re-staged into this commit —
re-check `git show HEAD` and amend the PR body if a "prettier clean" box needs it. Only add
`--no-verify` if the hook is actively failing the commit (say so in the PR).

### 6. Push via the bot remote

```bash
git push cybertec-bot HEAD
```

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
fires if CODEOWNERS ever stops matching. If it errors (e.g. the maintainer can't be
requested on this PR), drop the flag and re-run; do not block the PR on it.

### 8. Arm auto-merge

Branch protection is live (`docs/agents/conventions.md` §2), so this is safe:

```bash
gh pr merge {n} --repo cybertecpty/platform --auto --squash
```

Auto-merge pre-arms and then waits for the required `ci` check **and** the maintainer's
approval — it will not merge unreviewed. If the bot is not authorized for the branch, report
that; do not grant bypass to force a self-merge.

### 9. Switch back to the maintainer

```bash
gh auth switch --user djmcgrath101
```

Always last, even if an earlier step failed. `gh` rests at the maintainer between sessions.

### 10. Post-merge cleanup (later sessions)

When one of the agent's own PRs has merged and its remote branch is auto-deleted, prune the
stale local branch — but only after confirming `MERGED` via
`gh pr list --state merged --head {branch}`. Prefer `git branch -d`. Never touch branches or
worktrees the agent's workflow didn't create.

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
- `git push cybertec-bot HEAD` or `git push cybertec-bot {branch}`. Prefer shipping a committed
  branch without checking it out (conventions §5).

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

- subject **lowercase** (acronyms too), no trailing period;
- header ≤ 100 characters; body / footer lines ≤ 100 (blocking);
- blank line before any footer (warning only — the commit still lands);
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
`git commit` (#24): staged `*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}` get `eslint --fix` then
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
