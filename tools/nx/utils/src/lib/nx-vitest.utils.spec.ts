import type { Tree } from '@nx/devkit';
import { addProjectConfiguration, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { configureVitestProject, withoutUpstreamVitestSideEffects } from './nx-vitest.utils';

const ROOT = 'libs/billing/types';

describe('configureVitestProject', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'billing-types', { root: ROOT, projectType: 'library' });
  });

  it('deletes any Jest config', () => {
    tree.write(`${ROOT}/jest.config.cts`, 'module.exports = {};');
    tree.write(`${ROOT}/jest.config.ts`, 'export default {};');

    configureVitestProject(tree, 'billing-types');

    expect(tree.exists(`${ROOT}/jest.config.cts`)).toBe(false);
    expect(tree.exists(`${ROOT}/jest.config.ts`)).toBe(false);
  });

  it('excludes the Vitest config from `tsconfig.lib.json`', () => {
    writeJson(tree, `${ROOT}/tsconfig.lib.json`, {
      compilerOptions: { types: ['node'] },
      include: ['src/**/*.ts'],
      exclude: ['jest.config.ts', 'src/**/*.spec.ts']
    });

    configureVitestProject(tree, 'billing-types');

    expect(readJson(tree, `${ROOT}/tsconfig.lib.json`).exclude).toEqual([
      'vitest.config.mts',
      'src/**/*.spec.ts',
      'src/**/*.test.ts'
    ]);
  });

  it('ignores the Vitest config in the project `@nx/dependency-checks` rule', () => {
    tree.write(
      `${ROOT}/eslint.config.mjs`,
      `export default [{ rules: { '@nx/dependency-checks': ['error', { ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'] }] } }];`
    );

    configureVitestProject(tree, 'billing-types');

    expect(tree.read(`${ROOT}/eslint.config.mjs`, 'utf-8')).toContain(
      "'{projectRoot}/vitest.config.{js,cjs,mjs,ts,cts,mts}'"
    );
  });

  it('leaves a missing `tsconfig.lib.json` missing', () => {
    configureVitestProject(tree, 'billing-types');

    expect(tree.exists(`${ROOT}/tsconfig.lib.json`)).toBe(false);
  });
});

describe('withoutUpstreamVitestSideEffects', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('eslint.config.mjs', '// keep me\nexport default [];\n');
    writeJson(tree, 'package.json', { devDependencies: { vitest: '^5.0.1' } });
  });

  it('removes a root `vitest.config.ts` the upstream generator created', async () => {
    await withoutUpstreamVitestSideEffects(tree, () => {
      tree.write('vitest.config.ts', 'export default {};');
    });

    expect(tree.exists('vitest.config.ts')).toBe(false);
  });

  it('keeps a root `vitest.config.ts` the workspace already had', async () => {
    tree.write('vitest.config.ts', 'export default {};');

    await withoutUpstreamVitestSideEffects(tree, () => undefined);

    expect(tree.exists('vitest.config.ts')).toBe(true);
  });

  it('removes `@nx/vite` and `vite` the upstream generator added', async () => {
    await withoutUpstreamVitestSideEffects(tree, () => {
      writeJson(tree, 'package.json', {
        devDependencies: { vitest: '^5.0.1', '@nx/vite': '23.1.1', vite: '^8.0.0' }
      });
    });

    expect(readJson(tree, 'package.json').devDependencies).toEqual({ vitest: '^5.0.1' });
  });

  it('removes the `extraPackages` the upstream generator added', async () => {
    await withoutUpstreamVitestSideEffects(tree, () => {
      writeJson(tree, 'package.json', { devDependencies: { vitest: '^5.0.1', jsdom: '^27.1.0' } });
    }, ['jsdom']);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({ vitest: '^5.0.1' });
  });

  it('keeps `vite` when the workspace already depended on it', async () => {
    writeJson(tree, 'package.json', { devDependencies: { vite: '^8.0.0' } });

    await withoutUpstreamVitestSideEffects(tree, () => undefined);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({ vite: '^8.0.0' });
  });

  it('leaves a workspace without a root `package.json` without one', async () => {
    tree.delete('package.json');

    await withoutUpstreamVitestSideEffects(tree, () => undefined);

    expect(tree.exists('package.json')).toBe(false);
  });

  it('restores the root `eslint.config.mjs` the upstream generator rewrote', async () => {
    await withoutUpstreamVitestSideEffects(tree, () => {
      tree.write('eslint.config.mjs', 'export default [];\n');
    });

    expect(tree.read('eslint.config.mjs', 'utf-8')).toBe('// keep me\nexport default [];\n');
  });

  it("returns the upstream generator's result", async () => {
    await expect(withoutUpstreamVitestSideEffects(tree, () => 42)).resolves.toBe(42);
  });
});
