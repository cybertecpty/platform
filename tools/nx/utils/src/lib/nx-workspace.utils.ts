import { readJson, Tree } from '@nx/devkit';
import { PackageJson } from 'type-fest';

/**
 * Reads the root `package.json` file of the workspace and returns its contents as a `PackageJson` object.
 * Returns `null` if the root `package.json` file does not exist or cannot be read.
 */
export function readRootPackageJson(tree: Tree): PackageJson | null {
  try {
    return readJson<PackageJson>(tree, 'package.json');
  } catch {
    return null;
  }
}

/**
 * Returns the npm scope of the workspace derived from the root `package.json` name,
 * including the leading `@` (e.g. `'@cybertecpty'` for `@cybertecpty/workspace`).
 *
 * Throws when the root `package.json` is missing, unreadable, or its `name` is not scoped.
 */
export function getWorkspaceScope(tree: Tree): string {
  const packageJson = readRootPackageJson(tree);
  const { name } = packageJson ?? {};
  const parts = name?.split('/');

  if (!name || !parts || parts.length < 2) {
    throw new Error(
      `Unable to determine workspace npm scope: root package.json is missing or its "name" is not scoped (expected "@scope/name")`
    );
  }

  return parts[0];
}
