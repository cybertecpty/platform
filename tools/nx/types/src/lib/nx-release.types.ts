import type { releaseChangelog, releaseVersion } from 'nx/release';

/**
 * Result of Nx's `releaseChangelog`. Derived from the public `nx/release`
 * entrypoint's return type rather than imported from Nx's internal
 * `command-line/release/changelog.js` module, which is unversioned and not
 * covered by semver.
 */
export type NxReleaseChangelogResult = Awaited<ReturnType<typeof releaseChangelog>>;

/**
 * Per-project rendered changelog entries returned by Nx changelog generation,
 * reused as the body of the release pull request.
 */
export type ProjectChangelogs = NonNullable<NxReleaseChangelogResult['projectChangelogs']>;

/**
 * Per-project version data produced by Nx's `releaseVersion`. Derived from the
 * public `nx/release` entrypoint's return type rather than imported from Nx's
 * internal `command-line/release/utils/shared.js` module.
 */
export type VersionData = Awaited<ReturnType<typeof releaseVersion>>['projectsVersionData'];
