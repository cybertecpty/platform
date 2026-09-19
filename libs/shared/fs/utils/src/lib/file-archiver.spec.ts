import AdmZip from 'adm-zip';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import * as tar from 'tar';

import { FileArchiveSource, FileBufferArchiver, FileStreamArchiver } from './file-archiver';

const readableToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];

  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

const extractZipEntries = (buffer: Buffer): Record<string, string> =>
  Object.fromEntries(
    new AdmZip(buffer)
      .getEntries()
      .map(entry => [entry.entryName, entry.getData().toString('utf-8')])
  );

// Both tar helpers below need the same scaffolding (write the buffer to a temp file,
// run a `tar` command against it, clean up) and differ only in that command — shared
// here so temp-dir handling only has to be gotten right in one place.
const withTarFile = async <T>(
  buffer: Buffer,
  run: (archivePath: string, dir: string) => Promise<T>
): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'file-archiver-'));

  try {
    const archivePath = join(dir, 'archive.tar');

    await writeFile(archivePath, buffer);

    return await run(archivePath, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const listTarEntryNames = (buffer: Buffer): Promise<string[]> =>
  withTarFile(buffer, async archivePath => {
    const names: string[] = [];

    await tar.t({ file: archivePath, onentry: entry => names.push(entry.path) });

    return names;
  });

const extractTarEntries = (
  buffer: Buffer,
  names: readonly string[]
): Promise<Record<string, string>> =>
  withTarFile(buffer, async (archivePath, dir) => {
    await tar.x({ file: archivePath, cwd: dir });

    const entries = await Promise.all(
      names.map(async name => [name, await readFile(join(dir, name), 'utf-8')] as const)
    );

    return Object.fromEntries(entries);
  });

const erroringReadable = (message: string): Readable =>
  new Readable({
    read() {
      process.nextTick(() => this.destroy(new Error(message)));
    }
  });

const helloSource: FileArchiveSource = { name: 'hello.txt', content: 'hello world' };
const unicodeSource: FileArchiveSource = { name: 'unicode.txt', content: 'héllo wörld 🌍' };
const bufferSource: FileArchiveSource = {
  name: 'buffer.txt',
  content: Buffer.from('from a buffer')
};
// A Readable is single-use, so each test needing one gets a fresh instance rather than
// sharing a module-level source (a stream already drained by an earlier test reads empty).
const streamSource = (): FileArchiveSource => ({
  name: 'stream.txt',
  content: Readable.from(['from a stream'])
});

describe('FileBufferArchiver', () => {
  it('zips string, buffer, and stream sources into a single archive', async () => {
    const archiver = new FileBufferArchiver(helloSource, bufferSource, streamSource());

    const buffer = await archiver.zip();

    expect(extractZipEntries(buffer)).toEqual({
      'hello.txt': 'hello world',
      'buffer.txt': 'from a buffer',
      'stream.txt': 'from a stream'
    });
  });

  it('preserves non-ASCII string content as UTF-8', async () => {
    const buffer = await new FileBufferArchiver(unicodeSource).zip();

    expect(extractZipEntries(buffer)).toEqual({ 'unicode.txt': 'héllo wörld 🌍' });
  });

  it('gzips tar archives by default', async () => {
    const buffer = await new FileBufferArchiver(helloSource).tar();

    expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
    await expect(extractTarEntries(buffer, ['hello.txt'])).resolves.toEqual({
      'hello.txt': 'hello world'
    });
  });

  it('produces a plain tar when gzip is overridden off', async () => {
    const buffer = await new FileBufferArchiver(helloSource).tar({ gzip: false });

    expect(buffer.subarray(0, 2)).not.toEqual(Buffer.from([0x1f, 0x8b]));
    await expect(extractTarEntries(buffer, ['hello.txt'])).resolves.toEqual({
      'hello.txt': 'hello world'
    });
  });

  it('supports the lower-level archive() call directly', async () => {
    const buffer = await new FileBufferArchiver(helloSource).archive('zip');

    expect(extractZipEntries(buffer)).toEqual({ 'hello.txt': 'hello world' });
  });

  it('accumulates sources added via chained addSources() calls', async () => {
    const archiver = new FileBufferArchiver().addSources(helloSource).addSources(bufferSource);

    const buffer = await archiver.zip();

    expect(extractZipEntries(buffer)).toEqual({
      'hello.txt': 'hello world',
      'buffer.txt': 'from a buffer'
    });
  });

  it('reuses the same instance to archive its string/Buffer sources in more than one format', async () => {
    const archiver = new FileBufferArchiver(helloSource);

    const zipBuffer = await archiver.zip();
    const tarBuffer = await archiver.tar();

    expect(extractZipEntries(zipBuffer)).toEqual({ 'hello.txt': 'hello world' });
    await expect(extractTarEntries(tarBuffer, ['hello.txt'])).resolves.toEqual({
      'hello.txt': 'hello world'
    });
  });

  it('rejects re-archiving an instance whose stream source was already consumed', async () => {
    const archiver = new FileBufferArchiver(streamSource());

    await archiver.zip();

    await expect(archiver.tar()).rejects.toThrow(/already been consumed/);
  });

  it('does not deduplicate sources sharing the same name', async () => {
    // Verified via tar, not zip: zip permits duplicate entry names too, but adm-zip (a
    // reader, not this lib) refuses to open a zip containing one — tar listing sidesteps
    // that reader limitation while still exercising the same shared archive-building path.
    const buffer = await new FileBufferArchiver(
      { name: 'dup.txt', content: 'first' },
      { name: 'dup.txt', content: 'second' }
    ).tar();

    expect((await listTarEntryNames(buffer)).filter(name => name === 'dup.txt')).toHaveLength(2);
  });

  it('produces a valid, empty archive when no sources were added', async () => {
    const buffer = await new FileBufferArchiver().zip();

    expect(new AdmZip(buffer).getEntries()).toHaveLength(0);
  });

  it('rejects with a cause-preserving error when a source fails to read', async () => {
    const archiver = new FileBufferArchiver({
      name: 'broken.txt',
      content: erroringReadable('source broke')
    });

    await expect(archiver.zip()).rejects.toMatchObject({
      message: 'Archiver error',
      cause: expect.objectContaining({ message: 'source broke' })
    });
  });
});

describe('FileStreamArchiver', () => {
  it('zips string, buffer, and stream sources into a single archive', async () => {
    const archiver = new FileStreamArchiver(helloSource, bufferSource, streamSource());

    const buffer = await readableToBuffer(await archiver.zip());

    expect(extractZipEntries(buffer)).toEqual({
      'hello.txt': 'hello world',
      'buffer.txt': 'from a buffer',
      'stream.txt': 'from a stream'
    });
  });

  it('gzips tar archives by default', async () => {
    const buffer = await readableToBuffer(await new FileStreamArchiver(helloSource).tar());

    expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
    await expect(extractTarEntries(buffer, ['hello.txt'])).resolves.toEqual({
      'hello.txt': 'hello world'
    });
  });

  it('produces a plain tar when gzip is overridden off', async () => {
    const buffer = await readableToBuffer(
      await new FileStreamArchiver(helloSource).tar({ gzip: false })
    );

    expect(buffer.subarray(0, 2)).not.toEqual(Buffer.from([0x1f, 0x8b]));
    await expect(extractTarEntries(buffer, ['hello.txt'])).resolves.toEqual({
      'hello.txt': 'hello world'
    });
  });

  it('supports the lower-level archive() call directly', async () => {
    const buffer = await readableToBuffer(await new FileStreamArchiver(helloSource).archive('zip'));

    expect(extractZipEntries(buffer)).toEqual({ 'hello.txt': 'hello world' });
  });

  it('produces a valid, empty archive when no sources were added', async () => {
    const buffer = await readableToBuffer(await new FileStreamArchiver().zip());

    expect(new AdmZip(buffer).getEntries()).toHaveLength(0);
  });

  it('rejects re-archiving an instance whose stream source was already consumed', async () => {
    const archiver = new FileStreamArchiver(streamSource());

    await readableToBuffer(await archiver.zip());

    await expect(archiver.tar()).rejects.toThrow(/already been consumed/);
  });

  it('emits an error on the returned stream when a source fails to read, without an unhandled rejection', async () => {
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };

    process.on('unhandledRejection', onUnhandledRejection);

    try {
      const archiver = new FileStreamArchiver({
        name: 'broken.txt',
        content: erroringReadable('source broke')
      });
      const stream = await archiver.zip();

      await expect(readableToBuffer(stream)).rejects.toMatchObject({
        message: 'Archiver error',
        cause: expect.objectContaining({ message: 'source broke' })
      });

      // Give a previously-unhandled `finalize()` rejection a chance to surface.
      await new Promise(resolve => process.nextTick(resolve));

      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });
});
