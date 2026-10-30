import simpleGit, { type SimpleGit } from 'simple-git';

/**
 * Gets the commit a tag points at, peeling an annotated tag to its commit.
 *
 * @param tagName The exact tag name.
 * @returns The commit hash, or `null` when no such tag exists. Other git
 *   failures still throw.
 */
export async function gitTagCommit(
  tagName: string,
  git: SimpleGit = simpleGit()
): Promise<string | null> {
  if (!(await git.raw(['tag', '--list', tagName])).trim()) {
    return null;
  }

  return (await git.raw(['rev-list', '-n', '1', `refs/tags/${tagName}`])).trim();
}

/**
 * Gets the tags whose name contains the given substring.
 *
 * @param tagName The substring to match against each tag name.
 * @returns A promise that resolves to the matching tag names.
 */
export async function gitTagsMatching(
  tagName: string,
  git: SimpleGit = simpleGit()
): Promise<string[]> {
  const tags = await git.tags();

  return tags.all.filter(tag => tag.includes(tagName));
}
