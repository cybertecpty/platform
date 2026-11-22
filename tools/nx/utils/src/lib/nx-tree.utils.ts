import { escapeRegExp } from '@cybertecpty/utils';
import type { Tree } from '@nx/devkit';
import { joinPathFragments } from '@nx/devkit';

/**
 * Recursively lists every file under `dir`, workspace-relative, regardless of
 * `.gitignore` status. Deliberately not `@nx/devkit`'s `visitNotIgnoredFiles`,
 * which skips gitignored paths entirely — callers that need to walk gitignored
 * build output (e.g. `dist/`) would otherwise silently visit zero files.
 */
export function listFilesRecursively(tree: Tree, dir: string): string[] {
  return tree.children(dir).flatMap(child => {
    const childPath = joinPathFragments(dir, child);

    return tree.isFile(childPath) ? [childPath] : listFilesRecursively(tree, childPath);
  });
}

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:'"`])\/\/.*$/gm;
const MODULE_SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/**
 * Lists the packages the `.ts` files under `dir` import, in the order they are first seen, with
 * each package named once: `@angular/common/http` is `@angular/common`, and `lodash-es/map` is
 * `lodash-es`. Relative and absolute paths are not packages and are left out, and a Node built-in
 * is returned as written (`node:fs`). It reads `import ... from`, a bare `import`, a dynamic
 * `import()` and `export ... from`.
 *
 * Comments are removed first, so an import named only in a comment does not count. An import
 * written inside a string still does. `ignoredFiles` is matched against each file's
 * workspace-relative path to skip it, such as the specs of a library.
 */
export function listImportedPackages(tree: Tree, dir: string, ignoredFiles?: RegExp): string[] {
  const names = new Set<string>();

  for (const file of listFilesRecursively(tree, dir)) {
    if (!file.endsWith('.ts') || ignoredFiles?.test(file)) {
      continue;
    }

    const source = (tree.read(file, 'utf-8') ?? '')
      .replace(BLOCK_COMMENT, '')
      .replace(LINE_COMMENT, '$1');

    for (const [, specifier] of source.matchAll(MODULE_SPECIFIER)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
        names.add(toPackageName(specifier));
      }
    }
  }

  return [...names];
}

/**
 * Points the re-exports of one module in a barrel file at another: `export * from './lib/a'` and
 * `export { x } from './lib/a'` become `./lib/b` for `from: './lib/a'`, `to: './lib/b'`. `from` and
 * `to` are module specifiers as the barrel writes them, and either quote style matches. Other
 * exports, and an `import` of the same specifier, are left alone. A no-op when the barrel does not
 * exist or has no such re-export.
 */
export function replaceBarrelExport(
  tree: Tree,
  barrelPath: string,
  from: string,
  to: string
): void {
  const barrel = tree.read(barrelPath, 'utf-8');

  if (barrel === null) {
    return;
  }

  const reExport = new RegExp(
    String.raw`(\bexport\s[^;'"]*?\bfrom\s*)(['"])${escapeRegExp(from)}\2`,
    'g'
  );

  tree.write(
    barrelPath,
    barrel.replace(
      reExport,
      (_match, prefix: string, quote: string) => `${prefix}${quote}${to}${quote}`
    )
  );
}

/** `@scope/name/deep/path` is `@scope/name`, and `name/deep/path` is `name`. */
function toPackageName(specifier: string): string {
  const [first = '', second] = specifier.split('/');

  return first.startsWith('@') && second ? `${first}/${second}` : first;
}
