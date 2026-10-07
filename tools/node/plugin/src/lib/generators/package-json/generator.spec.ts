import { logger, readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { PackageJson } from 'type-fest';
import { packageJsonGenerator } from './generator';
import type { PackageJsonGeneratorOptions } from './schema';

function run(
  tree: Tree,
  options: Partial<PackageJsonGeneratorOptions> & { dir: string; name: string }
): Promise<string> {
  return packageJsonGenerator(tree, options);
}

describe('packageJsonGenerator', () => {
  let tree: Tree;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('defaults', () => {
    it('creates the file with the default version, private: true, and the scope-prefixed name', async () => {
      const path = await run(tree, { dir: 'libs/tools', name: 'widget' });

      expect(path).toBe('libs/tools/package.json');
      expect(readJson<PackageJson>(tree, path)).toEqual({
        name: '@proj/widget',
        version: '0.0.1',
        private: true
      });
    });

    it('applies the workspace scope resolved from the root package.json, not a hardcoded value', async () => {
      writeJson(tree, 'package.json', { name: '@customscope/workspace' });

      const path = await run(tree, { dir: 'libs/tools', name: 'widget' });

      expect(readJson<PackageJson>(tree, path).name).toBe('@customscope/widget');
    });

    it('throws when the workspace scope cannot be resolved', async () => {
      writeJson(tree, 'package.json', { name: 'unscoped-workspace' });

      await expect(run(tree, { dir: 'libs/tools', name: 'widget' })).rejects.toThrow(
        'Unable to determine workspace npm scope'
      );
      expect(tree.exists('libs/tools/package.json')).toBe(false);
    });
  });

  describe('version', () => {
    it('writes an explicit version when provided', async () => {
      const path = await run(tree, { dir: 'libs/tools', name: 'widget', vers: '2.3.4' });

      expect(readJson<PackageJson>(tree, path).version).toBe('2.3.4');
    });

    it('rejects an invalid version without writing the file', async () => {
      await expect(
        run(tree, { dir: 'libs/tools', name: 'widget', vers: 'not-a-version' })
      ).rejects.toThrow('Invalid version: not-a-version');
      expect(tree.exists('libs/tools/package.json')).toBe(false);
    });
  });

  describe('private', () => {
    it('omits the private field entirely when explicitly set to false', async () => {
      const path = await run(tree, { dir: 'libs/tools', name: 'widget', private: false });

      expect(readJson<PackageJson>(tree, path)).not.toHaveProperty('private');
    });

    it('writes private: true when explicitly set to true', async () => {
      const path = await run(tree, { dir: 'libs/tools', name: 'widget', private: true });

      expect(readJson<PackageJson>(tree, path).private).toBe(true);
    });
  });

  describe('optional fields', () => {
    it('writes main, engines.node, and scripts.start only when supplied', async () => {
      const path = await run(tree, {
        dir: 'apps/web',
        name: 'web',
        main: 'server/server.mjs',
        nodeEngine: '^20.19.0 || ^22.12.0 || ^24.0.0',
        startScript: 'node server/server.mjs'
      });

      expect(readJson<PackageJson>(tree, path)).toMatchObject({
        main: 'server/server.mjs',
        engines: { node: '^20.19.0 || ^22.12.0 || ^24.0.0' },
        scripts: { start: 'node server/server.mjs' }
      });
    });

    it('omits main, engines, and scripts when not supplied', async () => {
      const path = await run(tree, { dir: 'libs/tools', name: 'widget' });
      const packageJson = readJson<PackageJson>(tree, path);

      expect(packageJson).not.toHaveProperty('main');
      expect(packageJson).not.toHaveProperty('engines');
      expect(packageJson).not.toHaveProperty('scripts');
    });
  });

  describe('dependency copying', () => {
    beforeEach(() => {
      writeJson(tree, 'package.json', {
        name: '@proj/source',
        dependencies: { '@angular/core': '^20.0.0' },
        devDependencies: { typescript: '~5.9.0' }
      });
    });

    it('copies matching dependency versions regardless of which root map they came from', async () => {
      const path = await run(tree, {
        dir: 'apps/web',
        name: 'web',
        dependencies: ['@angular/core', 'typescript']
      });

      expect(readJson<PackageJson>(tree, path).dependencies).toEqual({
        '@angular/core': '^20.0.0',
        typescript: '~5.9.0'
      });
    });

    it('omits dependencies entirely when the option is not supplied', async () => {
      const path = await run(tree, { dir: 'apps/web', name: 'web' });

      expect(readJson<PackageJson>(tree, path)).not.toHaveProperty('dependencies');
    });

    it('throws a single error listing every requested name not found in either root map, without writing the file', async () => {
      await expect(
        run(tree, {
          dir: 'apps/web',
          name: 'web',
          dependencies: ['@angular/core', 'missing-one', 'missing-two']
        })
      ).rejects.toThrow('missing-one, missing-two');
      expect(tree.exists('apps/web/package.json')).toBe(false);
    });
  });

  describe('guard conditions', () => {
    it('warns and leaves an existing package.json untouched without --overwrite', async () => {
      tree.write('libs/tools/package.json', '{"name":"stale"}');

      const path = await run(tree, { dir: 'libs/tools', name: 'widget' });

      expect(tree.read(path, 'utf-8')).toBe('{"name":"stale"}');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    });

    it('replaces an existing package.json when --overwrite is set', async () => {
      tree.write('libs/tools/package.json', '{"name":"stale"}');

      const path = await run(tree, { dir: 'libs/tools', name: 'widget', overwrite: true });

      expect(readJson<PackageJson>(tree, path).name).toBe('@proj/widget');
    });
  });

  describe('formatting', () => {
    it('completes without formatting when skipFormat is set', async () => {
      await expect(
        run(tree, { dir: 'libs/tools', name: 'widget', skipFormat: true })
      ).resolves.toBe('libs/tools/package.json');
    });
  });
});
