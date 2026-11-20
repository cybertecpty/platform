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
