import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { listFiles } from './list-files.util';

describe('listFiles', () => {
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'list-files-'));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('lists nested files relative to the folder, forward-slashed and sorted', async () => {
    for (const path of ['b.txt', 'sub/deep/c.txt', 'a.txt']) {
      await mkdir(dirname(join(folder, path)), { recursive: true });
      await writeFile(join(folder, path), path);
    }

    expect(listFiles(folder)).toEqual(['a.txt', 'b.txt', 'sub/deep/c.txt']);
  });

  it('leaves directories out, including empty ones', async () => {
    await mkdir(join(folder, 'empty/nested'), { recursive: true });

    expect(listFiles(folder)).toEqual([]);
  });
});
