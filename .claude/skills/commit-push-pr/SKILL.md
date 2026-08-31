---
name: commit-push-pr
description: >
  Bot-flow commit -> push -> PR for this repo. Commits as cybertec-bot, pushes via the
  cybertec-bot SSH remote, creates the PR as cybertec-bot, and arms auto-merge. The gh
  account switches to cybertec-bot BEFORE gh pr create so the PR is bot-attributed. Use
  this instead of commit-commands:commit-push-pr for agent work in platform.
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

Commitlint (enforced): `type(scope): subject`, subject **lowercase** (acronyms too), body
lines <= 100, blank line before any footer. Add `Closes #{issue}` in the body when the
commit should close an issue (subject-line `(#n)` is a reference, not a closer, and GitHub
only auto-closes on merge to `main`).

### 6. Push via the bot remote

```bash
git push cybertec-bot HEAD
```

Never `origin` for bot work — `origin` is HTTPS via GCM (maintainer), not the bot's key.

### 7. Create the PR as the bot

```bash
cat > /tmp/pr-body.txt << 'EOF'
## Summary
{bullets}

## Test plan
{checklist}

Refs #{issue}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
gh pr create --repo cybertecpty/platform --base develop --head {branch} --title "{title}" --body-file /tmp/pr-body.txt
```

Capture the PR number from the `/pull/{n}` URL.

### 8. Arm auto-merge

```bash
gh pr merge {n} --repo cybertecpty/platform --auto --squash
```

Auto-merge only pre-arms — it still waits for the required `main` CI check and the
maintainer's approval (conventions §2, §3). If the bot is not authorized for the branch,
report that; do not grant bypass to force a self-merge.

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
