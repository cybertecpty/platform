import simpleGit, { type SimpleGit } from 'simple-git';

/**
 * Determines if a local Git branch already exists.
 *
 * @param branchName The name of the local branch to check.
 * @returns A promise that resolves to true if the local branch exists, false otherwise.
 */
export async function gitBranchExists(
  branchName: string,
  git: SimpleGit = simpleGit()
): Promise<boolean> {
  return (await git.branchLocal()).all.includes(branchName);
}

/**
 * Gets the currently checked out local Git branch name, or an empty string when
 * `HEAD` is detached.
 *
 * @returns A promise that resolves to the current branch name, or `''` in detached `HEAD`.
 */
export async function gitCurrentBranch(git: SimpleGit = simpleGit()): Promise<string> {
  return (await git.branchLocal()).current;
}

/**
 * Determines if the working tree and index have no uncommitted changes.
 *
 * @returns A promise that resolves to true if the working tree is clean, false otherwise.
 */
export async function isCleanGitBranch(git: SimpleGit = simpleGit()): Promise<boolean> {
  return (await git.status()).isClean();
}

/**
 * Determines if the provided branch name is the currently checked out branch.
 *
 * @param branchName The name of the branch to check.
 * @returns A promise that resolves to true if the current branch is the specified branch, false otherwise.
 */
export async function isCurrentGitBranch(
  branchName: string,
  git: SimpleGit = simpleGit()
): Promise<boolean> {
  return (await git.branchLocal()).current === branchName;
}
