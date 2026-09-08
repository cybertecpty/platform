import { gitLocalUserEmail, gitLocalUserName } from '@cybertecpty/git-utils';
import * as devkit from '@nx/devkit';
import { addProjectConfiguration, readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { releaseManifestGenerator } from './generator';
import type { ReleaseManifestGeneratorOptions } from './schema';

jest.mock('@cybertecpty/git-utils', () => ({
  gitLocalUserEmail: jest.fn(),
  gitLocalUserName: jest.fn()
}));

const gitLocalUserNameMock = gitLocalUserName as jest.MockedFunction<typeof gitLocalUserName>;
const gitLocalUserEmailMock = gitLocalUserEmail as jest.MockedFunction<typeof gitLocalUserEmail>;

const LIB_ROOT = 'libs/shared/thing';
const APP_ROOT = 'apps/web';

function seedLib(tree: Tree): void {
  addProjectConfiguration(tree, 'shared-thing', {
    root: LIB_ROOT,
    sourceRoot: `${LIB_ROOT}/src`,
    projectType: 'library'
  });
}

function seedApp(tree: Tree): void {
  addProjectConfiguration(tree, 'web', {
    root: APP_ROOT,
    sourceRoot: `${APP_ROOT}/src`,
    projectType: 'application'
  });
}

function run(
  tree: Tree,
  options: Partial<ReleaseManifestGeneratorOptions> & { project: string }
): Promise<void> {
  return releaseManifestGenerator(tree, {
    version: '1.2.3',
    releaseCommit: 'abc123def4',
    ...options
  });
}

describe('releaseManifestGenerator', () => {
  let tree: Tree;
  let formatFiles: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    formatFiles = jest.spyOn(devkit, 'formatFiles').mockResolvedValue();
    gitLocalUserNameMock.mockResolvedValue('Jane Doe');
    gitLocalUserEmailMock.mockResolvedValue('jane@example.com');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('manifest location', () => {
    it('writes to the project root for a library', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing' });

      expect(tree.exists(`${LIB_ROOT}/release-manifest.json`)).toBe(true);
    });

    it('writes to the project root for an application', async () => {
      seedApp(tree);

      await run(tree, { project: 'web' });

      expect(tree.exists(`${APP_ROOT}/release-manifest.json`)).toBe(true);
    });

    it('honours `dirPath` relative to the project root, creating intermediate dirs', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing', dirPath: 'dist/release-metadata' });

      expect(tree.exists(`${LIB_ROOT}/dist/release-metadata/release-manifest.json`)).toBe(true);
      expect(tree.exists(`${LIB_ROOT}/release-manifest.json`)).toBe(false);
    });

    it('overwrites an existing manifest without prompting', async () => {
      seedLib(tree);
      tree.write(`${LIB_ROOT}/release-manifest.json`, '{"stale":true}');

      await run(tree, { project: 'shared-thing', version: '9.9.9' });

      expect(readJson(tree, `${LIB_ROOT}/release-manifest.json`)).toMatchObject({
        version: '9.9.9'
      });
    });

    it('never touches the project configuration', async () => {
      const updateProjectConfiguration = jest.spyOn(devkit, 'updateProjectConfiguration');
      seedLib(tree);

      await run(tree, { project: 'shared-thing' });

      expect(updateProjectConfiguration).not.toHaveBeenCalled();
    });
  });

  describe('manifest contents', () => {
    it('records project identity, commit and version', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing', version: '1.4.0', releaseCommit: 'deadbeef' });

      expect(readJson(tree, `${LIB_ROOT}/release-manifest.json`)).toMatchObject({
        project: 'shared-thing',
        releaseCommit: 'deadbeef',
        version: '1.4.0'
      });
    });

    it('orders the keys alphabetically', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing' });

      expect(Object.keys(readJson(tree, `${LIB_ROOT}/release-manifest.json`))).toEqual([
        'author',
        'project',
        'releaseCommit',
        'releaseDate',
        'version'
      ]);
    });

    it('stores the version verbatim', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing', version: '2.0.0-rc.1' });

      expect(readJson(tree, `${LIB_ROOT}/release-manifest.json`)).toMatchObject({
        version: '2.0.0-rc.1'
      });
    });
  });

  describe('author resolution', () => {
    it('uses the git user name only for an application', async () => {
      seedApp(tree);

      await run(tree, { project: 'web' });

      expect(readJson(tree, `${APP_ROOT}/release-manifest.json`).author).toBe('Jane Doe');
    });

    it('uses the git user name and email for a library', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing' });

      expect(readJson(tree, `${LIB_ROOT}/release-manifest.json`).author).toBe(
        'Jane Doe (jane@example.com)'
      );
    });

    it('drops the email for a library when it is not configured', async () => {
      gitLocalUserEmailMock.mockResolvedValue('');
      seedLib(tree);

      await run(tree, { project: 'shared-thing' });

      expect(readJson(tree, `${LIB_ROOT}/release-manifest.json`).author).toBe('Jane Doe');
    });

    it('uses an explicit `--author` verbatim', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing', author: 'Release Bot (bot@cybertecpty.com)' });

      expect(readJson(tree, `${LIB_ROOT}/release-manifest.json`).author).toBe(
        'Release Bot (bot@cybertecpty.com)'
      );
    });

    it('omits the author key entirely when no name resolves and none is given', async () => {
      gitLocalUserNameMock.mockResolvedValue('');
      gitLocalUserEmailMock.mockResolvedValue('');
      seedLib(tree);

      await run(tree, { project: 'shared-thing' });

      expect(readJson(tree, `${LIB_ROOT}/release-manifest.json`)).not.toHaveProperty('author');
    });
  });

  describe('release date', () => {
    it('defaults to an ISO 8601 timestamp for now', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing' });

      const { releaseDate } = readJson(tree, `${LIB_ROOT}/release-manifest.json`);
      expect(releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(Date.now() - Date.parse(releaseDate)).toBeLessThan(60_000);
    });

    it('normalizes a provided date to an ISO 8601 UTC string', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing', releaseDate: '2026-04-22' });

      expect(readJson(tree, `${LIB_ROOT}/release-manifest.json`).releaseDate).toBe(
        '2026-04-22T00:00:00.000Z'
      );
    });

    it('keeps an already-canonical timestamp unchanged', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing', releaseDate: '2026-04-22T15:30:00.000Z' });

      expect(readJson(tree, `${LIB_ROOT}/release-manifest.json`).releaseDate).toBe(
        '2026-04-22T15:30:00.000Z'
      );
    });
  });

  describe('validation', () => {
    it('rejects an unknown project before writing anything', async () => {
      await expect(run(tree, { project: 'ghost' })).rejects.toThrow(/ghost/);
      expect(tree.exists('release-manifest.json')).toBe(false);
    });

    it('rejects a non-semver version before writing anything', async () => {
      seedLib(tree);

      await expect(
        run(tree, { project: 'shared-thing', version: 'not-a-version' })
      ).rejects.toThrow(/version/i);
      expect(tree.exists(`${LIB_ROOT}/release-manifest.json`)).toBe(false);
    });

    it('rejects an unparseable release date before writing anything', async () => {
      seedLib(tree);

      await expect(
        run(tree, { project: 'shared-thing', releaseDate: 'last thursday' })
      ).rejects.toThrow(/date/i);
      expect(tree.exists(`${LIB_ROOT}/release-manifest.json`)).toBe(false);
    });

    it('rejects a `dirPath` that escapes the project root before writing anything', async () => {
      seedLib(tree);

      await expect(
        run(tree, { project: 'shared-thing', dirPath: '../../elsewhere' })
      ).rejects.toThrow(/dirPath/);
      expect(tree.exists('elsewhere/release-manifest.json')).toBe(false);
      expect(tree.exists(`${LIB_ROOT}/release-manifest.json`)).toBe(false);
    });
  });

  describe('formatting', () => {
    it('formats generated files by default', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing' });

      expect(formatFiles).toHaveBeenCalledTimes(1);
    });

    it('skips formatting when `skipFormat` is set', async () => {
      seedLib(tree);

      await run(tree, { project: 'shared-thing', skipFormat: true });

      expect(formatFiles).not.toHaveBeenCalled();
    });
  });
});
