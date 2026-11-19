import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { normalizeRoutesFile } from './ng-routes.utils';

const ROOT = 'libs/billing/feature';
const NAME = 'billing-feature';
const GENERATED = `${ROOT}/src/lib/lib.routes.ts`;
const ROUTES = `${ROOT}/src/lib/${NAME}.routes.ts`;
const BARREL = `${ROOT}/src/index.ts`;
const GENERATED_SOURCE =
  "import { Route } from '@angular/router';\n\nexport const billingFeatureRoutes: Route[] = [];\n";

describe('normalizeRoutesFile', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(GENERATED, GENERATED_SOURCE);
    tree.write(BARREL, "export * from './lib/lib.routes';\n");
  });

  it('renames the generated routes file after the library', () => {
    normalizeRoutesFile(tree, ROOT, NAME);

    expect(tree.exists(ROUTES)).toBe(true);
    expect(tree.exists(GENERATED)).toBe(false);
  });

  it('points the barrel export at the new name', () => {
    normalizeRoutesFile(tree, ROOT, NAME);

    expect(tree.read(BARREL, 'utf-8')).toBe("export * from './lib/billing-feature.routes';\n");
  });

  it('keeps the other exports of the barrel', () => {
    tree.write(
      BARREL,
      "export * from './lib/billing-feature.module';\nexport * from './lib/lib.routes';\n"
    );

    normalizeRoutesFile(tree, ROOT, NAME);

    expect(tree.read(BARREL, 'utf-8')).toBe(
      "export * from './lib/billing-feature.module';\nexport * from './lib/billing-feature.routes';\n"
    );
  });

  it('turns the `Route` import into a type import', () => {
    normalizeRoutesFile(tree, ROOT, NAME);

    expect(tree.read(ROUTES, 'utf-8')).toBe(
      "import type { Route } from '@angular/router';\n\nexport const billingFeatureRoutes: Route[] = [];\n"
    );
  });

  it('keeps the rest of the routes file', () => {
    tree.write(
      GENERATED,
      "import { Route } from '@angular/router';\nimport { Other } from './other';\n\nexport const routes: Route[] = [];\n"
    );

    normalizeRoutesFile(tree, ROOT, NAME);

    expect(tree.read(ROUTES, 'utf-8')).toContain("import { Other } from './other';");
  });

  it('keeps a type import the routes file already has', () => {
    const source =
      "import type { Route } from '@angular/router';\n\nexport const routes: Route[] = [];\n";
    tree.write(GENERATED, source);

    normalizeRoutesFile(tree, ROOT, NAME);

    expect(tree.read(ROUTES, 'utf-8')).toBe(source);
  });

  it('works without a barrel', () => {
    tree.delete(BARREL);

    expect(() => normalizeRoutesFile(tree, ROOT, NAME)).not.toThrow();
    expect(tree.exists(ROUTES)).toBe(true);
  });

  it('leaves a barrel that does not export the generated file alone', () => {
    tree.write(BARREL, "export * from './lib/something';\n");

    normalizeRoutesFile(tree, ROOT, NAME);

    expect(tree.read(BARREL, 'utf-8')).toBe("export * from './lib/something';\n");
  });

  it('keeps the generated name for a library named `lib`', () => {
    normalizeRoutesFile(tree, ROOT, 'lib');

    expect(tree.exists(GENERATED)).toBe(true);
    expect(tree.read(BARREL, 'utf-8')).toBe("export * from './lib/lib.routes';\n");
  });

  it('does nothing for a library without a routes file', () => {
    tree.delete(GENERATED);

    expect(() => normalizeRoutesFile(tree, ROOT, NAME)).not.toThrow();
    expect(tree.exists(ROUTES)).toBe(false);
  });
});
