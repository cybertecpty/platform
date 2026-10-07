export interface PackageJsonGeneratorOptions {
  /**
   * Dependency names to copy from the root package.json's `dependencies`/
   * `devDependencies` into the generated file's `dependencies`. Throws if any name
   * isn't found in either map.
   */
  dependencies?: string[];
  /** Entry point written to `main`. Omitted when not provided. */
  main?: string;
  /** Semver range written to `engines.node`. Omitted when not provided. */
  nodeEngine?: string;
  /**
   * Replace an existing `package.json` at the resolved path. Without this, an
   * existing file is left untouched (with a warning). This is a full replace, not a
   * merge — existing custom fields are discarded.
   */
  overwrite?: boolean;
  /** Marks the package private. Defaults to `true`; omitted entirely when `false`. */
  private?: boolean;
  /** Skip formatting generated files. */
  skipFormat?: boolean;
  /** Command written to `scripts.start`. Omitted when not provided. */
  startScript?: string;
  /** Explicit semantic version written to `version`. Defaults to `'0.0.1'`. */
  vers?: string;
  /** Directory the package.json is created in, relative to the workspace root. */
  dir: string;
  /** Package name without the workspace npm scope. Final name is `<scope>/<name>`. */
  name: string;
}
