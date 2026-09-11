/**
 * Contents of a `release-manifest.json` — the release metadata the
 * `@cybertecpty/release-plugin:release-manifest` generator writes for a project.
 * Keys are serialized in alphabetical order.
 */
export interface ReleaseManifest {
  /**
   * Release author. Defaults to `<git user name> (<git user email>)` (the email
   * is dropped when it is not configured). Absent when no name could be
   * resolved and none was supplied.
   */
  readonly author?: string;
  /** Name of the workspace project the release is for. */
  readonly project: string;
  /**
   * The commit the release was built from, verbatim as passed to the generator
   * (usually a short hash). Not the commit this manifest itself is committed
   * in — that commit only adds release metadata, never application code, so
   * this is the meaningful "what commit is this running" value.
   */
  readonly sourceCommit: string;
  /** Release timestamp as an ISO 8601 UTC string, e.g. `2026-04-22T15:30:00.000Z`. */
  readonly releaseDate: string;
  /** The released semantic version, verbatim as passed to the generator. */
  readonly version: string;
}
