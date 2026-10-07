export interface FileArchiveGeneratorOptions {
  /** Output archive format. Defaults to `'zip'`. */
  format?: 'tar' | 'zip';
  /**
   * Directory the archive is written into, relative to the workspace root.
   * Defaults to `source`.
   */
  destination?: string;
  /**
   * Archive filename, written under `destination`. Defaults to
   * `<basename(source)>.<format>`.
   */
  filename?: string;
  /**
   * Replace an existing archive at the resolved output path. Without this,
   * an existing archive is left untouched (with a warning).
   */
  overwrite?: boolean;
  /** Directory to archive, relative to the workspace root. */
  source: string;
}
