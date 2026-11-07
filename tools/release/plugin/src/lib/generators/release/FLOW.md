# Release generator: the flow on one page

Draft. This is a map of what one run does and why each step exists, so the flow can be judged
as a whole. The option reference is in [`README.md`](./README.md); the decision to orchestrate
around `nx release` at all is in [ADR 0011](../../../../../../../docs/adr/0011-release-flow.md).

## The one-sentence version

Version and changelog the affected projects with Nx, write manifests, make **one** release
commit on `release/{date}`, tag it per project, push, and open a promotion PR into `main`.

## Why a wrapper exists

Branch protection forbids pushing to `main`, and `nx release` cannot open a promotion PR. It also
has no notion of per-project manifests or a workspace version. So some orchestration is required
(ADR 0011). Everything below is that orchestration.

## The steps, in order

Each step is marked **guard** (stops a bad run before it writes anything), **decide** (works out
what to release) or **write** (changes the repo or GitHub).

| #   | Step                                                                                            | Kind   | Code                                               |
| --- | ----------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------- |
| 1   | Fill option defaults. With `--affected`, narrow to changed releasable projects; none, stop.     | decide | `normalizeOpts`                                    |
| 2   | Fetch base, target and tags. Fail if `origin/main` has commits `origin/develop` lacks.          | guard  | `assertBaseIncludesTarget`                         |
| 3   | Get onto the release branch. Real run: check out or cut `release/{date}`. Dry run: nothing.     | write  | `checkoutReleaseBranch`                            |
| 4   | Preview versions with Nx (`dryRun`), then preview changelogs, to drop projects with no changes. | decide | `releaseVersion`, `selectReleasableProjects`       |
| 5   | If none remain, undo step 3 and stop.                                                           | guard  | `abandonReleaseBranch`                             |
| 6   | Fail if a tag this run would create already sits on a commit outside the release branch.        | guard  | `assertReleaseTagsAvailable`                       |
| 7   | Run `releaseVersion` and `releaseChangelog` for real; write manifests and workspace version.    | write  | `generateReleaseManifests`, `bumpWorkspaceVersion` |
| 8   | Commit, tag per project, fetch, push with `--follow-tags`, open or update the PR (best effort). | write  | the returned callback                              |
| 9   | Switch back to the starting branch.                                                             | write  | `restoreStartingBranch`                            |

A failure in a guard (2, 5, 6) must leave nothing behind: no files, no branch, no commit, no PR.
The real-git specs in `generator.git.spec.ts` check that for steps 2 and 6.

## What each guard protects

- **Step 2, stale base.** Nx finds the previous release from tags. If `develop` lacks a release
  that `main` has, those tags are not reachable and the run re-releases an old version.
- **Step 6, existing tag.** A duplicate or misplaced tag corrupts the baseline the next release
  reads. A same-day re-run is allowed because its tags are on the release branch.

## Where the complexity comes from

- **Two passes of Nx's versioning** (steps 4 and 7). The first exists only so steps 5 and 6 can
  decide before anything is written. Without it, the guards would have to run after writes.
- **Branch state.** Steps 3, 5 and 9 exist to put git in the right place and put it back. The
  release branch can be local, only on `origin`, or absent, and the run can start on any branch.
- **Best-effort PR.** Step 8 pushes before opening the PR, so a GitHub failure cannot undo the
  push. That is why the PR is a warning rather than an error.

## Questions this map raises

1. Is step 6 worth a hard failure, or would a warning plus a clear push error do? It drives most
   of the branch-state handling in step 3.
2. Dry run already skips the checkout and warns instead of failing. Is that enough?
3. Could the release always be cut from `origin/{base}`, removing the local-versus-remote cases?
4. Are steps 4 and 7 collapsible by writing to a scratch branch and discarding it on failure?
