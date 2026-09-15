# `release` generator

Cuts a release: versions and changelogs the configured projects with Nx's own release engine,
writes a per-project release manifest and a workspace version bump, commits everything as one
release commit, tags it, and opens the promotion pull request into `main`.

See [ADR 0011](../../../../../../../docs/adr/0011-release-flow.md) for why the flow is shaped this
way (branch-cut, single commit, PR-promoted). This README covers the generator's options and
mechanics, not the rationale.

## What it does

1. Normalizes options: `baseBranch` defaults to `develop`, `targetBranch` to `main`,
   `releaseDate` to now, `skipBranch`/`skipPullRequest` to `false`.
2. With `--affected`, narrows the release to the intersection of `nx.json`'s configured
   releasable projects and what's actually changed since the merge-base with `targetBranch` (or
   an explicit `--base`). If nothing matches, logs and returns a no-op — nothing else in the
   list below runs.
3. Cuts (or reuses) the release branch — `release/<releaseDate>` off `baseBranch` — unless
   `--skipBranch` commits straight to `baseBranch` instead. Skipped entirely in a dry run
   (`--dry-run` / `NX_DRY_RUN`): only the branch name is resolved, the working tree is untouched.
4. Runs Nx's own `releaseVersion`, then (unless `--skipChangelog`) `releaseChangelog`, reusing
   the release graph between the two calls instead of recomputing it.
5. Bumps the root `package.json` to the highest release type (major/minor/patch) among the
   projects actually released this run, unless `--skipWorkspaceVersion`. Logs a warning and
   skips the bump if nothing was released.
6. Writes a `release-manifest.json` (via the `release-manifest` generator) for each project that
   received a new version, unless `--skipManifest`.
7. Formats the tree unless `--skipFormat`.
8. Returns a callback — invoked by Nx after the tree is flushed to disk — that, only if there's
   something to release:
   - commits the changelog, manifest, and workspace-version changes as **one** release commit;
   - tags each released project `<project>@<version>` unless `--skipTag`;
   - pushes the branch (`--force-with-lease --follow-tags`);
   - opens or updates the GitHub pull request from the release branch into `targetBranch`,
     unless `--skipPullRequest`, `--skipBranch`, or the release branch already equals
     `targetBranch`. A failure here is logged with a manual `gh pr create` fallback rather than
     failing the release — the branch is already pushed by that point.
   - Restores the branch that was checked out before the run, whether or not any of the above
     succeeds.

## Prerequisites

- A clean working tree (checking out the release branch refuses otherwise).
- `gh` installed and authenticated as an account with write access to the repo — the pull
  request step shells out to it directly.
- `origin` configured and reachable — the release branch is pushed there.

## Usage

```bash
pnpm nx g @cybertecpty/release-plugin:release [options]
```

Add `--dry-run` to resolve the release branch name and preview the version/changelog output
without touching git or the tree.

## Options

| Option                 | Type     | Default   | Notes                                                                                      |
| ---------------------- | -------- | --------- | ------------------------------------------------------------------------------------------ |
| `affected`             | boolean  | `false`   | Narrow to projects both configured as releasable and affected since the release window.    |
| `projects` / `-p`      | string[] | all       | Explicit project list. Ignored when `--affected` resolves its own list.                    |
| `vers` / `-v`          | string   | —         | Explicit semver or release type, overriding conventional-commits detection.                |
| `firstRelease`         | boolean  | `false`   | Passed through to Nx's `releaseVersion`/`releaseChangelog`.                                |
| `baseBranch`           | string   | `develop` | Branch the release branch is cut from (or committed to, with `--skipBranch`).              |
| `base`                 | string   | —         | Explicit git revision for the `--affected` scan, overriding the `targetBranch` merge-base. |
| `author`               | string   | git user  | Author recorded in each release manifest.                                                  |
| `releaseDate`          | string   | now       | ISO date-time. Names the release branch and titles the pull request.                       |
| `skipBranch`           | boolean  | `false`   | Commit to `baseBranch` directly instead of cutting `release/<date>`.                       |
| `skipChangelog`        | boolean  | `false`   | Skip `releaseChangelog` entirely.                                                          |
| `skipManifest`         | boolean  | `false`   | Skip writing `release-manifest.json` for released projects.                                |
| `skipPullRequest`      | boolean  | `false`   | Skip opening/updating the GitHub promotion pull request.                                   |
| `skipPublish`          | boolean  | `true`    | Reserved — no publish step exists yet; this flag is currently a no-op.                     |
| `skipTag`              | boolean  | `false`   | Skip creating the `<project>@<version>` git tag per released project.                      |
| `skipWorkspaceVersion` | boolean  | `false`   | Skip bumping the root `package.json` version.                                              |
| `skipFormat`           | boolean  | `false`   | Skip formatting generated files.                                                           |
| `targetBranch`         | string   | `main`    | Branch the promotion pull request merges into.                                             |

## Examples

```bash
# Preview a release from develop into main without touching git
pnpm nx g @cybertecpty/release-plugin:release --dry-run

# Release only what changed since the last release, using conventional commits
pnpm nx g @cybertecpty/release-plugin:release --affected

# Force a minor bump across the configured project set, skipping the changelog
pnpm nx g @cybertecpty/release-plugin:release --vers minor --skipChangelog

# Commit straight to develop instead of cutting a release branch or opening a PR
pnpm nx g @cybertecpty/release-plugin:release --skipBranch --skipPullRequest
```
