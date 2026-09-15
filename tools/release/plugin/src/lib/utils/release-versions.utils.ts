import { gitTagsMatching } from '@cybertecpty/git-utils';
import { VersionData } from '@cybertecpty/nx-types';
import { compare, diff, RELEASE_TYPES, ReleaseType, valid } from 'semver';

export type WorkspaceReleaseType = Extract<ReleaseType, 'major' | 'minor' | 'patch'>;

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

/**
 * Determines if the provided value is a valid semver release type.
 */
export function isReleaseType(value: string): value is ReleaseType {
  return (RELEASE_TYPES as readonly string[]).includes(value);
}

/**
 * Determines the workspace release level from project version changes.
 */
export function resolveWorkspaceReleaseType(versionData: VersionData): WorkspaceReleaseType | null {
  const releaseTypes = Object.values(versionData)
    .map(projectVersionData =>
      resolveProjectReleaseType(projectVersionData.currentVersion, projectVersionData.newVersion)
    )
    .filter((releaseType): releaseType is WorkspaceReleaseType => releaseType !== null);

  if (releaseTypes.includes('major')) {
    return 'major';
  }

  if (releaseTypes.includes('minor')) {
    return 'minor';
  }

  if (releaseTypes.includes('patch')) {
    return 'patch';
  }

  return null;
}

/**
 * Resolves the project release level from its version change.
 *
 * @param currentVersion The current version of the project.
 * @param newVersion The new version of the project.
 * @returns The release type ('major', 'minor', 'patch') or null if no release is needed.
 */
export function resolveProjectReleaseType(
  currentVersion: string,
  newVersion: string | null
): WorkspaceReleaseType | null {
  if (!newVersion) {
    return null;
  }

  const releaseType = diff(currentVersion, newVersion);

  return releaseType === 'major' || releaseType === 'minor' || releaseType === 'patch'
    ? releaseType
    : null;
}
