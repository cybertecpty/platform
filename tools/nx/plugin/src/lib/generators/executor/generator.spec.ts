import { lastCallArg } from '@cybertecpty/jest-testing';
import * as devkit from '@nx/devkit';
import {
  addProjectConfiguration,
  names,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { executorGenerator as nxExecutorGenerator } from '@nx/plugin/generators';
import { nxExecGenerator } from './generator';
import { NxExecGeneratorOptions } from './schema';

jest.mock('@nx/plugin/generators', () => ({
  executorGenerator: jest.fn()
}));

const nxExecutorGeneratorMock = jest.mocked(nxExecutorGenerator);

const PLUGIN_ROOT = 'tools/demo/plugin';

/**
 * Stand-in for `@nx/plugin:executor`: writes the ambient `schema.d.ts`, the
 * boilerplate `schema.json` / `executor.ts`, (unless the runner is `none`) an
 * `executor.spec.ts`, appends the collection entry, and hoists `@nx/devkit` to the
 * top of the plugin's dependencies — the exact surface the wrapper rewrites.
 */
function fakeExecutorGenerator(
  tree: Tree,
  options: { path: string; name: string; description?: string; unitTestRunner?: string }
) {
  const dir = options.path.slice(0, options.path.lastIndexOf('/'));
  const { className } = names(options.name);

  tree.write(
    `${dir}/schema.d.ts`,
    `export interface ${className}ExecutorSchema {} // eslint-disable-line\n`
  );
  tree.write(
    `${dir}/schema.json`,
    JSON.stringify({ version: 2, title: `${className} executor`, description: '', properties: {} })
  );
  tree.write(
    `${dir}/executor.ts`,
    `const runExecutor = async (options) => { console.log('Executor ran', options); return { success: true }; };\nexport default runExecutor;\n`
  );

  if (options.unitTestRunner !== 'none') {
    tree.write(
      `${dir}/executor.spec.ts`,
      `import { ${className}ExecutorSchema } from './schema';\n`
    );
  }

  devkit.updateJson(tree, `${PLUGIN_ROOT}/executors.json`, (json: { executors: object }) => {
    json.executors = {
      ...json.executors,
      [options.name]: {
        implementation: `./src/lib/executors/${options.name}/executor`,
        schema: `./src/lib/executors/${options.name}/schema.json`,
        description: options.description ?? `${options.name} executor`
      }
    };
    return json;
  });
  devkit.updateJson(tree, `${PLUGIN_ROOT}/package.json`, (json: { dependencies: object }) => {
    json.dependencies = { '@nx/devkit': '23.1.1', ...json.dependencies };
    return json;
  });

  return Promise.resolve();
}

function seedPlugin(tree: Tree): void {
  addProjectConfiguration(tree, 'demo-plugin', {
    root: PLUGIN_ROOT,
    sourceRoot: `${PLUGIN_ROOT}/src`,
    projectType: 'library',
    tags: ['scope:tools', 'type:plugin']
  });
  tree.write(
    `${PLUGIN_ROOT}/package.json`,
    JSON.stringify({
      name: '@cybertecpty/demo-plugin',
      dependencies: { '@cybertecpty/nx-utils': '0.0.1', '@nx/devkit': '23.1.1', tslib: '^2.3.0' },
      executors: './executors.json'
    })
  );
  tree.write(
    `${PLUGIN_ROOT}/executors.json`,
    JSON.stringify({ executors: { 'mmm-existing': { implementation: './existing' } } })
  );
  tree.write(`${PLUGIN_ROOT}/src/index.ts`, `export * from './lib/existing';\n`);
}

function setProjectTags(tree: Tree, tags: string[]): void {
  const config = readProjectConfiguration(tree, 'demo-plugin');
  updateProjectConfiguration(tree, 'demo-plugin', { ...config, tags });
}

function run(tree: Tree, options: Partial<NxExecGeneratorOptions> & { name: string }) {
  return nxExecGenerator(tree, { project: 'demo-plugin', ...options });
}

/** The options `@nx/plugin:executor` was called with on the most recent run. */
function forwardedOptions() {
  return lastCallArg(nxExecutorGeneratorMock, 1, '`@nx/plugin:executor`');
}

describe('nxExecGenerator', () => {
  let tree: Tree;
  let formatFiles: jest.SpyInstance;
  const execDir = `${PLUGIN_ROOT}/src/lib/executors/swa-deploy`;
  const read = (path: string): string => tree.read(path, 'utf-8') ?? '';

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    seedPlugin(tree);
    formatFiles = jest.spyOn(devkit, 'formatFiles').mockResolvedValue();
    nxExecutorGeneratorMock.mockImplementation(
      fakeExecutorGenerator as unknown as typeof nxExecutorGenerator
    );
  });

  describe('target project', () => {
    it('delegates to `@nx/plugin:executor` with an `executor.ts` path under `src/lib/executors`', async () => {
      await run(tree, { name: 'swa-deploy', description: 'Deploy it.' });

      expect(forwardedOptions()).toEqual({
        path: `${execDir}/executor.ts`,
        name: 'swa-deploy',
        description: 'Deploy it.',
        unitTestRunner: 'jest',
        includeHasher: false,
        skipLintChecks: false,
        skipFormat: true
      });
    });

    it('places the executor under `directory` when given, keeping the collection name', async () => {
      await run(tree, { name: 'deploy', directory: 'swa-deploy' });

      expect(forwardedOptions()).toMatchObject({ path: `${execDir}/executor.ts`, name: 'deploy' });
    });

    it('forwards `skipLintChecks`', async () => {
      await run(tree, { name: 'swa-deploy', skipLintChecks: true });

      expect(forwardedOptions().skipLintChecks).toBe(true);
    });

    it('rejects a project that is not tagged `type:plugin`, before delegating', async () => {
      setProjectTags(tree, ['scope:tools', 'type:utils']);

      await expect(run(tree, { name: 'swa-deploy' })).rejects.toThrow(/not a plugin/);
      expect(nxExecutorGeneratorMock).not.toHaveBeenCalled();
    });

    it.each([
      ['name', { name: 'SwaDeploy' }],
      ['name', { name: '1password-sync' }],
      ['directory', { name: 'swa-deploy', directory: 'a/b' }]
    ])('rejects a malformed `%s` before delegating', async (_label, options) => {
      await expect(run(tree, options)).rejects.toThrow(
        'must be lowercase alphanumeric words joined by single hyphens'
      );
      expect(nxExecutorGeneratorMock).not.toHaveBeenCalled();
    });
  });

  describe('generated files', () => {
    it('swaps the ambient `schema.d.ts` for a type-checked `schema.ts` with an `Options` interface', async () => {
      await run(tree, { name: 'swa-deploy' });

      expect(tree.exists(`${execDir}/schema.d.ts`)).toBe(false);
      expect(read(`${execDir}/schema.ts`)).toContain(
        'export interface SwaDeployExecutorOptions {}'
      );
      expect(read(`${execDir}/schema.ts`)).not.toContain('ExecutorSchema');
    });

    it('fails loudly if `@nx/plugin:executor` stops emitting `schema.d.ts`', async () => {
      nxExecutorGeneratorMock.mockImplementationOnce((tree, options) => {
        tree.write(options.path, 'export default () => undefined;');
        return Promise.resolve();
      });

      await expect(run(tree, { name: 'swa-deploy' })).rejects.toThrow(
        /did not emit .*schema\.d\.ts/
      );
    });

    it('writes a strict `schema.json` carrying the description, escaped as JSON', async () => {
      await run(tree, { name: 'swa-deploy', description: 'Deploy "it" <now> & C:\\dist.' });

      expect(readJson(tree, `${execDir}/schema.json`)).toEqual({
        $schema: 'https://json-schema.org/schema',
        version: 2,
        title: 'swa-deploy executor',
        description: 'Deploy "it" <now> & C:\\dist.',
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
      });
    });

    it('falls back to the upstream default description', async () => {
      await run(tree, { name: 'swa-deploy' });

      expect(readJson<{ description: string }>(tree, `${execDir}/schema.json`).description).toBe(
        'swa-deploy executor'
      );
    });

    it('replaces the boilerplate `executor.ts` with a minimal starter', async () => {
      await run(tree, { name: 'swa-deploy' });

      const executor = read(`${execDir}/executor.ts`);
      expect(executor).toContain(
        'const swaDeployExecutor: PromiseExecutor<SwaDeployExecutorOptions>'
      );
      expect(executor).toContain(`logger.error('swa-deploy must run as a project target.')`);
      expect(executor).toContain('export default swaDeployExecutor;');
      expect(executor).not.toContain('console.log');
    });

    it('writes a spec built on the shared executor-context fixture', async () => {
      await run(tree, { name: 'swa-deploy' });

      const spec = read(`${execDir}/executor.spec.ts`);
      expect(spec).toContain(`from '@cybertecpty/nx-testing'`);
      expect(spec).toContain('SwaDeployExecutorOptions');
      expect(spec).not.toContain('ExecutorSchema');
    });

    it('writes no spec when the unit-test runner is `none`', async () => {
      await run(tree, { name: 'swa-deploy', unitTestRunner: 'none' });

      expect(forwardedOptions().unitTestRunner).toBe('none');
      expect(tree.exists(`${execDir}/executor.spec.ts`)).toBe(false);
    });

    it('writes a README with the description and an example target', async () => {
      await run(tree, { name: 'swa-deploy', description: 'Deploy <it> & more.' });

      const readme = read(`${execDir}/README.md`);
      expect(readme).toContain('# `swa-deploy` executor');
      expect(readme).toContain('Deploy <it> & more.');
      expect(readme).toContain('"executor": "@cybertecpty/demo-plugin:swa-deploy"');
    });

    it('leaves a purpose TODO in the README when no description is given', async () => {
      await run(tree, { name: 'swa-deploy' });

      expect(read(`${execDir}/README.md`)).toContain(
        'TODO: describe what the `swa-deploy` executor does.'
      );
    });

    it('names the executor after the project when the plugin has no package name', async () => {
      tree.write(`${PLUGIN_ROOT}/package.json`, JSON.stringify({ dependencies: {} }));

      await run(tree, { name: 'swa-deploy' });

      expect(read(`${execDir}/README.md`)).toContain('"executor": "demo-plugin:swa-deploy"');
    });
  });

  describe('plugin integration', () => {
    const indexPath = `${PLUGIN_ROOT}/src/index.ts`;

    it('re-exports the executor default under its function name and the options type', async () => {
      await run(tree, { name: 'swa-deploy' });

      expect(read(indexPath)).toBe(
        [
          `export * from './lib/existing';`,
          `export { default as swaDeployExecutor } from './lib/executors/swa-deploy/executor';`,
          `export type { SwaDeployExecutorOptions } from './lib/executors/swa-deploy/schema';`,
          ''
        ].join('\n')
      );
    });

    it('does not duplicate the exports when run again for the same executor', async () => {
      await run(tree, { name: 'swa-deploy' });
      await run(tree, { name: 'swa-deploy' });

      expect(read(indexPath).split('./lib/executors/swa-deploy/executor').length - 1).toBe(1);
    });

    it('alpha-sorts the executors collection after the new entry is appended', async () => {
      await run(tree, { name: 'zzz-last' });
      await run(tree, { name: 'aaa-first' });

      const { executors } = readJson<{ executors: object }>(tree, `${PLUGIN_ROOT}/executors.json`);
      expect(Object.keys(executors)).toEqual(['aaa-first', 'mmm-existing', 'zzz-last']);
    });

    it('keeps the plugin dependencies alpha-sorted after `@nx/plugin` hoists `@nx/devkit`', async () => {
      await run(tree, { name: 'swa-deploy' });

      const { dependencies } = readJson<{ dependencies: object }>(
        tree,
        `${PLUGIN_ROOT}/package.json`
      );
      expect(Object.keys(dependencies)).toEqual(['@cybertecpty/nx-utils', '@nx/devkit', 'tslib']);
    });
  });

  describe('formatting', () => {
    it('delegates formatting so it runs once, at the end', async () => {
      await run(tree, { name: 'swa-deploy' });

      expect(forwardedOptions().skipFormat).toBe(true);
      expect(formatFiles).toHaveBeenCalledTimes(1);
    });

    it('skips formatting when `skipFormat` is set', async () => {
      await run(tree, { name: 'swa-deploy', skipFormat: true });

      expect(formatFiles).not.toHaveBeenCalled();
    });
  });
});
