import { SetRequired } from 'type-fest';

export interface ReleaseGeneratorOptions {
  /**
   * Release only affected projects from the nx.json release project set.
   */
  readonly affected?: boolean;
  /**
   * The author of the release.  Defaults to the local git user and email.
   */
  readonly author?: string;
  /**
   * Base git revision used by affected project detection.
   */
  readonly base?: string;
  /**
   * The base branch to use for the release.  Defaults to the develop branch.
   */
  readonly baseBranch?: string;
  /**
   * Whether this is the first release of the project.
   */
  readonly firstRelease?: boolean;
  /**
   * List of projects to release.  Defaults to all projects defined in the nx.json file.
   */
  readonly projects?: string[];
  /**
   * The date of the release as an ISO string.  Defaults to the current date.
   */
  readonly releaseDate?: string;
  /**
   * Skip creating a release branch.
   */
  readonly skipBranch?: boolean;
  /**
   * Skip generating the changelog.
   */
  readonly skipChangelog?: boolean;
  /**
   * Skip formatting generated files.
   */
  readonly skipFormat?: boolean;
  /**
   * Skip generating a release manifest for each project.
   */
  readonly skipManifest?: boolean;
  /**
   * Skip opening (or updating) the GitHub release pull request.
   */
  readonly skipPullRequest?: boolean;
  /**
   * Skip publishing the release.
   */
  readonly skipPublish?: boolean;
  /**
   * Skip creating a `<project>@<version>` git tag for each released project.
   */
  readonly skipTag?: boolean;
  /**
   * Skip bumping the workspace package.json version from released project version changes.
   */
  readonly skipWorkspaceVersion?: boolean;
  /**
   * The branch the release pull request merges into.  Defaults to the main branch.
   */
  readonly targetBranch?: string;
  /**
   * Explicit version specifier to use, if overriding conventional commits.
   */
  readonly vers?: string;
}

export type NormalizedReleaseGeneratorOptions = SetRequired<
  ReleaseGeneratorOptions,
  'baseBranch' | 'releaseDate' | 'skipBranch' | 'skipPullRequest' | 'targetBranch'
>;
