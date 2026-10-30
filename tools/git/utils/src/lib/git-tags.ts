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
  // An exact ref lookup, not `git tag --list`, which reads the name as a glob.
  // --quiet prints nothing for a missing ref, and simple-git resolves that
  // empty exit-1 result; any other failure still throws.
  const commit = await git.raw([
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/tags/${tagName}^{commit}`
  ]);

  return commit.trim() || null;
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
