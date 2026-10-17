import { addProjectConfiguration, readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addPluginExports,
  assertArtifactAbsent,
  assertValidArtifactName,
  readPluginPackageName,
  readPluginProject,
  removeUpstreamSchemaDeclaration,
  sortPluginCollection,
  sortPluginDependencies
} from './plugin-project.utils';

const PLUGIN_ROOT = 'tools/demo/plugin';

function seedPlugin(tree: Tree, tags = ['scope:tools', 'type:plugin']): void {
  addProjectConfiguration(tree, 'demo-plugin', {
    root: PLUGIN_ROOT,
    sourceRoot: `${PLUGIN_ROOT}/src`,
    projectType: 'library',
    tags
  });
}

describe('assertValidArtifactName', () => {
  const VALID = ['swa-deploy', 'e2e-probe', 'x2', 'a-1b'];
  const INVALID = ['1password-sync', 'SwaDeploy', 'swa--deploy', '-swa', 'swa-', 'swa/deploy', ''];

  it.each(VALID)('accepts `%s`', name => {
    expect(() => assertValidArtifactName(name)).not.toThrow();
  });

  it.each(INVALID)('rejects `%s`', name => {
    expect(() => assertValidArtifactName(name)).toThrow(
      `\`name\` "${name}" must be lowercase alphanumeric words joined by single hyphens, starting with a letter`
    );
  });

  it.each(['generator', 'executor'])(
    'agrees with the `name` pattern in the `%s` wrapper schema',
    folder => {
      const schema = JSON.parse(
        readFileSync(join(__dirname, '..', 'generators', folder, 'schema.json'), 'utf-8')
      ) as { properties: { name: { pattern: string } } };
      const pattern = new RegExp(schema.properties.name.pattern);

      for (const name of [...VALID, ...INVALID]) {
        let runtimeAccepts = true;
        try {
          assertValidArtifactName(name);
        } catch {
          runtimeAccepts = false;
        }
        expect({ name, schemaAccepts: pattern.test(name) }).toEqual({
          name,
          schemaAccepts: runtimeAccepts
        });
      }
    }
  );
});

describe('readPluginProject', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('returns the configuration of a `type:plugin` project', () => {
    seedPlugin(tree);

    expect(readPluginProject(tree, 'demo-plugin')).toMatchObject({ root: PLUGIN_ROOT });
  });

  it('rejects a project without the `type:plugin` tag, naming the scaffold command', () => {
    seedPlugin(tree, ['scope:tools', 'type:utils']);

    expect(() => readPluginProject(tree, 'demo-plugin')).toThrow(
      /"demo-plugin" is not a plugin .*nx-plugin:nx-plugin/
    );
  });

  it('rejects a project with no tags at all', () => {
    addProjectConfiguration(tree, 'untagged', { root: 'tools/untagged' });

    expect(() => readPluginProject(tree, 'untagged')).toThrow(/not a plugin/);
  });
});

describe('readPluginPackageName', () => {
  let tree: Tree;
  const packageJsonPath = `${PLUGIN_ROOT}/package.json`;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('returns the package name', () => {
    tree.write(packageJsonPath, JSON.stringify({ name: '@cybertecpty/demo-plugin' }));

    expect(readPluginPackageName(tree, PLUGIN_ROOT)).toBe('@cybertecpty/demo-plugin');
  });

  it('returns undefined when the package has no string name', () => {
    tree.write(packageJsonPath, JSON.stringify({ name: 42 }));

    expect(readPluginPackageName(tree, PLUGIN_ROOT)).toBeUndefined();
  });

  it('returns undefined when the plugin has no package.json', () => {
    expect(readPluginPackageName(tree, PLUGIN_ROOT)).toBeUndefined();
  });
});

describe('removeUpstreamSchemaDeclaration', () => {
  let tree: Tree;
  const artifactDir = `${PLUGIN_ROOT}/src/lib/executors/demo`;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('removes the ambient declaration', () => {
    tree.write(`${artifactDir}/schema.d.ts`, 'export interface DemoExecutorSchema {}\n');

    removeUpstreamSchemaDeclaration(tree, artifactDir, 'executor');

    expect(tree.exists(`${artifactDir}/schema.d.ts`)).toBe(false);
  });

  it.each([
    ['executor', 'nx-exec'],
    ['generator', 'nx-gen']
  ] as const)(
    'fails loudly, naming the `%s` wrapper, when upstream emitted none',
    (kind, wrapper) => {
      expect(() => removeUpstreamSchemaDeclaration(tree, artifactDir, kind)).toThrow(
        `\`@nx/plugin:${kind}\` did not emit ${artifactDir}/schema.d.ts; its output shape has changed and \`${wrapper}\` needs updating.`
      );
    }
  );
});

