import * as devkit from '@nx/devkit';
import {
  addProjectConfiguration,
  names,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { generatorGenerator as nxGeneratorGenerator } from '@nx/plugin/generators';
import { nxGenGenerator } from './generator';
import { NxGenGeneratorOptions } from './schema';

jest.mock('@nx/plugin/generators', () => ({
  generatorGenerator: jest.fn()
}));

const nxGeneratorGeneratorMock = nxGeneratorGenerator as jest.MockedFunction<
  typeof nxGeneratorGenerator
>;

const PLUGIN_ROOT = 'tools/demo/plugin';

/**
 * Stand-in for `@nx/plugin:generator`: writes the ambient `schema.d.ts`, the
 * `libs/${name}` boilerplate `generator.ts`, and (unless the runner is `none`)
 * a `generator.spec.ts` that imports the `Schema` interface — the exact
 * surface the wrapper is expected to rewrite.
 */
function fakeGeneratorGenerator(
  tree: Tree,
  options: { path: string; name: string; unitTestRunner?: string }
) {
  const dir = options.path.slice(0, options.path.lastIndexOf('/'));
  const { className } = names(options.name);

  // `@nx/plugin:generator` seeds an example `generateFiles` template.
  tree.write(`${dir}/files/src/index.ts.template`, 'const variable = "<%= name %>";');
  tree.write(
    `${dir}/schema.d.ts`,
    `export interface ${className}GeneratorSchema {\n  name: string;\n}\n`
  );
  tree.write(
    `${dir}/generator.ts`,
    [
      `import { addProjectConfiguration, formatFiles, type Tree } from '@nx/devkit';`,
      `import type { ${className}GeneratorSchema } from './schema';`,
      ``,
      `export async function ${names(options.name).propertyName}Generator(tree: Tree, options: ${className}GeneratorSchema) {`,
      `  const projectRoot = \`libs/\${options.name}\`;`,
      `  addProjectConfiguration(tree, options.name, { root: projectRoot });`,
      `  await formatFiles(tree);`,
      `}`,
      ``,
      `export default ${names(options.name).propertyName}Generator;`
    ].join('\n')
  );

  if (options.unitTestRunner !== 'none') {
    tree.write(
      `${dir}/generator.spec.ts`,
      [
        `import { ${names(options.name).propertyName}Generator } from './generator';`,
        `import { ${className}GeneratorSchema } from './schema';`,
        ``,
        `describe('${options.name} generator', () => {`,
        `  const options: ${className}GeneratorSchema = { name: 'test' };`,
        `  it('should run successfully', () => expect(options).toBeDefined());`,
        `});`
      ].join('\n')
    );
  }

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
    `${PLUGIN_ROOT}/src/index.ts`,
    `export { default as pluginGenerator } from './lib/generators/plugin/generator';\n`
  );
}

function setProjectTags(tree: Tree, tags: string[]): void {
  const config = readProjectConfiguration(tree, 'demo-plugin');
  updateProjectConfiguration(tree, 'demo-plugin', { ...config, tags });
}

function run(tree: Tree, options: Partial<NxGenGeneratorOptions> & { name: string }) {
  return nxGenGenerator(tree, { project: 'demo-plugin', ...options });
}

/** The options `@nx/plugin:generator` was called with on the most recent run. */
function forwardedOptions() {
  const lastCall = nxGeneratorGeneratorMock.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error('`@nx/plugin:generator` was never called');
  }

  return lastCall[1];
}

