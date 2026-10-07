import { logger, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import AdmZip from 'adm-zip';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as tar from 'tar';
import { fileArchiveGenerator } from './generator';
import type { FileArchiveGeneratorOptions } from './schema';

const extractZipEntries = (buffer: Buffer): Record<string, string> =>
  Object.fromEntries(
    new AdmZip(buffer)
      .getEntries()
      .map(entry => [entry.entryName, entry.getData().toString('utf-8')])
  );

const listTarEntryNames = async (buffer: Buffer): Promise<string[]> => {
  const dir = await mkdtemp(join(tmpdir(), 'file-archive-generator-'));

  try {
    const archivePath = join(dir, 'archive.tar');
    await writeFile(archivePath, buffer);

    const names: string[] = [];
    await tar.t({ file: archivePath, onentry: entry => names.push(entry.path) });

    return names;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const isGzipped = (buffer: Buffer): boolean =>
  buffer.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b]));

function run(
  tree: Tree,
  options: Partial<FileArchiveGeneratorOptions> & { source: string }
): Promise<string> {
  return fileArchiveGenerator(tree, options);
}

describe('fileArchiveGenerator', () => {
  let tree: Tree;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    tree.write('dist/web/index.html', '<html></html>');
    tree.write('dist/web/assets/logo.svg', '<svg></svg>');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('output location', () => {
    it('defaults the archive into the source directory as `<basename>.zip`', async () => {
      const archivePath = await run(tree, { source: 'dist/web' });

      expect(archivePath).toBe('dist/web/web.zip');
      expect(tree.exists(archivePath)).toBe(true);
    });

    it('honours an explicit `destination`', async () => {
      const archivePath = await run(tree, { source: 'dist/web', destination: 'dist/archives' });

      expect(archivePath).toBe('dist/archives/web.zip');
      expect(tree.exists(archivePath)).toBe(true);
    });

    it('honours an explicit `filename`', async () => {
      const archivePath = await run(tree, { source: 'dist/web', filename: 'build.zip' });

      expect(archivePath).toBe('dist/web/build.zip');
      expect(tree.exists(archivePath)).toBe(true);
    });

    it('normalizes an OS-native (backslash) `source` before computing entry names', async () => {
      const archivePath = await run(tree, { source: 'dist\\web' });

      expect(archivePath).toBe('dist/web/web.zip');
      expect(extractZipEntries(tree.read(archivePath) as Buffer)).toEqual({
        'index.html': '<html></html>',
        'assets/logo.svg': '<svg></svg>'
      });
    });
  });

  describe('archive contents', () => {
    it('includes every file under source, preserving nested structure', async () => {
      const archivePath = await run(tree, { source: 'dist/web' });

      expect(extractZipEntries(tree.read(archivePath) as Buffer)).toEqual({
        'index.html': '<html></html>',
        'assets/logo.svg': '<svg></svg>'
      });
    });

    it('produces an uncompressed tar for `format: tar`', async () => {
      const archivePath = await run(tree, { source: 'dist/web', format: 'tar' });

      expect(archivePath).toBe('dist/web/web.tar');
      const buffer = tree.read(archivePath) as Buffer;
      expect(isGzipped(buffer)).toBe(false);
      expect(await listTarEntryNames(buffer)).toEqual(
        expect.arrayContaining(['index.html', 'assets/logo.svg'])
      );
    });
  });

  describe('guard conditions', () => {
    it('warns and skips when the source directory has no files', async () => {
      tree.delete('dist/web/index.html');
      tree.delete('dist/web/assets/logo.svg');

      const archivePath = await run(tree, { source: 'dist/web' });

      expect(tree.exists(archivePath)).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('No files found'));
    });

    it('warns and leaves an existing archive untouched without `--overwrite`', async () => {
      tree.write('dist/web/web.zip', 'stale archive bytes');

      const archivePath = await run(tree, { source: 'dist/web' });

      expect(tree.read(archivePath, 'utf-8')).toBe('stale archive bytes');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    });

    it('replaces an existing archive when `--overwrite` is set', async () => {
      tree.write('dist/web/web.zip', 'stale archive bytes');

      const archivePath = await run(tree, { source: 'dist/web', overwrite: true });

      expect(tree.read(archivePath, 'utf-8')).not.toBe('stale archive bytes');
      expect(extractZipEntries(tree.read(archivePath) as Buffer)).toEqual({
        'index.html': '<html></html>',
        'assets/logo.svg': '<svg></svg>'
      });
    });

    it('reports "already exists" rather than "no files found" when the only file under source is the archive itself', async () => {
      tree.delete('dist/web/index.html');
      tree.delete('dist/web/assets/logo.svg');
      tree.write('dist/web/web.zip', 'stale archive bytes');

      const archivePath = await run(tree, { source: 'dist/web' });

      expect(tree.read(archivePath, 'utf-8')).toBe('stale archive bytes');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('already exists'));
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('No files found'));
    });
  });
});