describe('assertArtifactAbsent', () => {
  let tree: Tree;
  const artifactDir = `${PLUGIN_ROOT}/src/lib/executors/swa-deploy`;
  const target = { kind: 'executor', name: 'swa-deploy', artifactDir } as const;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('passes for a new artifact', () => {
    tree.write(`${PLUGIN_ROOT}/executors.json`, JSON.stringify({ executors: { other: {} } }));

    expect(() => assertArtifactAbsent(tree, PLUGIN_ROOT, target)).not.toThrow();
  });

  it('passes when the plugin has no collection file yet', () => {
    expect(() => assertArtifactAbsent(tree, PLUGIN_ROOT, target)).not.toThrow();
  });

  it('refuses an artifact folder that already exists', () => {
    tree.write(`${artifactDir}/executor.ts`, 'export default () => undefined;');

    expect(() => assertArtifactAbsent(tree, PLUGIN_ROOT, target)).toThrow(
      `The executor folder ${artifactDir} already exists. Delete it first to regenerate it`
    );
  });

  it('refuses a name already in the collection, even under another folder', () => {
    tree.write(
      `${PLUGIN_ROOT}/executors.json`,
      JSON.stringify({ executors: { 'swa-deploy': { implementation: './elsewhere' } } })
    );

    expect(() => assertArtifactAbsent(tree, PLUGIN_ROOT, target)).toThrow(
      `${PLUGIN_ROOT}/executors.json already has a "swa-deploy" executor`
    );
  });

  it('checks the legacy collection key and a collection path declared in package.json', () => {
    tree.write(`${PLUGIN_ROOT}/package.json`, JSON.stringify({ schematics: './collection.json' }));
    tree.write(`${PLUGIN_ROOT}/collection.json`, JSON.stringify({ schematics: { demo: {} } }));

    expect(() =>
      assertArtifactAbsent(tree, PLUGIN_ROOT, {
        kind: 'generator',
        name: 'demo',
        artifactDir: `${PLUGIN_ROOT}/src/lib/generators/demo`
      })
    ).toThrow(`${PLUGIN_ROOT}/collection.json already has a "demo" generator`);
  });
});

describe('addPluginExports', () => {
  let tree: Tree;
  const indexPath = `${PLUGIN_ROOT}/src/index.ts`;
  const demoExecutor = {
    kind: 'executor',
    directory: 'demo',
    fnName: 'demoExecutor',
    optionsType: 'DemoExecutorOptions'
  } as const;
  const DEFAULT_EXPORT = `export { default as demoExecutor } from './lib/executors/demo/executor';`;
  const TYPE_EXPORT = `export type { DemoExecutorOptions } from './lib/executors/demo/schema';`;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedPlugin(tree);
  });

  it('adds the default and options-type re-exports above an exports-only barrel', () => {
    tree.write(indexPath, `export * from './lib/other';\n`);

    addPluginExports(tree, { root: PLUGIN_ROOT, sourceRoot: `${PLUGIN_ROOT}/src` }, demoExecutor);

    expect(tree.read(indexPath, 'utf-8')).toBe(
      `${DEFAULT_EXPORT}\n${TYPE_EXPORT}\nexport * from './lib/other';\n`
    );
  });

  it('adds them after the last import when the barrel has imports', () => {
    tree.write(indexPath, `import './polyfill';\nexport * from './lib/other';\n`);

    addPluginExports(tree, { root: PLUGIN_ROOT }, demoExecutor);

    const index = tree.read(indexPath, 'utf-8') ?? '';
    expect(index.startsWith(`import './polyfill';\n`)).toBe(true);
    expect(index).toContain(DEFAULT_EXPORT);
    expect(index).toContain(TYPE_EXPORT);
  });

  it('builds generator paths from the kind', () => {
    addPluginExports(
      tree,
      { root: PLUGIN_ROOT },
      { kind: 'generator', directory: 'demo', fnName: 'demoGenerator', optionsType: 'DemoOptions' }
    );

    const index = tree.read(indexPath, 'utf-8') ?? '';
    expect(index).toContain(
      `export { default as demoGenerator } from './lib/generators/demo/generator';`
    );
    expect(index).toContain(`export type { DemoOptions } from './lib/generators/demo/schema';`);
  });

  it('creates the index under `<root>/src` when the project has neither a source root nor an index', () => {
    addPluginExports(tree, { root: PLUGIN_ROOT }, demoExecutor);

    expect(tree.read(indexPath, 'utf-8')).toBe(`${DEFAULT_EXPORT}\n${TYPE_EXPORT}\n`);
  });
});

