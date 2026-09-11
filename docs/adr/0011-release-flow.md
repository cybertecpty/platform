# 11. Release flow: branch-cut, single-commit, PR-promoted releases

- Status: proposed
- Date: 2026-09-11
- Deciders: djmcgrath
- Implemented by (in progress): `@cybertecpty/release-plugin`'s `release` generator
  (`tools/release/plugin/src/lib/generators/release/`) and its supporting
  `@cybertecpty/release-utils`, `@cybertecpty/git-utils`, `@cybertecpty/github-utils` libs, on
  branch `feat/release-generator` (not yet merged)

## Context and problem statement

This workspace releases projects independently (`nx.json` `release.projectsRelationship:
"independent"`, groups `packages/*` / `apps/*`). Branch protection on `main`
(`docs/agents/conventions.md` §2) requires a pull request, one maintainer approval, and the `ci`
check — no direct pushes, no bypass actor. `develop → main` promotion PRs merge as **merge
commits, not squash**, specifically so the `{project}@{version}` tags a release creates survive
onto `main` (ADR 0002).

Native `nx release` has no concept of a promotion PR: it versions, changelogs, tags, and
(optionally) pushes and publishes directly on whatever branch is checked out, and its GitHub
integration creates a GitHub _Release_ (a tag + notes object), not a mergeable pull request.
Given branch protection, running it directly against `main` isn't possible without a
protection bypass — which the bot is deliberately never granted (conventions.md §1: "Do not
grant the bot bypass rights to force a self-merge"). Some custom orchestration around `nx
release` is therefore structurally required, not a matter of preference.

Separately, two workspace-specific needs have no native Nx equivalent at all:

- Each released project should carry a durable, git-committed manifest recording what was
  released — the app's own source of truth for its release metadata, readable without git
  access at runtime.
- The workspace as a whole should carry one version number tracking overall release cadence,
  independent of (but derived from) the individual project versions released in a given run.

## Decision drivers

- Every change that lands on `main` — releases included — goes through the same review gate as
  everything else: no bypass, no direct push.
- A maintainer approving a release PR should see everything landing in it, not just the
  versioned packages — tooling, docs, and infra changes included.
- Released projects need a durable, committed record of their own release metadata that doesn't
  depend on git access at runtime.
- The workspace needs one version number tracking release cadence as a whole.
- Prefer Nx's own versioning/changelog engine over reimplementing it; build custom code only
  where Nx genuinely has no equivalent.

## Considered options

1. **Run native `nx release` directly against `main`.** Requires a branch-protection bypass or a
   manual promotion step after the fact — defeats the point of using the CLI's automation.
2. **Native `nx release` with `changelog.createRelease: 'github'`, plus a manual merge to get the
   changes onto `main`.** A GitHub Release is a tag-and-notes artifact, not a mergeable change —
   something still has to open the actual PR by hand. Solves neither the review-gate requirement
   nor the manifest/workspace-version needs.
3. **A custom generator**: cut a release branch, run Nx's own versioning/changelog
   programmatically, layer a per-project manifest and a workspace-version bump onto the same
   release commit, tag, push, and open a promotion PR through the normal review gate.
   **(chosen)**

## Decision outcome

Chosen option: **3**.

### Flow shape

- **Release branch.** `release/<date>`, cut from `baseBranch` (default `develop`); or, with
  `--skipBranch`, committed straight to `baseBranch` with no dedicated branch.
- **Versioning and changelog.** Delegated to Nx's own programmatic `nx/release` API
  (`releaseVersion` / `releaseChangelog`) — not reimplemented. The release graph `releaseVersion`
  builds is reused for `releaseChangelog` rather than recomputed.
- **One release commit.** The version and changelog changes Nx computes, a release manifest per
  released project, and the workspace version bump all land in a single commit. This isn't an
  arbitrary constraint — Nx's own default behavior for independent releases already produces one
  combined commit across every released project; this flow extends that same commit to include
  the manifest and workspace bump rather than splitting them out.
- **Per-project tags.** `<project>@<version>`, matching Nx's own default tag pattern for
  independent releases, so Nx's own tag-based version/changelog resolution keeps working on the
  next release.
- **Promotion PR.** Opened from the release branch into `targetBranch` (default `main`),
  carrying per-project changelog sections plus a "workspace changes" section surfacing PR
  commits no project changelog covers (tooling, docs, infra) — grouped by the project they
  touched. Subject to the same branch protection as any other PR into `main`: one maintainer
  approval, `ci`, no bypass.
- **Release manifest.** `release-manifest.json` per released project — author, project, version,
  release date, and the commit the release was built from — intended as that project's own
  runtime source of truth for release metadata.
- **Workspace version.** The root `package.json` version is bumped to the highest bump level
  (major/minor/patch) among the projects released in a run — a whole-repo cadence marker,
  distinct from and not published alongside individual project versions.

## Consequences

### Positive

- Every release goes through the exact review gate every other change to `main` goes through —
  no bypass, no exception.
- One release commit per run: easy to identify, audit, or revert.
- Reviewers see the full contents of a release PR, not just the versioned packages.
- Released projects get a durable, committed record of their own release metadata, independent
  of git access at runtime.
- Reuses Nx's own versioning, changelog, and tagging conventions rather than reinventing them.

### Negative / risks

- Meaningfully more custom code than `nx release` alone — a generator plus several supporting
  libs, all of which have to track Nx's release API as it evolves. This has already required one
  fix: an internal Nx import path moved to the public `nx/release` entrypoint.
- No publish step exists yet. The flow versions, tags, and promotes; it does not currently push
  anything to a registry.
- A few correctness gaps are open as of this writing, noted here so this ADR doesn't read as
  more finished than the implementation is: the release manifest's date can drift from the
  release branch's own date; a prerelease-type version bump can silently skip the workspace
  version bump; interleaving Nx's disk-writing release calls with the generator's own
  Tree-based writes is not yet verified safe against a mid-run failure.
- CI/automation-only by design. Run against a real, shared clone, it carries the same
  concurrent-session hazards as any other git-mutating agent work (conventions.md §5).

## More information

- ADR 0002 (`develop-as-default-branch`) — also the origin of the merge-commit-not-squash rule
  for `main` promotion PRs this flow depends on to keep its release tags intact.
- `docs/agents/conventions.md` §1–§2 — bot git identity, branch protection, and the no-bypass
  rule this flow is built around.
- `@cybertecpty/release-plugin`'s `release` generator and its supporting `release-utils` /
  `git-utils` / `github-utils` libs — the current implementation. Not authoritative for future
  changes to the flow's shape; update this ADR if the shape itself changes, not just the code.
