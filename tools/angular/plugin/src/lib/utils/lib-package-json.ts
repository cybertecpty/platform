import {
  listImportedPackages,
  projectBarrelPath,
  readWorkspacePackageJson
} from '@cybertecpty/nx-utils';
import { joinPathFragments, readJson, writeJson, type Tree } from '@nx/devkit';
import { minVersion, validRange } from 'semver';
import type { PackageJson } from 'type-fest';

const ANGULAR_SCOPE = '@angular/';
const NON_PUBLISHED_FILE = /\.(spec|test-d)\.ts$|(^|\/)test-setup\.ts$/;

/**
 * Gives a buildable or publishable library whose `src/index.ts` is empty a bare `export {};`.
 * ng-packagr fails an entrypoint that exports nothing with "failed to get symbol for entrypoint",
 * and the types that generate no starter component (`core`, `data-access`, `ui`) leave that file
 * empty. A no-op when the library has no `package.json` (it has no `build` target), or when
 * `src/index.ts` has content. `root` is the library's project root.
 */
export function ensureEntrypointExports(tree: Tree, root: string): void {
  const indexPath = projectBarrelPath({ root });

  if (
    tree.exists(joinPathFragments(root, 'package.json')) &&
    !tree.read(indexPath, 'utf-8')?.trim()
  ) {
    tree.write(indexPath, 'export {};\n');
  }
}

/**
 * Sets the `@angular/*` peer dependencies in a buildable or publishable library's `package.json`
 * to the Angular packages its source imports, which is what `@nx/dependency-checks` expects.
 *
 * `@nx/angular:library` writes `@angular/common` and `@angular/core` as peers whatever the library
 * contains, so a library without a starter component fails its first `nx lint` on the unused ones,
 * and a routed one on the missing `@angular/router`.
 *
 * A package that stays a peer keeps its range. A new one takes the range the workspace's root
 * `package.json` declares, as a caret on its lowest major version (`~22.0.4` becomes `^22.0.0`),
 * the style Nx writes for the peers it adds. A root range that is not valid semver, or that starts
 * below major 1, is kept as written. Peers outside `@angular/` are left alone, and so is a package
 * whose range can't be found. Spec and test setup files are skipped: they are not published.
 * Imports are read as `listImportedPackages` reads them. A no-op when the library has no
 * `package.json`. `root` is the library's project root.
 */
export function replaceAngularPeerDependencies(tree: Tree, root: string): void {
  const packageJsonPath = joinPathFragments(root, 'package.json');

  if (!tree.exists(packageJsonPath)) {
    return;
  }

  const packageJson = readJson<PackageJson>(tree, packageJsonPath);
  const peers = packageJson.peerDependencies ?? {};
  const { dependencies = {}, devDependencies = {} } = readWorkspacePackageJson(tree) ?? {};
  const imported = listImportedPackages(
    tree,
    joinPathFragments(root, 'src'),
    NON_PUBLISHED_FILE
  ).filter(name => name.startsWith(ANGULAR_SCOPE));

  const angularPeers = imported.flatMap((name): [string, string][] => {
    const workspaceRange = dependencies[name] ?? devDependencies[name];
    const range = peers[name] ?? (workspaceRange && toPeerRange(workspaceRange));

    return range ? [[name, range]] : [];
  });
  const otherPeers = Object.entries(peers).flatMap(([name, range]): [string, string][] =>
    range && !name.startsWith(ANGULAR_SCOPE) ? [[name, range]] : []
  );

  writeJson(tree, packageJsonPath, {
    ...packageJson,
    peerDependencies: Object.fromEntries(
      [...otherPeers, ...angularPeers].sort(([a], [b]) => a.localeCompare(b))
    )
  });
}

/** `~22.0.4` and `22.0.4` become `^22.0.0`; a range that is not valid semver is kept as is. */
function toPeerRange(range: string): string {
  const major = validRange(range) ? minVersion(range)?.major : undefined;

  return major ? `^${major}.0.0` : range;
}
