import { gitBranchExists, gitCurrentBranch, isCleanGitBranch } from '@cybertecpty/git-utils';
import { logger } from '@nx/devkit';
import { simpleGit, type SimpleGit } from 'simple-git';

/**
 * Inputs shared by {@link resolveReleaseBranchName} and {@link checkoutReleaseBranch}.
 */
export interface ReleaseBranchOptions {
  /** The branch a new release branch is cut from (e.g. `develop`). */
  readonly baseBranch: string;
  /** The release date as an ISO string; its date part names the release branch. */
  readonly releaseDate: string;
  /** Commit straight to {@link baseBranch} instead of creating a `release/<date>` branch. */
  readonly skipBranch: boolean;
}

/**
 * The outcome of {@link checkoutReleaseBranch}.
 */
export type CheckoutReleaseBranchResult = {
  /** The branch now checked out, which release artifacts should be committed to. */
  readonly releaseBranch: string;
  /**
   * The branch that was checked out before the call, for the caller to restore
   * once the release is done. `null` when nothing needs restoring — HEAD was
   * already on {@link releaseBranch}, or was detached.
   */
  readonly restoreBranch: string | null;
};

/**
 * Works out the {@link CheckoutReleaseBranchResult.restoreBranch} value: the
 * branch to return to afterwards, or `null` when there is nothing to restore
 * because HEAD was already on `releaseBranch` or was detached (`currentBranch`
 * is `''` in a detached `HEAD`, and `null` is never passed today).
 */
function getRestoreBranch(currentBranch: string | null, releaseBranch: string): string | null {
  return currentBranch && currentBranch !== releaseBranch ? currentBranch : null;
}

/**
 * The branch this release's artifacts belong on: `release/<date>` (the date part
 * of `releaseDate`), or `baseBranch` itself when `skipBranch` is set.
 *
 * This is the single home of the `release/<date>` naming convention — both the
 * dry-run path (which only needs the name) and {@link checkoutReleaseBranch}
 * derive it here.
 */
export function resolveReleaseBranchName(opts: ReleaseBranchOptions): string {
  return opts.skipBranch ? opts.baseBranch : `release/${opts.releaseDate.split('T')[0]}`;
}

/**
 * Puts the working tree on the branch that should receive this release's
 * generated artifacts and reports which branch (if any) to switch back to
 * afterwards.
 *
 * - `skipBranch`: checks out `baseBranch` and commits the release there.
 * - an existing `release/<date>` branch: checks it out as-is.
 * - otherwise: refreshes `baseBranch` from `origin` and cuts `release/<date>`
 *   from it.
 *
 * Always performs real git work. Callers that support a dry run should resolve
 * the name with {@link resolveReleaseBranchName} and skip this call.
 *
 * @param opts The base branch, release date, and skip flag.
 * @param git The git client to use. Defaults to a `simpleGit()` on the cwd.
 * @returns The branch release artifacts belong on, and the branch to restore
 *   afterwards (`null` when no switch happened or none is needed).
 */
export async function checkoutReleaseBranch(
  opts: ReleaseBranchOptions,
  git: SimpleGit = simpleGit()
): Promise<CheckoutReleaseBranchResult> {
  const { baseBranch, skipBranch } = opts;

  if (!(await isCleanGitBranch(git))) {
    throw new Error(
      'Cannot checkout release branch. Working directory is not clean. Please commit or stash your changes to proceed.'
    );
  }

  const currentBranch = await gitCurrentBranch(git);

  if (skipBranch) {
    logger.warn(
      `Skipping release branch creation. Will instead commit changes to the base branch ${baseBranch}.`
    );

    if (currentBranch !== baseBranch) {
      await git.checkout(baseBranch);
    }

    return {
      releaseBranch: baseBranch,
      restoreBranch: getRestoreBranch(currentBranch, baseBranch)
    };
  }

  const releaseBranch = resolveReleaseBranchName(opts);

  // An existing release branch must become HEAD before we generate any release
  // artifacts.
  if (await gitBranchExists(releaseBranch, git)) {
    if (currentBranch !== releaseBranch) {
      await git.checkout(releaseBranch);
    }
  } else {
    // A new release branch is always cut from the latest base branch state.
    await git.checkout(baseBranch);
    await git.pull('origin', baseBranch);
    await git.checkoutLocalBranch(releaseBranch);
  }

  return {
    releaseBranch,
    restoreBranch: getRestoreBranch(currentBranch, releaseBranch)
  };
}
