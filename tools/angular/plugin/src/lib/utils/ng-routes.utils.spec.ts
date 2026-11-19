import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { useTypeImportInRoutes } from './ng-routes.utils';

const ROOT = 'libs/billing/feature';
const ROUTES = `${ROOT}/src/lib/lib.routes.ts`;

describe('useTypeImportInRoutes', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('turns the `Route` import of the generated routes file into a type import', () => {
    tree.write(
      ROUTES,
      "import { Route } from '@angular/router';\n\nexport const billingFeatureRoutes: Route[] = [];\n"
    );

    useTypeImportInRoutes(tree, ROOT);

    expect(tree.read(ROUTES, 'utf-8')).toBe(
      "import type { Route } from '@angular/router';\n\nexport const billingFeatureRoutes: Route[] = [];\n"
    );
  });

  it('leaves the rest of the file alone', () => {
    tree.write(
      ROUTES,
      "import { Route } from '@angular/router';\nimport { Other } from './other';\n\nexport const routes: Route[] = [];\n"
    );

    useTypeImportInRoutes(tree, ROOT);

    expect(tree.read(ROUTES, 'utf-8')).toContain("import { Other } from './other';");
  });

  it('keeps a routes file that already has a type import', () => {
    const source =
      "import type { Route } from '@angular/router';\n\nexport const routes: Route[] = [];\n";
    tree.write(ROUTES, source);

    useTypeImportInRoutes(tree, ROOT);

    expect(tree.read(ROUTES, 'utf-8')).toBe(source);
  });

  it('does nothing for a library without a routes file', () => {
    expect(() => useTypeImportInRoutes(tree, ROOT)).not.toThrow();
    expect(tree.exists(ROUTES)).toBe(false);
  });
});
