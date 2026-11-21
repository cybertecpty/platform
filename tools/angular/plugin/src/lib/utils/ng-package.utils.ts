import { listFilesRecursively } from '@cybertecpty/nx-utils';
import { joinPathFragments, readJson, writeJson, type Tree } from '@nx/devkit';
import type { PackageJson } from 'type-fest';

const ANGULAR_SCOPE = '@angular/';
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*['"](@angular\/[^'"/]+)(?:\/[^'"]*)?['"]/g;
const NON_PUBLISHED_FILE = /\.(spec|test-d)\.ts$|(^|\/)test-setup\.ts$/;

/**
 * Sets the `@angular/*` peer dependencies in a buildable or publishable library's `package.json`
 * to the Angular packages its source imports, which is what `@nx/dependency-checks` expects.
 *
 * `@nx/angular:library` writes `@angular/common` and `@angular/core` as peers whatever the library
 * contains, so a library without a starter component fails its first `nx lint` on the unused ones,
 * and a routed one on the missing `@angular/router`.
 *
 * A package that stays a peer keeps its range, and a new one takes the range the workspace's root
 * `package.json` declares. Peers outside `@angular/` are left alone, and so is a package whose range
 * can't be found. Spec and test setup files are skipped: they are not published. A no-op when the
 * library has no `package.json`. `root` is the library's project root.
 */
export function replaceAngularPeerDependencies(tree: Tree, root: string): void {
  const packageJsonPath = joinPathFragments(root, 'package.json');

  if (!tree.exists(packageJsonPath)) {
    return;
  }

  const packageJson = readJson<PackageJson>(tree, packageJsonPath);
  const peers = packageJson.peerDependencies ?? {};
  const workspace = readJson<PackageJson>(tree, 'package.json');
  const imported = listImportedAngularPackages(tree, joinPathFragments(root, 'src'));

  const angularPeers = Object.fromEntries(
    imported.flatMap(name => {
      const range =
        peers[name] ?? workspace.dependencies?.[name] ?? workspace.devDependencies?.[name];

      return range ? [[name, range]] : [];
    })
  );
  const otherPeers = Object.entries(peers).filter(([name]) => !name.startsWith(ANGULAR_SCOPE));

  writeJson(tree, packageJsonPath, {
    ...packageJson,
    peerDependencies: Object.fromEntries(
      [...otherPeers, ...Object.entries(angularPeers)].sort(([a], [b]) => a.localeCompare(b))
    )
  });
}

function listImportedAngularPackages(tree: Tree, sourceRoot: string): string[] {
  const names = new Set<string>();

  for (const file of listFilesRecursively(tree, sourceRoot)) {
    if (!file.endsWith('.ts') || NON_PUBLISHED_FILE.test(file)) {
      continue;
    }

    for (const [, name] of (tree.read(file, 'utf-8') ?? '').matchAll(IMPORT_SPECIFIER)) {
      names.add(name);
    }
  }

  return [...names];
}
