---
name: audit-drift
description: >
  Read-only audit of this repo's agent-facing docs (CLAUDE.md, AGENTS.md, README.md,
  docs/agents/*, docs/adr/, memory) for documentation drift — claims that no longer match
  reality. Flags vanished file/path references, documented commands/remotes/accounts that no
  longer resolve, structural or policy claims the repo contradicts, and catalogs that have
  fallen out of sync with what ships. Use when checking that the docs still describe how
  things actually work.
argument-hint: '[path to scope to — default: every agent-facing doc in the repo]'
---

# Documentation drift audit

## Goal

Find **documentation drift**: places where a doc _claims_ something reality no longer backs.
A doc is a promise — "this file exists", "this command works", "this repo is laid out that
way". Over time the world moves and the prose doesn't. Re-check each falsifiable claim against
the actual filesystem, git, tooling, and code, and report the gaps.

**Read-only.** Report drift; do not fix it. End by proposing fixes for the user to approve.
Repo doc edits go through the bot PR flow (`.claude/skills/commit-push-pr`) as a follow-up —
never inline from an audit.

## What to read

Locate and read whichever exist (skip and say so for any that don't). If an argument was
given, scope to that path.

- `CLAUDE.md`, `AGENTS.md` at the repo root.
- `docs/agents/*.md` — `conventions.md`, `principles.md`, `issue-tracker.md`,
  `triage-labels.md`, `domain.md`.
- `docs/adr/*.md` and any `docs/adr/README` / index.
- `README.md` (root) and any `README.md` beside a generator or lib.
- `CONTEXT.md` / `CONTEXT-MAP.md` if present.
- **Memory (secondary)** — the running session's `MEMORY.md` index and any memory file that
  names a concrete file / flag / command. Per-machine, not checked in, so lower priority —
  but a memory pointer at a file that no longer exists is real drift worth surfacing.

## Checks — each documented claim is a falsifiable assertion

Extract claims, verify each with a **read-only** probe, group findings by type:

1. **File / path references.** A doc names a file, dir, script, key, or config supposed to
   exist (an SSH key under `~/.ssh`, a `docs/agents/conventions.md`, a workflow file). Expand
   `~` and env vars, then verify it resolves. A reference to something gone or moved is drift.

2. **Command / incantation references.** Documented commands assume real tools, flags, git
   remotes, `gh` accounts, branches, identifiers. Verify the _referents_ exist, read-only — a
   named git remote is present (`git remote`), a documented `gh` keyring user exists
   (`gh auth status`), a branch the policy names exists on the remote, the `nxCloudId` in
   `nx.json` matches what Nx Cloud reports. **Never run a state-changing command to test it.**

3. **Structural claims.** Prose describing repo layout or behavior — directory shape, test
   runner per project, what's published vs. not, generator scope. Verify against the repo
   (grep the project's test config / `package.json`, check the dir shape). A claim the repo
   contradicts is drift.

4. **Policy / workflow claims.** "Branch off `develop`, PR into `develop`", "auto-merge
   armed", "publish on merge to `main`", "branch protection requires the `ci` check".
   Verify what is read-only checkable (does `develop` exist? is there a publish workflow
   under `.github/workflows`? `gh api repos/cybertecpty/platform/rulesets`) and explicitly
   mark the rest **asserted but not verifiable from here** rather than guessing.

5. **Catalog / manifest consistency.** A doc that _enumerates_ something must match what
   ships: `AGENTS.md` / `CLAUDE.md`'s list of skills vs. the real `.claude/skills/` +
   `.agents/skills/` contents; `package.json` version vs. any version named in docs; the ADR
   index vs. the files in `docs/adr/`. A list that names a removed item — or omits an added
   one — is drift.

6. **Stale named entities.** A doc or memory names a specific function, flag, file, or
   section that no longer exists in what it points into. Grep for it; if gone, the reference
   is stale.

When a claim genuinely can't be checked here (needs a network call, an authenticated API, or
another machine), say so — an honest "not verifiable here" beats a guessed PASS/FAIL.

## Output

```markdown
**Documentation drift audit** — scope: {what was audited}

Verdict: {docs consistent with reality | N drift items across M docs}

### {Claim type, e.g. File / path references}

| Doc (file:line) | Claim         | Reality                | Finding                     |
| --------------- | ------------- | ---------------------- | --------------------------- |
| {path:line}     | "{the claim}" | {what the probe found} | OK / DRIFT / NOT VERIFIABLE |

### Proposed fixes

- {doc:line} — {specific edit: repoint / update value / delete stale ref}. {where it lands}
```

Rules for the fixes section:

- Be specific: name the file and line and what to change it to — not "update the docs".
- **Don't edit anything.** Propose; wait for the user's go.
- Repo doc edits are a follow-up through the bot branch + PR flow — list them, don't inline them.
