import { joinPathFragments, type Tree } from '@nx/devkit';

const ROUTE_VALUE_IMPORT = "import { Route } from '@angular/router';";
const ROUTE_TYPE_IMPORT = "import type { Route } from '@angular/router';";

/**
 * Makes the `Route` import of the `src/lib/lib.routes.ts` that `@nx/angular:library` writes for a
 * routed library a type import. `Route` is only a type, and the workspace's
 * `consistent-type-imports` rule fails the library's lint on the value import. A no-op when the
 * library has no routes file, or its import is not the generated one.
 */
export function useTypeImportInRoutes(tree: Tree, root: string): void {
  const path = joinPathFragments(root, 'src/lib/lib.routes.ts');
  const source = tree.read(path, 'utf-8');

  if (source?.includes(ROUTE_VALUE_IMPORT)) {
    tree.write(path, source.replace(ROUTE_VALUE_IMPORT, ROUTE_TYPE_IMPORT));
  }
}
