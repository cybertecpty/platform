import { joinPathFragments, type Tree } from '@nx/devkit';

const GENERATED_ROUTES_FILE = 'lib.routes';
const ROUTE_VALUE_IMPORT = "import { Route } from '@angular/router';";
const ROUTE_TYPE_IMPORT = "import type { Route } from '@angular/router';";

/**
 * Tidies the `src/lib/lib.routes.ts` that `@nx/angular:library` writes for a routed library:
 *
 * - It renames the file after the library, so `billing-feature` gets `billing-feature.routes.ts`,
 *   and points the `src/index.ts` export at the new name.
 * - It makes the `Route` import a type import. `Route` is only a type, and the workspace's
 *   `consistent-type-imports` rule fails the library's lint on the value import.
 *
 * A no-op when the library has no routes file. `name` is the library's project name.
 */
export function normalizeRoutesFile(tree: Tree, root: string, name: string): void {
  const generatedPath = joinPathFragments(root, 'src/lib', `${GENERATED_ROUTES_FILE}.ts`);
  const source = tree.read(generatedPath, 'utf-8');

  if (source === null) {
    return;
  }

  const routesFile = `${name}.routes`;
  const path = joinPathFragments(root, 'src/lib', `${routesFile}.ts`);

  tree.write(path, source.replace(ROUTE_VALUE_IMPORT, ROUTE_TYPE_IMPORT));

  if (path !== generatedPath) {
    tree.delete(generatedPath);
    renameRoutesExport(tree, root, routesFile);
  }
}

/** Points the `src/index.ts` export of the generated routes file at `routesFile`. */
function renameRoutesExport(tree: Tree, root: string, routesFile: string): void {
  const barrelPath = joinPathFragments(root, 'src/index.ts');
  const barrel = tree.read(barrelPath, 'utf-8');
  const generatedExport = `'./lib/${GENERATED_ROUTES_FILE}'`;

  if (barrel?.includes(generatedExport)) {
    tree.write(barrelPath, barrel.replace(generatedExport, `'./lib/${routesFile}'`));
  }
}