describe('nxGenGenerator', () => {
  let tree: Tree;
  let formatFiles: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    seedPlugin(tree);
    formatFiles = jest.spyOn(devkit, 'formatFiles').mockResolvedValue();
    nxGeneratorGeneratorMock.mockImplementation(
      fakeGeneratorGenerator as unknown as typeof nxGeneratorGenerator
    );
  });

  describe('target project', () => {
    it('delegates to `@nx/plugin:generator` with a path under the plugin `src/lib/generators`', async () => {
      await run(tree, { name: 'release-manifest' });

      expect(forwardedOptions()).toMatchObject({
        path: 'tools/demo/plugin/src/lib/generators/release-manifest/generator.ts',
        name: 'release-manifest',
        unitTestRunner: 'jest',
        skipFormat: true
      });
    });

    it('places the generator under `directory` when given, keeping the collection name', async () => {
      await run(tree, { name: 'nx-gen', directory: 'generator' });

      expect(forwardedOptions()).toMatchObject({
        path: 'tools/demo/plugin/src/lib/generators/generator/generator.ts',
        name: 'nx-gen'
      });
    });

    it('rejects a project that is not tagged `type:plugin`, before delegating', async () => {
      setProjectTags(tree, ['scope:tools', 'type:utils']);

      await expect(run(tree, { name: 'demo' })).rejects.toThrow(/not a plugin/);
      expect(nxGeneratorGeneratorMock).not.toHaveBeenCalled();
    });

    it('rejects a malformed `directory` before delegating', async () => {
      await expect(run(tree, { name: 'demo', directory: 'Bad/Seg' })).rejects.toThrow(
        'must be lowercase alphanumeric words joined by single hyphens'
      );
      expect(nxGeneratorGeneratorMock).not.toHaveBeenCalled();
    });
  });

  describe('generated files', () => {
    const genDir = `${PLUGIN_ROOT}/src/lib/generators/release-manifest`;

    it('swaps the ambient `schema.d.ts` for a type-checked `schema.ts` with an `Options` interface', async () => {
      await run(tree, { name: 'release-manifest' });

      expect(tree.exists(`${genDir}/schema.d.ts`)).toBe(false);

      const schema = tree.read(`${genDir}/schema.ts`, 'utf-8');
      expect(schema).toContain('export interface ReleaseManifestGeneratorOptions');
      expect(schema).not.toContain('GeneratorSchema');
    });

    it('replaces the boilerplate `generator.ts` with a minimal starter', async () => {
      await run(tree, { name: 'release-manifest' });

      const generator = tree.read(`${genDir}/generator.ts`, 'utf-8') ?? '';
      expect(generator).toContain('export async function releaseManifestGenerator');
      expect(generator).toContain('ReleaseManifestGeneratorOptions');
      expect(generator).toContain('formatFiles');
      expect(generator).not.toContain('addProjectConfiguration');
      expect(generator).not.toContain('libs/');
    });

    it('drops the upstream example `files/` template so the starter is clean', async () => {
      await run(tree, { name: 'release-manifest' });

      expect(tree.exists(`${genDir}/files/src/index.ts.template`)).toBe(false);
    });

    it('fails loudly if `@nx/plugin:generator` stops emitting `schema.d.ts`', async () => {
      nxGeneratorGeneratorMock.mockImplementationOnce((tree, options) => {
        const dir = options.path.slice(0, options.path.lastIndexOf('/'));
        tree.write(`${dir}/generator.ts`, 'export default () => undefined;');
        return Promise.resolve();
      });

      await expect(run(tree, { name: 'release-manifest' })).rejects.toThrow(
        /did not emit .*schema\.d\.ts/
      );
    });

    it('regenerates the spec against the `Options` interface', async () => {
      await run(tree, { name: 'release-manifest' });

      const spec = tree.read(`${genDir}/generator.spec.ts`, 'utf-8') ?? '';
      expect(spec).toContain('ReleaseManifestGeneratorOptions');
      expect(spec).not.toContain('GeneratorSchema');
    });

    it('writes no spec when the unit-test runner is `none`', async () => {
      await run(tree, { name: 'release-manifest', unitTestRunner: 'none' });

      expect(forwardedOptions().unitTestRunner).toBe('none');
      expect(tree.exists(`${genDir}/generator.spec.ts`)).toBe(false);
    });
  });

  describe('plugin entry point', () => {
    const indexPath = `${PLUGIN_ROOT}/src/index.ts`;

    it('re-exports the generator default under its function name and the options type', async () => {
      await run(tree, { name: 'release-manifest' });

      const index = tree.read(indexPath, 'utf-8') ?? '';
      expect(index).toContain(
        `export { default as releaseManifestGenerator } from './lib/generators/release-manifest/generator';`
      );
      expect(index).toContain(
        `export type { ReleaseManifestGeneratorOptions } from './lib/generators/release-manifest/schema';`
      );
    });

    it('does not duplicate the exports when run again for the same generator', async () => {
      await run(tree, { name: 'release-manifest' });
      await run(tree, { name: 'release-manifest' });

      const index = tree.read(indexPath, 'utf-8') ?? '';
      const occurrences = index.split('./lib/generators/release-manifest/generator').length - 1;
      expect(occurrences).toBe(1);
    });
  });

  describe('formatting', () => {
    it('delegates formatting so it runs once, at the end', async () => {
      await run(tree, { name: 'demo' });

      expect(forwardedOptions().skipFormat).toBe(true);
      expect(formatFiles).toHaveBeenCalledTimes(1);
    });

    it('skips formatting when `skipFormat` is set', async () => {
      await run(tree, { name: 'demo', skipFormat: true });

      expect(formatFiles).not.toHaveBeenCalled();
    });
  });
});
