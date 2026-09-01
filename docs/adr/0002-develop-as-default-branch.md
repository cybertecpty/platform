# 2. `develop` as the GitHub default branch

- Status: accepted
- Date: 2026-09-01
- Deciders: djmcgrath
- Implemented by: repo setting changed 2026-09-01; this ADR + conventions.md note

## Context and problem statement

The repo runs a git-flow-style two-branch model (ADR-adjacent, documented in
`docs/agents/conventions.md` §2): **`develop`** is the integration branch that every
feature/fix/chore PR targets, and **`main`** is the release / published-package branch that
only receives `develop → main` promotion PRs.

Until now `main` was the GitHub **default branch**. That created a persistent mismatch with
how the repo actually works:

- **Closing keywords didn't fire.** `Closes #19` in PR #25 (merged into `develop`) did not
  close issue #19 — GitHub only auto-closes referenced issues when a PR merges into the
  _default_ branch. Every issue closed via a feature PR had to be closed by hand, or waited
  for the next `develop → main` promotion. This defeats the point of the linkage syntax and is
  easy to forget (see PR #25 / issue #19, 2026-09-01).
- **The issue "Development" sidebar** and `closed_by_pull_requests` linkage are likewise keyed
  to the default branch, so the GitHub UI under-reported which PR resolved an issue.
- **New PRs and comparisons defaulted to `base: main`**, the branch contributors should almost
  never target directly. `gh pr create` without `--base` and the web "Compare & pull request"
  button both pointed the wrong way.

## Decision drivers

- `Closes #N` should close the issue when the work actually lands (on `develop`), with no
  manual step.
- GitHub's native issue↔PR linkage UI should reflect reality.
- New PRs should default to the branch they belong on.
- Prefer a native GitHub setting over bespoke automation that re-implements a built-in feature.

## Considered options

1. **Make `develop` the default branch.**
2. **Keep `main` as default; add a GitHub Actions workflow** that, on `pull_request: closed`
   (merged, `base: develop`), parses closing keywords from the PR body and closes the
   referenced issues via the API.
3. **Keep `main` as default; close issues manually** (or let the `develop → main` promotion
   close them in a batch).

## Decision outcome

Chosen option: **1 — make `develop` the default branch.**

- Option 2 is a bespoke reimplementation of a native GitHub feature. It still wouldn't restore
  the "Development" sidebar linkage or fix the default PR base, it adds a workflow to maintain,
  and keyword-parsing drifts from GitHub's own grammar over time.
- Option 3 is the status quo — demonstrably forgotten, and it delays issue closure until an
  unrelated release event.
- Option 1 fixes all three symptoms at once with a one-time setting change. `main` stays a
  protected branch and the release target; nothing about the branch model changes except which
  branch GitHub treats as the trunk.

### Locked parameters

- **Default branch: `develop`.** Changing it back requires reopening this ADR.
- **`develop → main` promotion PRs carry no closing keywords** — the issues they carry were
  already closed when the work merged to `develop`. (Consistent with §2's existing rule that
  promotion PRs merge as merge commits, not squash.)
- Branch protection stays on **both** `develop` and `main` (`protect-develop` /
  `protect-main`, unchanged).

## Consequences

### Positive

- `Closes #N` / `Fixes #N` in a feature PR closes the issue on merge to `develop`, no manual
  step.
- GitHub's issue "Development" panel and `closed_by_pull_requests` now reflect the PR that did
  the work.
- `gh pr create` with no `--base`, and the web compare/PR UI, default to `develop`.
- The default branch now matches the mental model in `docs/agents/conventions.md` §2.

### Negative / risks

- Existing local clones keep `origin/HEAD → origin/main` until each runs
  `git remote set-head origin -a` (or re-clones). Cosmetic — affects what bare `git push` /
  `git checkout -` assume; the conventions already require explicit branch names.
- A release/promotion PR opened without an explicit `--base main` will now default to
  `develop`. `docs/agents/conventions.md` §2 calls out the explicit base for promotion PRs.
- Anyone with muscle memory expecting `main` to be the GitHub landing view will see `develop`
  first.

## More information

- `docs/agents/conventions.md` §2 — branch model & protection (updated alongside this ADR).
- Trigger: PR #25 (`Closes #19`) merged to `develop` on 2026-09-01 without closing issue #19.
- GitHub docs: "Linking a pull request to an issue" — auto-close requires merge into the
  default branch.
