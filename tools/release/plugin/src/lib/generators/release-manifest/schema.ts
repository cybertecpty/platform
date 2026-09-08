export interface ReleaseManifestGeneratorOptions {
  /**
   * Release author. Defaults to the local git user name for applications, and
   * `<git user name> (<git user email>)` for libraries. When no name resolves,
   * the `author` key is omitted from the manifest.
   */
  author?: string;
  /**
   * Output directory for the manifest, relative to the project root. Defaults to
   * the project root itself.
   */
  dirPath?: string;
  /** The workspace project to generate the manifest for. */
  project: string;
  /** The commit being released. Written to the manifest verbatim. */
  releaseCommit: string;
  /**
   * Release timestamp. Any value `Date` can parse is accepted and normalized to
   * an ISO 8601 UTC string. Defaults to the current date and time.
   */
  releaseDate?: string;
  /** Skip formatting files. */
  skipFormat?: boolean;
  /** Semantic version written to the manifest as `version`. */
  version: string;
}
