import type { Tree } from '@nx/devkit';
import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { normalizeRoutesFile, useRoutesInLazyRegistration } from './ng-routes.utils';

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

describe('useRoutesInLazyRegistration', () => {
  const PARENT = 'apps/shell/src/app/app.routes.ts';
  const IMPORT_PATH = '@cybertecpty/billing-feature';
  const registration = (target: string) =>
    `{ path: 'billing-feature', loadChildren: () => import('${IMPORT_PATH}').then(m => m.${target}) }`;
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      ROUTES,
      "import type { Route } from '@angular/router';\n\nexport const billingFeatureRoutes: Route[] = [];\n"
    );
    tree.write(
      PARENT,
      `export const appRoutes = [\n  ${registration('BillingFeatureModule')}\n];\n`
    );
    updateJson(tree, 'tsconfig.base.json', json => ({
      ...json,
      compilerOptions: {
        ...json.compilerOptions,
        paths: { [IMPORT_PATH]: [`./${ROOT}/src/index.ts`] }
      }
    }));
  });

  it('registers the library by its routes export instead of a module', () => {
    useRoutesInLazyRegistration(tree, ROOT, NAME, PARENT);

    expect(tree.read(PARENT, 'utf-8')).toContain(registration('billingFeatureRoutes'));
    expect(tree.read(PARENT, 'utf-8')).not.toContain('BillingFeatureModule');
  });

  it('reads the routes export from the routes file', () => {
    tree.write(ROUTES, 'export const customRoutes = [];\n');

    useRoutesInLazyRegistration(tree, ROOT, NAME, PARENT);

    expect(tree.read(PARENT, 'utf-8')).toContain(registration('customRoutes'));
  });

  it('leaves the registrations of other libraries alone', () => {
    const other =
      "{ path: 'billing-other', loadChildren: () => import('@cybertecpty/billing-other').then(m => m.BillingOtherModule) }";
    tree.write(
      PARENT,
      `export const appRoutes = [\n  ${other},\n  ${registration('BillingFeatureModule')}\n];\n`
    );

    useRoutesInLazyRegistration(tree, ROOT, NAME, PARENT);

    expect(tree.read(PARENT, 'utf-8')).toContain(other);
  });

  it('leaves a registration that already names the routes export', () => {
    const source = `export const appRoutes = [\n  ${registration('billingFeatureRoutes')}\n];\n`;
    tree.write(PARENT, source);

    useRoutesInLazyRegistration(tree, ROOT, NAME, PARENT);

    expect(tree.read(PARENT, 'utf-8')).toBe(source);
  });

  it('leaves a parent that does not register the library', () => {
    const source = 'export const appRoutes = [];\n';
    tree.write(PARENT, source);

    useRoutesInLazyRegistration(tree, ROOT, NAME, PARENT);

    expect(tree.read(PARENT, 'utf-8')).toBe(source);
  });

  it('does nothing without a routes file', () => {
    tree.delete(ROUTES);
    const before = tree.read(PARENT, 'utf-8');

    useRoutesInLazyRegistration(tree, ROOT, NAME, PARENT);

    expect(tree.read(PARENT, 'utf-8')).toBe(before);
  });

  it('does nothing without a `tsconfig.base.json` path for the library', () => {
    updateJson(tree, 'tsconfig.base.json', json => ({
      ...json,
      compilerOptions: { ...json.compilerOptions, paths: {} }
    }));
    const before = tree.read(PARENT, 'utf-8');

    useRoutesInLazyRegistration(tree, ROOT, NAME, PARENT);

    expect(tree.read(PARENT, 'utf-8')).toBe(before);
  });

  it('does nothing when the parent file does not exist', () => {
    tree.delete(PARENT);

    expect(() => useRoutesInLazyRegistration(tree, ROOT, NAME, PARENT)).not.toThrow();
  });
});
