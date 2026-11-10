# Releasing

A release takes what is on `develop`, versions the projects that changed, and promotes it to `main`
through a pull request. One command does it: the custom `release` generator.

```powershell
pnpm exec nx g @cybertecpty/release-plugin:release --affected --dry-run   # preview
pnpm exec nx g @cybertecpty/release-plugin:release --affected             # cut the release
```

## One release run

1. **Check the base.** The generator fetches and stops if `main` has commits `develop` lacks (the
   automated back-merge normally prevents this). It writes nothing before this check passes.
2. **Pick the projects.** With `--affected`, only releasable projects that changed since the last
   release are considered. Projects with no changelog entries of their own and no released
   dependency are skipped. If none remain, the run ends with `Nothing needs releasing.`
3. **Cut `release/<date>`** from `develop`.
4. **Version and changelog.** Nx works out each project's next version from conventional commits,
   bumps `package.json` and writes `CHANGELOG.md`.
5. **Write the release manifest.** Each released project gets a `release-manifest.json` (author,
   version, date, source commit).
6. **Bump the workspace version.** The root `package.json` takes the highest bump (major, minor or
   patch) among the released projects.
7. **Commit once, tag, push.** Everything lands in one release commit. Each project is tagged
   `<project>@<version>` and the branch is pushed with its tags.
8. **Open the promotion PR** from the release branch into `main`, as `cybertec-bot`, listing each
   project's changelog and the workspace changes no project changelog covers.
9. **Merge the PR as a merge commit** after a maintainer approves it and `lint-and-test-affected`
   passes. Never squash: that orphans the tags. The back-merge then brings `main` back into
   `develop`.

## What you would do by hand

| Step                                                                              | Hard by hand? |
| --------------------------------------------------------------------------------- | ------------- |
| Open a promotion PR that satisfies branch protection (no direct push, no bypass)  | **Main gain** |
| Decide which projects need a release, including apps bumped by a library they use | **Main gain** |
| Bump each project's version from its commits and write its changelog              | **Main gain** |
| Write a PR body covering every change, not only the versioned projects            | Yes           |
| Push and author the PR as the bot, so the maintainer is allowed to approve it     | Yes           |
| Create a `release-manifest.json` per project                                      | Easy, tedious |
| Bump the workspace version                                                        | Easy, tedious |
| Tag each project and push the tags                                                | Easy, tedious |

Doing this by hand is possible but each step is easy to get slightly wrong, and a wrong tag or
version breaks the next release's baseline.

## Where the detail lives

- [ADR 0011](adr/0011-release-flow.md) — why the flow is branch-cut, single-commit and
  PR-promoted.
- [Generator README](../tools/release/plugin/src/lib/generators/release/README.md) — options,
  preflight checks, prerequisites and known limitations.
- [ADR 0015](adr/0015-automated-back-merge.md) — the back-merge after each release.
