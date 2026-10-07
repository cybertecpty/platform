import { getWorkspaceScope, readRootPackageJson } from '@cybertecpty/nx-utils';
import { formatFiles, joinPathFragments, logger, writeJson, type Tree } from '@nx/devkit';
import { valid } from 'semver';
import type { PackageJson } from 'type-fest';
import type { PackageJsonGeneratorOptions } from './schema';

/**
 * Creates a minimal `package.json` in `dir`, prefixing `name` with the workspace's
 * npm scope (via `getWorkspaceScope`).
 *
 * Writes `version` directly rather than delegating to a version-bumping generator —
 * a freshly created file has no prior version to bump, so that semantic doesn't
 * apply here.
 *
 * Warns and no-ops, rather than throwing, when the target file already exists and
 * `--overwrite` was not passed — the same guard style as this project's
 * `file-archive` generator. Any other error (an invalid version, an unresolvable
 * workspace scope, a requested dependency not found in the root package.json) is
 * raised before anything is written.
 *
 * Returns the workspace-relative `package.json` path, whether or not it was written
 * this run.
 */
export async function packageJsonGenerator(
  tree: Tree,
  options: PackageJsonGeneratorOptions
): Promise<string> {
  const {
    dependencies,
    dir,
    main,
    name,
    nodeEngine,
    overwrite = false,
    private: isPrivate = true,
    skipFormat = false,
    startScript,
    vers = '0.0.1'
  } = options;

  const packageJsonPath = joinPathFragments(dir, 'package.json');

  if (tree.exists(packageJsonPath) && !overwrite) {
    logger.warn(
      `"${packageJsonPath}" already exists; pass --overwrite to replace it. Skipping package.json creation.`
    );
    return packageJsonPath;
  }

  const version = valid(vers);

  if (!version) {
    throw new Error(`Invalid version: ${vers}. Expected a semantic version (e.g. "1.2.3").`);
  }

  const scope = getWorkspaceScope(tree);

  const packageJson: PackageJson = {
    name: `${scope}/${name}`,
    version
  };

  if (isPrivate) {
    packageJson.private = true;
  }

  if (main) {
    packageJson.main = main;
  }

  if (nodeEngine) {
    packageJson.engines = { node: nodeEngine };
  }

  if (startScript) {
    packageJson.scripts = { start: startScript };
  }

  if (dependencies?.length) {
    packageJson.dependencies = resolveDependencyVersions(tree, dependencies);
  }

  writeJson(tree, packageJsonPath, packageJson);

  logger.info(`Created ${packageJsonPath}`);

  if (!skipFormat) {
    await formatFiles(tree);
  }

  return packageJsonPath;
}

/**
 * Looks up each requested dependency name in the root package.json's `dependencies`
 * and `devDependencies` maps. Throws a single error listing every name found in
 * neither, rather than copying a partial set silently.
 */
function resolveDependencyVersions(tree: Tree, names: string[]): Record<string, string> {
  const rootPackageJson = readRootPackageJson(tree);
  const resolved: Record<string, string> = {};
  const missing: string[] = [];

  for (const name of names) {
    const dependencyVersion =
      rootPackageJson?.dependencies?.[name] ?? rootPackageJson?.devDependencies?.[name];

    if (dependencyVersion) {
      resolved[name] = dependencyVersion;
    } else {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Dependencies not found in root package.json: ${missing.join(', ')}`);
  }

  return resolved;
}

export default packageJsonGenerator;
