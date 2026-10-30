# 15. Automated `main` → `develop` back-merge under a scoped bypass

- Status: accepted
- Date: 2026-10-16
- Deciders: djmcgrath
- Implemented by: `.github/workflows/deploy-affected.yml` (`back-merge` job), the
  `cybertec-back-merge` GitHub App, ruleset `protect-develop` (bypass actor), GitHub Environment
  `back-merge`

## Context and problem statement

A release (ADR 0011) is cut on a `release/<date>` branch and promoted to `main` through a PR that
merges as a merge commit. The release commit — version bumps, changelogs, release manifests, the
workspace version — and its `{project}@{version}` tags then exist on `main` but not on `develop`.
Until `main` is merged back into `develop`, the next release is cut from a `develop` that doesn't
contain the last one, so it recomputes versions from the wrong baseline.

Today that back-merge is a manual step: a maintainer or agent merges `origin/main` into a
`chore/back-merge-main-<date>` branch and opens a PR (e.g. #141). It is easy to forget, and it
needs a review even though it carries no new content — every commit in it was already approved on
its way to `main`.

`protect-develop` requires a PR for every change, and ADR 0014 locks "the maintainer (admin) is the
only bypass". Any automation that lands the back-merge without a human has to change that.

## Decision drivers

- **No forgotten step.** A release isn't finished until `develop` contains it; that shouldn't
  depend on someone remembering.
- **No unreviewed content on `develop`.** Whatever automation lands must only carry commits that
  already passed the gate into `main`.
- **Least privilege.** Any new bypass must be as narrow as possible in who holds it and where it
  can be used.
- **Two-parent merge.** `main` must become an ancestor of `develop` (conventions §2), so the
  back-merge can never be squashed.

## Considered options

1. **Keep it manual.** Status quo; relies on memory.
2. **Automate it as a PR.** The job pushes a back-merge branch and opens a PR with auto-merge
   (merge commit). No policy change, but it still waits on a maintainer approval, so the release
   isn't finished until someone clicks approve.
3. **Automate it as a direct push by a dedicated GitHub App that is a bypass actor on
   `protect-develop` only.** (chosen)

## Decision outcome

Chosen option: **3**. The maintainer chose full automation over keeping a review click on a merge
that can't contain unreviewed changes. Option 2 stays the fallback if the bypass is ever removed.

This amends ADR 0014's "the maintainer (admin) is the only bypass" — see the amendment there. It
does not change ADR 0014's core rule: `cybertec-bot`, the agent identity, still has no bypass.

### Locked parameters

**Who holds the bypass**

- Only the `cybertec-back-merge` GitHub App, never `cybertec-bot` or any account an agent session
  can use. The App has `contents: write` on this repo and nothing else.
- It is a bypass actor on `protect-develop` only. `protect-main` keeps no bypass besides the
  maintainer.
- Its credentials (`BACK_MERGE_APP_CLIENT_ID`, `BACK_MERGE_APP_PRIVATE_KEY`) are **environment
  secrets on the `back-merge` GitHub Environment**, whose deployment-branch policy allows `main`
  only. A workflow run from any other branch can't read them.

**What the job may do**

- Run only in `deploy-affected.yml`, only for a ref of `main`, after the `affected` job succeeds.
  It does not wait on `deploy`: the release commit is on `main` whether or not an app deployed, and
  `develop` needs it either way.
- Merge `origin/main` into `develop` with `--no-ff` — always a two-parent merge, subject
  `chore(release): back-merge main into develop`, authored as the App's bot user.
- If `develop` already contains `main`, exit without changes.
- **On conflict, abort and fail.** The job never resolves conflicts, never adds commits other than
  the merge, and never force-pushes. A conflict is resolved by hand through a normal PR (option 2's
  shape).
- If `develop` moved since checkout, the push is rejected as non-fast-forward; the job fails and
  can be re-run.

## Consequences

### Positive

- Every release finishes with `develop` containing it, with no manual step.
- The bypass only ever lands content that already passed the `main` gate.
- The App's key is scoped to one environment that only `main` can use.

### Negative / risks

- **A second bypass actor exists.** If the App key leaks, it can push to `develop` without review.
  Mitigated by the environment scoping and the App having no other permission; rotate the key if
  in doubt.
- **The bypass is wider than the job.** GitHub enforces the bypass by actor, not by what is
  pushed; the "merge only, abort on conflict" rule is enforced by the job's code, not by the
  ruleset.
- **Required checks are skipped on the push.** `lint-and-test-affected` still runs on the resulting `develop` commit
  (push trigger), but after the fact.
- **One more credential to manage.** The App key has no expiry by default, but must be rotated if
  compromised.

## More information

- ADR 0011 — release flow (what creates the commits being back-merged).
- ADR 0014 — agentic development workflow (amended by this ADR).
- ADR 0002 — `develop` as default branch; merge-commit-not-squash rule.
- `docs/agents/conventions.md` §2 — branch model and protection.
- PR #141 — the last manual back-merge.
