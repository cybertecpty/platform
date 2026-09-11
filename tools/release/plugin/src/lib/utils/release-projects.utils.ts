import { gitMergeBase, gitTagsMatching } from '@cybertecpty/git-utils';
import { VersionData } from '@cybertecpty/nx-types';
import { findMatchingProjects, getAffectedGraphNodes, type NxArgs } from '@cybertecpty/nx-utils';
import { createProjectGraphAsync, logger, readNxJson, Tree, type ProjectGraph } from '@nx/devkit';
import simpleGit, { type SimpleGit } from 'simple-git';

/**
 * Narrows a release to only the projects that changed in this release window.
 */
export interface AffectedReleaseProjectsOptions {
  /**
   * Explicit base git revision for the affected scan. Overrides the merge-base
   * with {@link AffectedReleaseProjectsOptions.targetBranch}.
   */
  readonly base?: string;
  /**
   * The branch the release merges into (e.g. `main`). The merge-base of this
   * branch and `HEAD` marks the start of the release window.
   */
  readonly targetBranch: string;
}

/**
 * Builds the `NxArgs` for {@link getAffectedGraphNodes}. `base` is resolved to a
 * concrete revision ({@link resolveAffectedBase}); `head` is pinned to `HEAD` so
 * the scan is the committed `base..HEAD` diff and ignores working-tree state —
 * this runs before the release branch is cut, so the tree may still be dirty.
 */
async function createAffectedNxArgs(
  opts: AffectedReleaseProjectsOptions,
  git: SimpleGit
): Promise<NxArgs> {
  return {
    base: await resolveAffectedBase(opts, git),
    head: 'HEAD'
  };
}

/**
 * Narrows the release to the projects that both (a) are configured as
 * releasable in `nx.json` and (b) actually changed in this release window.
 *
 * `nx.json`'s release config says what *can* be released; the affected scan
 * says what *did* change since {@link resolveAffectedBase}. Only the
 * intersection should get a version bump — releasing an untouched project would
 * republish it for no reason.
 *
 * @param tree The generator's virtual file system, used to read `nx.json`.
 * @param opts The affected-scan window.
 * @param git The git client to use. Defaults to a `simpleGit()` on the cwd.
 */
export async function resolveAffectedReleaseProjects(
  tree: Tree,
  opts: AffectedReleaseProjectsOptions,
  git: SimpleGit = simpleGit()
): Promise<string[]> {
  const projectGraph = await createProjectGraphAsync();

  // Projects touched (directly or transitively via a changed dependency)
  // between the resolved base and HEAD. Delegates to Nx's own affected
  // algorithm so the result matches `nx affected`.
  const affectedProjects = await getAffectedGraphNodes(
    await createAffectedNxArgs(opts, git),
    projectGraph
  );

  return selectAffectedReleaseProjects(
    resolveReleaseProjects(tree, projectGraph),
    affectedProjects.map(project => project.name)
  );
}

/**
 * Intersects the configured releasable set with the projects the affected scan
 * flagged, keeping the release-config order (it drives the release sequence). A
 * releasable project that wasn't touched is dropped — releasing an unchanged
 * project would republish it for nothing.
 */
export function selectAffectedReleaseProjects(
  releaseProjects: readonly string[],
  affectedProjectNames: Iterable<string>
): string[] {
  const affected = new Set(affectedProjectNames);

  return releaseProjects.filter(projectName => affected.has(projectName));
}

/**
 * Picks the commit that marks the start of this release's changes. Everything
 * between it and HEAD is "the work in this release"; the affected-project scan
 * uses it as its starting point.
 *
 * We measure from the released branch (`targetBranch`, normally `main`) because
 * a release is "what's new since the last release". A caller can override with
 * an explicit `base`.
 *
 * Why the merge-base instead of the branch name directly: `main` keeps moving
 * (e.g. a hotfix lands on it after this release branch was cut). Comparing
 * against `main`'s current tip would treat that unrelated commit as missing
 * from our branch and flag the projects it touched. The merge-base is the last
 * commit our branch and `main` share, i.e. the point our branch split off, so
 * only our own commits get counted. Falls back to the branch name if the
 * merge-base can't be found (e.g. a shallow clone without `main`).
 */
export async function resolveAffectedBase(
  opts: AffectedReleaseProjectsOptions,
  git: SimpleGit = simpleGit()
): Promise<string> {
  const ref = opts.base ?? opts.targetBranch;

  return (await gitMergeBase(ref, 'HEAD', git)) ?? ref;
}

/**
 * Reads the release project patterns from `nx.json`, without touching the
 * project graph.
 *
 * Nx accepts the releasable set in one of two mutually exclusive forms, and we
 * support both:
 * - `release.projects`: a pattern or list of patterns at the top level.
 * - `release.groups`: named groups, each with its own `projects` patterns; the
 *   releasable set is the union across every group.
 *
 * One of the two forms is required config for us — without it there's no way to
 * know what "affected release projects" even means — so a config with neither
 * is a hard error. Patterns that simply match no project yet are not: the
 * caller treats an empty match as "nothing to release".
 */
export function readReleasePatterns(tree: Tree): string[] {
  const release = readNxJson(tree)?.release;

  const patterns = release?.groups
    ? Object.values(release.groups).flatMap(group => toProjectPatternArray(group.projects))
    : toProjectPatternArray(release?.projects);

  if (patterns.length === 0) {
    throw new Error(
      'nx.json configures no releasable projects: set release.projects or release.groups.'
    );
  }

  return patterns;
}

/**
 * Resolves `nx.json`'s release config into the concrete project names present
 * in `projectGraph`. Patterns are project names, globs, or tag/directory
 * selectors; `findMatchingProjects` matches them against the graph and de-dupes.
 * See {@link readReleasePatterns} for the accepted config shapes.
 */
export function resolveReleaseProjects(tree: Tree, projectGraph: ProjectGraph): string[] {
  return findMatchingProjects(readReleasePatterns(tree), projectGraph.nodes);
}

/**
 * Creates an annotated `<project>@<version>` tag on the release commit for each
 * project that received a new version. The tag format matches Nx's default
 * `releaseTagPattern` for independently-released projects, so Nx uses these
 * tags to resolve the previous release boundary when calculating
 * conventional-commit version bumps and changelog commit ranges.
 *
 * @returns The names of the tags created in this run.
 */
export async function tagReleasedProjects(
  versionData: VersionData,
  skipTag: boolean | undefined,
  git: SimpleGit = simpleGit()
): Promise<string[]> {
  if (skipTag) {
    return [];
  }

  const createdTags: string[] = [];

  for (const [project, projectVersionData] of Object.entries(versionData)) {
    const newVersion = projectVersionData?.newVersion;

    // Projects without a version change were not released in this run.
    if (!newVersion) {
      continue;
    }

    const tagName = `${project}@${newVersion}`;

    // Same-day release re-runs must not fail on a tag created by an earlier run.
    if ((await gitTagsMatching(tagName, git)).includes(tagName)) {
      logger.warn(`Tag ${tagName} already exists. Skipping tag creation.`);
      continue;
    }

    await git.addAnnotatedTag(tagName, tagName);
    createdTags.push(tagName);
  }

  if (createdTags.length) {
    logger.info(`Created release tags: ${createdTags.join(', ')}`);
  }

  return createdTags;
}

/**
 * Normalizes Nx's `string | string[] | undefined` project-pattern field into a
 * plain array.
 */
function toProjectPatternArray(patterns: string | string[] | undefined): string[] {
  if (Array.isArray(patterns)) {
    return patterns;
  }

  return patterns ? [patterns] : [];
}
