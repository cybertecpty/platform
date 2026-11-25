import type { Tree } from '@nx/devkit';
import { addProjectConfiguration, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { configureAngularVitestProject } from './vitest-config';

const ROOT = 'libs/billing/ui';
const SPEC_TSCONFIG = {
  extends: './tsconfig.json',
  compilerOptions: {
    outDir: '../../../dist/out-tsc',
    types: ['vitest/globals', 'vitest/importMeta', 'vite/client', 'node', 'vitest']
  },
  include: ['vite.config.mts', 'vitest.config.mts', 'src/**/*.spec.ts'],
  files: ['src/test-setup.ts']
};

describe('vitest-config', () => {
  describe('configureAngularVitestProject', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'billing-ui', { root: ROOT, projectType: 'library' });
      tree.write(`${ROOT}/vite.config.mts`, 'export default {};');
      writeJson(tree, `${ROOT}/tsconfig.spec.json`, SPEC_TSCONFIG);
    });

    it('writes a `vitest.config.mts` extending the base config with the Angular plugin and setup file', () => {
      configureAngularVitestProject(tree, 'billing-ui');

      const config = tree.read(`${ROOT}/vitest.config.mts`, 'utf-8') ?? '';

      expect(config).toContain("from '../../../vitest.base.mts'");
      expect(config).toContain('createBaseVitestConfig(import.meta.dirname)');
      expect(config).toContain("from '@analogjs/vite-plugin-angular'");
      expect(config).toContain('plugins: [angular()]');
      expect(config).toContain("name: 'billing-ui'");
      expect(config).toContain("environment: 'jsdom'");
      expect(config).toContain("setupFiles: ['src/test-setup.ts']");
    });

    it('excludes the setup file from coverage', () => {
      configureAngularVitestProject(tree, 'billing-ui');

      expect(tree.read(`${ROOT}/vitest.config.mts`, 'utf-8')).toContain(
        "coverage: { exclude: ['src/test-setup.ts'] }"
      );
    });

    it('deletes the `vite.config.mts` the upstream generator wrote', () => {
      configureAngularVitestProject(tree, 'billing-ui');

      expect(tree.exists(`${ROOT}/vite.config.mts`)).toBe(false);
    });

    it('allows `.mts` imports in `tsconfig.spec.json`, drops `vite/client`, and keeps the rest of it', () => {
      configureAngularVitestProject(tree, 'billing-ui');

      expect(readJson(tree, `${ROOT}/tsconfig.spec.json`)).toEqual({
        ...SPEC_TSCONFIG,
        compilerOptions: {
          ...SPEC_TSCONFIG.compilerOptions,
          allowImportingTsExtensions: true,
          types: ['vitest/globals', 'vitest/importMeta', 'node', 'vitest']
        }
      });
    });

    it('does not set `noEmit`, which stops Analog from compiling components', () => {
      configureAngularVitestProject(tree, 'billing-ui');

      expect(readJson(tree, `${ROOT}/tsconfig.spec.json`).compilerOptions).not.toHaveProperty(
        'noEmit'
      );
    });

    it('copes with a `tsconfig.spec.json` that lists no `types`', () => {
      writeJson(tree, `${ROOT}/tsconfig.spec.json`, { extends: './tsconfig.json', include: [] });

      configureAngularVitestProject(tree, 'billing-ui');

      expect(readJson(tree, `${ROOT}/tsconfig.spec.json`).compilerOptions).toEqual({
        allowImportingTsExtensions: true
      });
    });

    it('adds `vitest.config.mts` to the ignored files of the `@nx/dependency-checks` rule', () => {
      tree.write(
        `${ROOT}/eslint.config.mjs`,
        "export default [{ rules: { '@nx/dependency-checks': ['error', { ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'] }] } }];\n"
      );

      configureAngularVitestProject(tree, 'billing-ui');

      expect(tree.read(`${ROOT}/eslint.config.mjs`, 'utf-8')).toContain(
        "'{projectRoot}/vitest.config.{js,cjs,mjs,ts,cts,mts}'"
      );
    });

    it('leaves an `eslint.config.mjs` without the `@nx/dependency-checks` rule alone', () => {
      const eslintConfig = 'export default [];\n';
      tree.write(`${ROOT}/eslint.config.mjs`, eslintConfig);

      configureAngularVitestProject(tree, 'billing-ui');

      expect(tree.read(`${ROOT}/eslint.config.mjs`, 'utf-8')).toBe(eslintConfig);
    });

    it('leaves `tsconfig.lib.json` alone', () => {
      const libTsConfig = { extends: './tsconfig.json', exclude: ['src/test-setup.ts'] };
      writeJson(tree, `${ROOT}/tsconfig.lib.json`, libTsConfig);

      configureAngularVitestProject(tree, 'billing-ui');

      expect(readJson(tree, `${ROOT}/tsconfig.lib.json`)).toEqual(libTsConfig);
    });
  });
});
