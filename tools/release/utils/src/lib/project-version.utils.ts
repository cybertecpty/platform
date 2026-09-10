import { gitTagsMatching } from '@cybertecpty/git-utils';
import { compare, valid } from 'semver';

/**
 * Retrieves the semantic version number for the most recent project release.
 *
 * @param projectName The name of the project to get the latest version for.
 * @returns The latest version of the project, or undefined if no versions were found.
 */
export async function getLatestProjectVersion(projectName: string): Promise<string | undefined> {
  const versions = await getProjectVersions(projectName);

  return versions[0];
}

/**
 * Retrieves all the Git tag versions matching the specified project name.
 * The tags are expected to be in the format `project@version`.
 *
 * @param projectName The name of the project to get versions for.
 * @param sortDir The direction to sort the versions in.  Defaults to descending (newest to oldest).
 * @returns The list of versions for the project
 */
export async function getProjectVersions(
  projectName: string,
  sortDir: 'asc' | 'desc' = 'desc'
): Promise<readonly string[]> {
  const tagPrefix = `${projectName}@`;
  const projectTags = await gitTagsMatching(tagPrefix);

  return projectTags
    .filter(tag => tag.startsWith(tagPrefix))
    .map(tag => tag.slice(tagPrefix.length))
    .filter(version => valid(version) !== null)
    .sort((a, b) => (sortDir === 'asc' ? compare(a, b) : compare(b, a)));
}
