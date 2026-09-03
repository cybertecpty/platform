import simpleGit, { type SimpleGit } from 'simple-git';

/**
 * Gets the local Git user's name.
 *
 * @returns A promise that resolves to the configured `user.name`, or `''` when it is not set.
 */
export async function gitLocalUserName(git: SimpleGit = simpleGit()): Promise<string> {
  return (await git.getConfig('user.name', 'local')).value ?? '';
}

/**
 * Gets the local Git user's email address.
 *
 * @returns A promise that resolves to the configured `user.email`, or `''` when it is not set.
 */
export async function gitLocalUserEmail(git: SimpleGit = simpleGit()): Promise<string> {
  return (await git.getConfig('user.email', 'local')).value ?? '';
}
