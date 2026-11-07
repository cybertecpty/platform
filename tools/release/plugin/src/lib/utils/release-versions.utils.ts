import type { VersionData } from '@cybertecpty/nx-types';
import type { ReleaseType } from 'semver';
import { diff, RELEASE_TYPES } from 'semver';

export type WorkspaceReleaseType = Extract<ReleaseType, 'major' | 'minor' | 'patch'>;

/**
 * Determines if the provided value is a valid semver release type.
 */
export function isReleaseType(value: string): value is ReleaseType {
  return (RELEASE_TYPES as readonly string[]).includes(value);
}

/**
 * Narrows version data to the named projects, preserving each project's entry as Nx produced it.
 */
export function pickVersionData(
  versionData: VersionData,
  projects: readonly string[]
): VersionData {
  return Object.fromEntries(projects.map(project => [project, versionData[project]]));
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
