export interface PackageVersionGeneratorOptions {
  /**
   * Path to the package.json file, relative to the workspace root.
   */
  readonly path: string;
  readonly skipFormat?: boolean;
  /**
   * New version to set in the package.json, either as a specific semantic version or a release type.
   * The release type can be one of 'major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'.
   * If a release type is specified, the version will be bumped in accordance with the specified type.
   */
  readonly vers: string;
}
