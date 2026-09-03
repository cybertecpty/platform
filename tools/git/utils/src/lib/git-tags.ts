import simpleGit, { type SimpleGit } from 'simple-git';

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
