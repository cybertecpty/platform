import { Tree, joinPathFragments } from '@nx/devkit';

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
