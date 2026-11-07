import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { addProjectConfiguration, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { configureVitestProject, withoutUpstreamVitestSideEffects } from './nx-vitest.utils';

const ROOT = 'libs/billing/models';
const ESLINT_CONFIG = `const vitestSpecFiles = [
  'apps/cybertec-io/**/*.{spec,test}.ts',
  'tools/git/utils/**/*.{spec,test}.ts'
];
`;

describe('configureVitestProject', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'billing-models', { root: ROOT, projectType: 'library' });
    tree.write('eslint.config.mjs', ESLINT_CONFIG);
  });

  it('writes a `vitest.config.mts` extending the base config with only name and environment', () => {
    configureVitestProject(tree, 'billing-models', 'jsdom');

    const config = tree.read(`${ROOT}/vitest.config.mts`, 'utf-8') ?? '';

    expect(config).toContain("from '../../../vitest.base.mts'");
    expect(config).toContain('createBaseVitestConfig(import.meta.dirname)');
    expect(config).toContain("name: 'billing-models'");
    expect(config).toContain("environment: 'jsdom'");
    expect(config).not.toContain('coverage');
  });

  it('replaces the config the upstream generator wrote', () => {
    tree.write(`${ROOT}/vitest.config.mts`, 'export default {};');

    configureVitestProject(tree, 'billing-models', 'node');

    expect(tree.read(`${ROOT}/vitest.config.mts`, 'utf-8')).toContain('createBaseVitestConfig');
  });

  it('deletes any Jest config', () => {
    tree.write(`${ROOT}/jest.config.cts`, 'module.exports = {};');
    tree.write(`${ROOT}/jest.config.ts`, 'export default {};');

    configureVitestProject(tree, 'billing-models', 'node');

    expect(tree.exists(`${ROOT}/jest.config.cts`)).toBe(false);
    expect(tree.exists(`${ROOT}/jest.config.ts`)).toBe(false);
  });

  it('points `tsconfig.spec.json` at Vitest', () => {
    writeJson(tree, `${ROOT}/tsconfig.spec.json`, {
      extends: './tsconfig.json',
      compilerOptions: { outDir: '../../../dist/out-tsc', types: ['jest', 'node'] },
      include: ['jest.config.ts', 'src/**/*.spec.ts']
    });

    configureVitestProject(tree, 'billing-models', 'node');

    expect(readJson(tree, `${ROOT}/tsconfig.spec.json`)).toEqual({
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: '../../../dist/out-tsc',
        module: 'esnext',
        moduleResolution: 'bundler',
        types: ['vitest/globals', 'node'],
        allowImportingTsExtensions: true,
        noEmit: true
      },
      include: ['vitest.config.mts', 'src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.d.ts']
    });
  });

  it('excludes the Vitest config from `tsconfig.lib.json`', () => {
    writeJson(tree, `${ROOT}/tsconfig.lib.json`, {
      compilerOptions: { types: ['node'] },
      include: ['src/**/*.ts'],
      exclude: ['jest.config.ts', 'src/**/*.spec.ts']
    });

    configureVitestProject(tree, 'billing-models', 'node');

    expect(readJson(tree, `${ROOT}/tsconfig.lib.json`).exclude).toEqual([
      'vitest.config.mts',
      'src/**/*.spec.ts',
      'src/**/*.test.ts'
    ]);
  });

  it('lists the project spec glob in `vitestSpecFiles`, keeping the order of the others', () => {
    configureVitestProject(tree, 'billing-models', 'node');

    expect(tree.read('eslint.config.mjs', 'utf-8')).toContain(
      `  'tools/git/utils/**/*.{spec,test}.ts',\n  '${ROOT}/**/*.{spec,test}.ts'\n];`
    );
  });

  it('warns, and leaves the file alone, when `vitestSpecFiles` is not in the root config', () => {
    const warn = jest.spyOn(devkit.logger, 'warn').mockImplementation(() => undefined);
    tree.write('eslint.config.mjs', 'export default [];\n');

    configureVitestProject(tree, 'billing-models', 'node');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('vitestSpecFiles'));
    expect(tree.read('eslint.config.mjs', 'utf-8')).toBe('export default [];\n');
    warn.mockRestore();
  });

  it('does not list the project spec glob twice', () => {
    configureVitestProject(tree, 'billing-models', 'node');
    configureVitestProject(tree, 'billing-models', 'node');

    const lines = (tree.read('eslint.config.mjs', 'utf-8') ?? '').split(ROOT);

    expect(lines).toHaveLength(2);
  });

  it('ignores the Vitest config in the project `@nx/dependency-checks` rule', () => {
    tree.write(
      `${ROOT}/eslint.config.mjs`,
      `export default [{ rules: { '@nx/dependency-checks': ['error', { ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'] }] } }];`
    );

    configureVitestProject(tree, 'billing-models', 'node');

    expect(tree.read(`${ROOT}/eslint.config.mjs`, 'utf-8')).toContain(
      "'{projectRoot}/vitest.config.{js,cjs,mjs,ts,cts,mts}'"
    );
  });

  it('leaves the files it has no reason to touch alone when they are missing', () => {
    expect(() => configureVitestProject(tree, 'billing-models', 'node')).not.toThrow();
    expect(tree.exists(`${ROOT}/tsconfig.spec.json`)).toBe(false);
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
