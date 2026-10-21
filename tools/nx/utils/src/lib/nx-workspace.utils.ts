import type { Tree } from '@nx/devkit';
import { readJson } from '@nx/devkit';
import type { PackageJson } from 'type-fest';

/**
 * Returns the npm scope of the workspace derived from the root `package.json` name,
 * including the leading `@` (e.g. `'@cybertecpty'` for `@cybertecpty/workspace`).
 *
 * Throws when the root `package.json` is missing or invalid, or its `name` is not scoped.
 */
export function getWorkspaceScope(tree: Tree): string {
  const packageJson = readWorkspacePackageJson(tree);
  const { name } = packageJson ?? {};
  const parts = name?.split('/');

  if (!name || !parts || parts.length < 2) {
    throw new Error(
      `Unable to determine workspace npm scope: root package.json is missing or its "name" is not scoped (expected "@scope/name")`
    );
  }

  return parts[0];
}

/**
 * Reads the `package.json` at the workspace root and returns its contents as a `PackageJson`
 * object, or `null` when the workspace has none.
 *
 * @throws when the file exists but is not valid JSON.
 */
export function readWorkspacePackageJson(tree: Tree): PackageJson | null {
  return tree.exists('package.json') ? readJson<PackageJson>(tree, 'package.json') : null;
}
