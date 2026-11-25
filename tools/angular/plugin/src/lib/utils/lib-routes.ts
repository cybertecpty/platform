import { findProjectImportPath, replaceBarrelExport } from '@cybertecpty/nx-utils';
import { joinPathFragments, type Tree } from '@nx/devkit';
import { escapeRegExp } from 'lodash-es';

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
    replaceBarrelExport(
      tree,
      joinPathFragments(root, 'src/index.ts'),
      `./lib/${GENERATED_ROUTES_FILE}`,
      `./lib/${routesFile}`
    );
  }
}

/**
 * Registers a lazy library in its `parent` route file by its routes export, not by a module.
 *
 * `@nx/angular:library` writes `loadChildren: () => import('…').then(m => m.<Name>Module)` for a
 * library that is not standalone, which assumes a module the library may not have. A library
 * generated without one exports only its routes (`src/lib/<name>.routes.ts`), so the registration
 * names that export instead. A no-op when the parent has no registration for the library, or the
 * library has no routes export or no `tsconfig.base.json` path.
 *
 * `root` and `name` are the library's root and project name.
 */
export function useRoutesInLazyRegistration(
  tree: Tree,
  root: string,
  name: string,
  parent: string
): void {
  const routes = tree.read(joinPathFragments(root, 'src/lib', `${name}.routes.ts`), 'utf-8');
  const routesExport = routes?.match(/export const (\w+)/)?.[1];
  const importPath = findProjectImportPath(tree, root);
  const parentSource = tree.read(parent, 'utf-8');

  if (!routesExport || !importPath || !parentSource) {
    return;
  }

  const registration = new RegExp(
    String.raw`(import\('${escapeRegExp(importPath)}'\)\.then\(m => m\.)\w+(\))`
  );

  tree.write(parent, parentSource.replace(registration, `$1${routesExport}$2`));
}
