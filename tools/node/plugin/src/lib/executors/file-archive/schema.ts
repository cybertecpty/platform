/**
 * Options for the `file-archive` executor. Keep in step with `schema.json`.
 */
export interface FileArchiveExecutorOptions {
  /**
   * Folder to archive, relative to the workspace root. Takes precedence over
   * `buildTarget`. Defaults to the single output the build target declares.
   */
  source?: string;

  /**
   * Target whose declared output is archived when `source` isn't set. Ignored when
   * `source` is set. Defaults to `build`.
   */
  buildTarget?: string;

  /** Archive format. Defaults to `zip`; `tar` is uncompressed. */
  format?: 'zip' | 'tar';

  /**
   * Folder the archive is written into, relative to the workspace root. Defaults to the
   * folder that contains `source`.
   */
  destination?: string;

  /** Archive filename, written under `destination`. Defaults to `<basename(source)>.<format>`. */
  filename?: string;
}