describe('sortPluginDependencies', () => {
  let tree: Tree;
  const packageJsonPath = `${PLUGIN_ROOT}/package.json`;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('alpha-sorts the dependencies, leaving the other fields in place', () => {
    tree.write(
      packageJsonPath,
      JSON.stringify({
        name: '@cybertecpty/demo-plugin',
        dependencies: { '@nx/devkit': '1', '@cybertecpty/nx-utils': '1', tslib: '1' },
        executors: './executors.json'
      })
    );

    sortPluginDependencies(tree, PLUGIN_ROOT);

    const packageJson = readJson<{ dependencies: object }>(tree, packageJsonPath);
    expect(Object.keys(packageJson)).toEqual(['name', 'dependencies', 'executors']);
    expect(Object.keys(packageJson.dependencies)).toEqual([
      '@cybertecpty/nx-utils',
      '@nx/devkit',
      'tslib'
    ]);
  });

  it('leaves a package.json without dependencies unchanged', () => {
    tree.write(packageJsonPath, JSON.stringify({ name: 'demo' }));

    sortPluginDependencies(tree, PLUGIN_ROOT);

    expect(readJson(tree, packageJsonPath)).toEqual({ name: 'demo' });
  });

  it('does nothing when the plugin has no package.json', () => {
    sortPluginDependencies(tree, PLUGIN_ROOT);

    expect(tree.exists(packageJsonPath)).toBe(false);
  });
});

describe('sortPluginCollection', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    seedPlugin(tree);
  });

  const keysOf = (path: string, key: string): string[] =>
    Object.keys(readJson<Record<string, Record<string, unknown>>>(tree, path)[key] ?? {});

  it('alpha-sorts a generators collection', () => {
    tree.write(`${PLUGIN_ROOT}/generators.json`, JSON.stringify({ generators: { b: {}, a: {} } }));

    sortPluginCollection(tree, PLUGIN_ROOT, 'generator');

    expect(keysOf(`${PLUGIN_ROOT}/generators.json`, 'generators')).toEqual(['a', 'b']);
  });

  it('alpha-sorts an executors collection, including a legacy `builders` key', () => {
    tree.write(
      `${PLUGIN_ROOT}/executors.json`,
      JSON.stringify({ executors: { z: {}, m: {} }, builders: { y: {}, x: {} } })
    );

    sortPluginCollection(tree, PLUGIN_ROOT, 'executor');

    expect(keysOf(`${PLUGIN_ROOT}/executors.json`, 'executors')).toEqual(['m', 'z']);
    expect(keysOf(`${PLUGIN_ROOT}/executors.json`, 'builders')).toEqual(['x', 'y']);
  });

  it('resolves the collection file from the `package.json` field', () => {
    tree.write(`${PLUGIN_ROOT}/package.json`, JSON.stringify({ executors: './custom.json' }));
    tree.write(`${PLUGIN_ROOT}/custom.json`, JSON.stringify({ executors: { b: {}, a: {} } }));

    sortPluginCollection(tree, PLUGIN_ROOT, 'executor');

    expect(keysOf(`${PLUGIN_ROOT}/custom.json`, 'executors')).toEqual(['a', 'b']);
  });

  it('resolves a legacy `schematics` field for generators', () => {
    tree.write(`${PLUGIN_ROOT}/package.json`, JSON.stringify({ schematics: './collection.json' }));
    tree.write(`${PLUGIN_ROOT}/collection.json`, JSON.stringify({ schematics: { b: {}, a: {} } }));

    sortPluginCollection(tree, PLUGIN_ROOT, 'generator');

    expect(keysOf(`${PLUGIN_ROOT}/collection.json`, 'schematics')).toEqual(['a', 'b']);
  });

  it('does nothing when the collection file does not exist', () => {
    sortPluginCollection(tree, PLUGIN_ROOT, 'executor');

    expect(tree.exists(`${PLUGIN_ROOT}/executors.json`)).toBe(false);
  });
});
