import { gitBranchExists } from '@cybertecpty/git-utils';
import type { VersionData } from '@cybertecpty/nx-types';
import { logger } from '@nx/devkit';
import { simpleGit, type SimpleGit } from 'simple-git';

/**
 * Inputs for {@link assertBaseIncludesTarget}.
 */
export interface BaseIncludesTargetOptions {
  /** The branch the release is cut from (e.g. `develop`). */
  readonly baseBranch: string;
  /** When set, a stale base is reported as a warning instead of an error. */
  readonly dryRun: boolean;
  /** The branch the release merges into (e.g. `main`). */
  readonly targetBranch: string;
}

/**
 * Fails when `origin/<targetBranch>` holds commits that `origin/<baseBranch>`
 * lacks. A release cut from such a base resolves its previous release from the
 * wrong tags and re-releases a version `main` already has. The remote branches
 * are compared, so an out-of-date local branch cannot mask the problem. This
 * only checks; it never merges.
 *
 * In a dry run nothing is written, so the problem is logged and the run goes on.
 */
export async function assertBaseIncludesTarget(
  opts: BaseIncludesTargetOptions,
  git: SimpleGit = simpleGit()
): Promise<void> {
  const { baseBranch, dryRun, targetBranch } = opts;

  // --tags so a release tag that exists only on origin is visible to the tag check too.
  await git.fetch(['origin', baseBranch, targetBranch, '--tags']);

  const missing = Number(
    (await git.raw(['rev-list', '--count', `origin/${baseBranch}..origin/${targetBranch}`])).trim()
  );

  if (Number.isNaN(missing)) {
    throw new Error(
      `Could not compare origin/${baseBranch} with origin/${targetBranch}: unexpected git output.`
    );
  }

  if (missing === 0) {
    return;
  }

  const message =
    `origin/${targetBranch} has ${missing} commit(s) that origin/${baseBranch} lacks. ` +
    `Back-merge ${targetBranch} into ${baseBranch} (as a merge commit, not a squash) ` +
    `and re-run the release.`;

  if (dryRun) {
    logger.warn(`Stale base: ${message}`);
    return;
  }

  throw new Error(`Cannot release from a stale base: ${message}`);
}

/**
 * Fails when a release tag the run would create already exists on a commit that
 * is not part of the release branch. A same-day re-run is fine: its tags point
 * into the existing `release/<date>` branch.
 *
 * @param versionData The versions the run resolved, one `<project>@<version>` tag each.
 * @param releaseBranch The branch the release is committed to.
 */
export async function assertReleaseTagsAvailable(
  versionData: VersionData,
  releaseBranch: string,
  git: SimpleGit = simpleGit()
): Promise<void> {
  const branchExists = await gitBranchExists(releaseBranch, git);

  for (const [project, projectVersionData] of Object.entries(versionData)) {
    const newVersion = projectVersionData?.newVersion;

    if (!newVersion) {
      continue;
    }

    const tagName = `${project}@${newVersion}`;
    const tagCommit = await resolveTagCommit(tagName, git);

    if (tagCommit === null) {
      continue;
    }

    if (branchExists && (await isAncestor(tagCommit, releaseBranch, git))) {
      continue;
    }

    throw new Error(
      `Release tag ${tagName} already exists on commit ${tagCommit.slice(0, 10)}, which is not on ` +
        `${releaseBranch}. Releasing again would duplicate it; check that the previous release was ` +
        `back-merged into the base branch.`
    );
  }
}

/** Whether `commit` is reachable from `ref` (`git merge-base --is-ancestor`). */
async function isAncestor(commit: string, ref: string, git: SimpleGit): Promise<boolean> {
  try {
    await git.raw(['merge-base', '--is-ancestor', commit, ref]);
    return true;
  } catch {
    return false;
  }
}

/** The commit a tag points at, or `null` when the tag does not exist. */
async function resolveTagCommit(tagName: string, git: SimpleGit): Promise<string | null> {
  try {
    return (await git.raw(['rev-list', '-n', '1', `refs/tags/${tagName}`])).trim() || null;
  } catch {
    return null;
  }
}
