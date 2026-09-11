import { formatFiles, readJson, Tree, writeJson } from '@nx/devkit';
import { inc, RELEASE_TYPES, valid } from 'semver';
import { PackageJson } from 'type-fest';
import { isReleaseType } from '../../utils/release-versions.utils';
import { PackageVersionGeneratorOptions } from './schema';

export async function packageVersionGenerator(
  tree: Tree,
  rawOptions: PackageVersionGeneratorOptions
) {
  const { path, skipFormat, vers } = rawOptions;

  if (!tree.exists(path)) {
    throw new Error(`Package.json not found at path: ${path}`);
  }

  const packageJson = readJson<PackageJson>(tree, path);

  const explicitVersion = valid(vers);
  let newVersion: string;

  if (explicitVersion) {
    // An explicit semantic version was provided; use its normalized form.
    newVersion = explicitVersion;
  } else if (isReleaseType(vers)) {
    // Otherwise bump the current version in accordance with the release type.
    const currentVersion = valid(packageJson.version);

    if (!currentVersion) {
      throw new Error(`Invalid version in package.json: ${packageJson.version}`);
    }

    newVersion = inc(currentVersion, vers) as string;
  } else {
    throw new Error(
      `Invalid version specifier: ${vers}. ` +
        `Expected a semantic version or one of: ${RELEASE_TYPES.join(', ')}.`
    );
  }

  // Assigning in place keeps the version field in its original position.
  packageJson.version = newVersion;

  writeJson(tree, path, packageJson);

  if (!skipFormat) {
    await formatFiles(tree);
  }
}

export default packageVersionGenerator;
