import { createExecutorContextFixture } from '@cybertecpty/nx-testing';
import { lastCallArg } from '@cybertecpty/vitest-testing';
import { logger, type ExecutorContext, type TargetConfiguration } from '@nx/devkit';
import AdmZip from 'adm-zip';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as tar from 'tar';
import { vi } from 'vitest';
import fileArchiveExecutor from './executor';

const DEFAULT_BUILD: TargetConfiguration = { outputs: ['{workspaceRoot}/dist/{projectRoot}'] };

const lastError = (): string => lastCallArg(vi.mocked(logger.error), 0, '`logger.error`') as string;

describe('fileArchiveExecutor', () => {
  let root: string;

  const createContext = (
    targets: Record<string, TargetConfiguration> = { build: DEFAULT_BUILD },
    overrides: Partial<ExecutorContext> = {}
  ): ExecutorContext =>
    createExecutorContextFixture(
      { projectName: 'web', projectRoot: 'apps/web', targets },
      { root, cwd: root, ...overrides }
    );

  const writeFiles = async (files: Record<string, string>): Promise<void> => {
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content);
    }
  };

  const zipNames = (path: string): string[] =>
    new AdmZip(join(root, path)).getEntries().map(entry => entry.entryName);

  const tarNames = async (path: string): Promise<string[]> => {
    const names: string[] = [];
    await tar.t({ file: join(root, path), onentry: entry => names.push(entry.path) });
    return names;
  };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'file-archive-executor-'));
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  describe('source folder', () => {
    it("archives the build target's single output by default", async () => {
      await writeFiles({ 'dist/apps/web/index.html': 'a' });

      await expect(fileArchiveExecutor({}, createContext())).resolves.toEqual({ success: true });

      expect(zipNames('dist/apps/web.zip')).toEqual(['index.html']);
    });

    it('prefers source over buildTarget, without needing a build target', async () => {
      await writeFiles({ 'out/site/a.txt': 'a' });

      await expect(
        fileArchiveExecutor({ source: 'out/site', buildTarget: 'missing' }, createContext({}))
      ).resolves.toEqual({ success: true });

      expect(zipNames('out/site.zip')).toEqual(['a.txt']);
    });

    it('reads the output of the target named by buildTarget when source is omitted', async () => {
      await writeFiles({ 'dist/static/a.txt': 'a' });
      const targets = { 'build-static': { outputs: ['{workspaceRoot}/dist/static'] } };

      await fileArchiveExecutor({ buildTarget: 'build-static' }, createContext(targets));

      expect(zipNames('dist/static.zip')).toEqual(['a.txt']);
    });

    it.each<[string, Record<string, TargetConfiguration>, string]>([
      ['there is no build target', {}, 'web has no "build" target'],
      ['the build target declares no outputs', { build: {} }, 'declares no outputs'],
      [
        'the build target declares several outputs',
        { build: { outputs: ['{workspaceRoot}/dist/a', '{workspaceRoot}/coverage/a'] } },
        'exactly one output folder'
      ]
    ])('logs a hint to set source and fails when %s', async (_label, targets, expected) => {
      await expect(fileArchiveExecutor({}, createContext(targets))).resolves.toEqual({
        success: false
      });

      expect(lastError()).toContain(expected);
      expect(lastError()).toContain('Set the source option');
    });

    it('fails with a clear message when the folder is missing', async () => {
      await expect(fileArchiveExecutor({ source: 'dist/nope' }, createContext())).resolves.toEqual({
        success: false
      });

      expect(lastError()).toContain('"dist/nope" does not exist');
    });

    it('fails with a clear message when the folder is empty', async () => {
      await mkdir(join(root, 'dist/empty/nested'), { recursive: true });

      await expect(fileArchiveExecutor({ source: 'dist/empty' }, createContext())).resolves.toEqual(
        { success: false }
      );

      expect(lastError()).toContain('"dist/empty" contains no files');
    });

    it('fails when run outside a project target', async () => {
      await expect(
        fileArchiveExecutor(
          { source: 'dist' },
          createContext(undefined, { projectName: undefined })
        )
      ).resolves.toEqual({ success: false });

      expect(logger.error).toHaveBeenCalledWith('file-archive must run as a project target.');
    });
  });

  describe('archive', () => {
    it('names entries relative to the folder, forward-slashed', async () => {
      await writeFiles({ 'dist/app/a.txt': 'a', 'dist/app/sub/deep/b.txt': 'b' });

      await fileArchiveExecutor({ source: 'dist/app' }, createContext());

      expect(zipNames('dist/app.zip')).toEqual(['a.txt', 'sub/deep/b.txt']);
    });

    it('writes an uncompressed tar', async () => {
      await writeFiles({ 'dist/app/a.txt': 'hello' });

      await fileArchiveExecutor({ source: 'dist/app', format: 'tar' }, createContext());

      expect(await tarNames('dist/app.tar')).toEqual(['a.txt']);
      expect((await readFile(join(root, 'dist/app.tar'))).subarray(0, 2)).not.toEqual(
        Buffer.from([0x1f, 0x8b])
      );
    });

    it('writes next to the folder by default, so a re-run never contains the old archive', async () => {
      await writeFiles({ 'dist/app/a.txt': 'a' });

      await fileArchiveExecutor({ source: 'dist/app' }, createContext());
      await fileArchiveExecutor({ source: 'dist/app' }, createContext());

      expect(existsSync(join(root, 'dist/app/app.zip'))).toBe(false);
      expect(zipNames('dist/app.zip')).toEqual(['a.txt']);
    });

    it('honours destination and filename, creating the destination folder', async () => {
      await writeFiles({ 'dist/app/a.txt': 'a' });

      await fileArchiveExecutor(
        { source: 'dist/app', destination: 'artifacts/out', filename: 'site.zip' },
        createContext()
      );

      expect(zipNames('artifacts/out/site.zip')).toEqual(['a.txt']);
    });

    it('leaves its own output out of the archive when destination is inside the folder', async () => {
      await writeFiles({ 'dist/app/a.txt': 'a' });
      const options = { source: 'dist/app', destination: 'dist/app' };

      await fileArchiveExecutor(options, createContext());
      await fileArchiveExecutor(options, createContext());

      expect(zipNames('dist/app/app.zip')).toEqual(['a.txt']);
    });
  });
});
