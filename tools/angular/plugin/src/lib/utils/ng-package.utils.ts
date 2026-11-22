import { listFilesRecursively, readWorkspacePackageJson } from '@cybertecpty/nx-utils';
import { joinPathFragments, readJson, writeJson, type Tree } from '@nx/devkit';
import type { PackageJson } from 'type-fest';

const ANGULAR_SCOPE = '@angular/';
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*['"](@angular\/[^'"/]+)(?:\/[^'"]*)?['"]/g;
const NON_PUBLISHED_FILE = /\.(spec|test-d)\.ts$|(^|\/)test-setup\.ts$/;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:'"`])\/\/.*$/gm;
const EXACT_VERSION = /^[~^]?(\d+)\.\d+\.\d+/;

/**
 * Sets the `@angular/*` peer dependencies in a buildable or publishable library's `package.json`
 * to the Angular packages its source imports, which is what `@nx/dependency-checks` expects.
 *
 * `@nx/angular:library` writes `@angular/common` and `@angular/core` as peers whatever the library
 * contains, so a library without a starter component fails its first `nx lint` on the unused ones,
 * and a routed one on the missing `@angular/router`.
 *
 * A package that stays a peer keeps its range. A new one takes the range the workspace's root
 * `package.json` declares, as a caret on its major version (`~22.0.4` becomes `^22.0.0`), the style
 * Nx writes for the peers it adds. Peers outside `@angular/` are left alone, and so is a package
 * whose range can't be found. Spec and test setup files are skipped: they are not published.
 * Imports are read from the source text with comments removed, so an import written inside a string
 * is still counted. A no-op when the library has no `package.json`. `root` is the library's project
 * root.
 */
export function replaceAngularPeerDependencies(tree: Tree, root: string): void {
  const packageJsonPath = joinPathFragments(root, 'package.json');

  if (!tree.exists(packageJsonPath)) {
    return;
  }

  const packageJson = readJson<PackageJson>(tree, packageJsonPath);
  const peers = packageJson.peerDependencies ?? {};
  const { dependencies = {}, devDependencies = {} } = readWorkspacePackageJson(tree) ?? {};
  const imported = listImportedAngularPackages(tree, joinPathFragments(root, 'src'));

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

function listImportedAngularPackages(tree: Tree, sourceRoot: string): string[] {
  const names = new Set<string>();

  for (const file of listFilesRecursively(tree, sourceRoot)) {
    if (!file.endsWith('.ts') || NON_PUBLISHED_FILE.test(file)) {
      continue;
    }

    const source = (tree.read(file, 'utf-8') ?? '')
      .replace(BLOCK_COMMENT, '')
      .replace(LINE_COMMENT, '$1');

    for (const [, name] of source.matchAll(IMPORT_SPECIFIER)) {
      names.add(name);
    }
  }

  return [...names];
}

/** `~22.0.4` and `22.0.4` become `^22.0.0`; a range that is not a plain version is kept as is. */
function toPeerRange(range: string): string {
  const major = EXACT_VERSION.exec(range)?.[1];

  return major ? `^${major}.0.0` : range;
}
