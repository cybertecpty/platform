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
3. Runs a preflight that fails before any file, commit, push or PR is written:
   - `origin/<targetBranch>` must not have commits `origin/<baseBranch>` lacks. If it does, back-merge
     `targetBranch` into `baseBranch` first; the generator only checks and never merges. With
     `--dry-run` this only warns. The check fetches both branches and the tags first.
4. Cuts (or reuses) the release branch — `release/<releaseDate>` off `baseBranch` — unless
   `--skipBranch` commits straight to `baseBranch` instead. Skipped entirely in a dry run
   (`--dry-run` / `NX_DRY_RUN`): only the branch name is resolved, the working tree is untouched.
   On the release branch, `releaseVersion` runs once with `dryRun` (it writes nothing) so the
   release is decided from the commits and tags the real run will see:
   - Unless `--skipTag` or `--dry-run`, no tag the run would create may already exist on a commit
     off the release branch. A same-day re-run on its existing local `release/<date>` branch still
     passes.
   - Projects with nothing to release are skipped (step 5). If none remain, the run switches back
     to the starting branch, deletes the release branch it just cut (a pre-existing one is kept),
     and exits. A failed tag check abandons the branch the same way. In a dry run there is no
     checkout, so the preview runs on the current branch.
5. Runs Nx's own `releaseVersion` for real, then (unless `--skipChangelog`) `releaseChangelog`,
   reusing the release graph between the two calls. Both run only on projects with something to
   release, found by previewing `releaseVersion` and `releaseChangelog` in a dry run beforehand
   (step 4). A project is **skipped** only when it has no changelog entries of its own _and_ none
   of its workspace dependencies is released in the same run (a dependency released transitively
   counts). A skipped project leaves no trace: no version, changelog, manifest, tag, or PR mention,
   and one log line says why. If every project is skipped the run logs `Nothing needs releasing.`
   and exits without a branch or PR. Only projects in the release set count as released
   dependencies, but a library change still reaches an app: Nx bumps an app whose imported
   library changed, yet lists only commits to the app's own files, so the changelog renderer
   (`DependencyChangelogRenderer`, set in `nx.json`) adds the commits since the app's last
   release tag that touched any workspace library the app imports, directly or through another
   library. Those entries make the app release and show which change caused the bump; a
   library change the app does not import adds nothing. Relies on `entryWhenNoChanges: false` in `nx.json`'s
   `projectChangelogs`; with `--skipChangelog` nothing is skipped.
6. Bumps the root `package.json` to the highest release type (major/minor/patch) among the
   projects actually released this run, unless `--skipWorkspaceVersion`. Logs a warning and
   skips the bump if nothing was released.
7. Writes a `release-manifest.json` (via the `release-manifest` generator) for each project that
   received a new version, unless `--skipManifest`.
8. Formats the tree unless `--skipFormat`.
9. Returns a callback — invoked by Nx after the tree is flushed to disk — that, only if there's
   something to release:
   - commits the changelog, manifest, and workspace-version changes as **one** release commit;
   - tags each released project `<project>@<version>` unless `--skipTag`;
   - pushes the branch (`--force-with-lease --follow-tags`);
   - opens or updates the GitHub pull request from the release branch into `targetBranch`,
     unless `--skipPullRequest`, `--skipBranch`, or the release branch already equals
     `targetBranch`. A failure here is logged with a manual `gh pr create` fallback rather than
     failing the release — the branch is already pushed by that point. The PR is always
     authored by `cybertec-bot` (the maintainer cannot approve a PR they authored, and a PR's
     author cannot be changed later): the generator reads the bot's stored `gh` token
     (`gh auth token --user cybertec-bot`) and uses it for the PR calls only, so the active `gh`
     account does not matter. If the bot is not logged in on the machine (e.g. in CI, where `gh`
     authenticates through `GH_TOKEN`), it falls back to the active account and warns when that
     account is not the bot.
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

| Option                 | Type     | Default   | Notes                                                                                              |
| ---------------------- | -------- | --------- | -------------------------------------------------------------------------------------------------- |
| `affected`             | boolean  | `false`   | Narrow to projects both configured as releasable and affected since the release window.            |
| `projects` / `-p`      | string[] | all       | Explicit project list. Ignored when `--affected` resolves its own list.                            |
| `vers` / `-v`          | string   | —         | Explicit semver or release type, overriding conventional-commits detection.                        |
| `firstRelease`         | boolean  | `false`   | Passed through to Nx's `releaseVersion`/`releaseChangelog`.                                        |
| `baseBranch`           | string   | `develop` | Branch the release branch is cut from (or committed to, with `--skipBranch`).                      |
| `base`                 | string   | —         | Explicit git revision for the `--affected` scan, overriding the `targetBranch` merge-base.         |
| `author`               | string   | git user  | Author recorded in each release manifest.                                                          |
| `releaseDate`          | string   | now       | ISO date-time. Names the release branch and dates the `chore(release): <date>` pull request title. |
| `skipBranch`           | boolean  | `false`   | Commit to `baseBranch` directly instead of cutting `release/<date>`.                               |
| `skipChangelog`        | boolean  | `false`   | Skip `releaseChangelog` entirely.                                                                  |
| `skipManifest`         | boolean  | `false`   | Skip writing `release-manifest.json` for released projects.                                        |
| `skipPullRequest`      | boolean  | `false`   | Skip opening/updating the GitHub promotion pull request.                                           |
| `skipPublish`          | boolean  | `true`    | Reserved — no publish step exists yet; this flag is currently a no-op.                             |
| `skipTag`              | boolean  | `false`   | Skip creating the `<project>@<version>` git tag per released project.                              |
| `skipWorkspaceVersion` | boolean  | `false`   | Skip bumping the root `package.json` version.                                                      |
| `skipFormat`           | boolean  | `false`   | Skip formatting generated files.                                                                   |
| `targetBranch`         | string   | `main`    | Branch the promotion pull request merges into.                                                     |

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
