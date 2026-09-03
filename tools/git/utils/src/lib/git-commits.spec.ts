import type { SimpleGit } from 'simple-git';

import { gitCommitsBetween, lastGitCommitHash } from './git-commits';

const fakeGit = (overrides: Record<string, unknown>): SimpleGit =>
  overrides as unknown as SimpleGit;

describe('gitCommitsBetween', () => {
  it('requests an asymmetric --no-merges range parsed with --name-status', async () => {
    const log = jest.fn(() => Promise.resolve({ all: [] }));

    await gitCommitsBetween('base', 'head', fakeGit({ log }));

    expect(log).toHaveBeenCalledWith({
      from: 'base',
      to: 'head',
      symmetric: false,
      '--no-merges': null,
      '--name-status': null
    });
  });

  it('maps each entry to its hash, message, and touched file paths', async () => {
    const git = fakeGit({
      log: () =>
        Promise.resolve({
          all: [
            {
              hash: 'abc123',
              message: 'feat: thing',
              diff: { files: [{ file: 'src/a.ts' }, { file: 'src/b.ts' }] }
            }
          ]
        })
    });

    await expect(gitCommitsBetween('base', 'head', git)).resolves.toEqual([
      { hash: 'abc123', message: 'feat: thing', files: ['src/a.ts', 'src/b.ts'] }
    ]);
  });

  it('yields an empty file list when an entry carries no diff', async () => {
    const git = fakeGit({
      log: () =>
        Promise.resolve({
          all: [{ hash: 'abc123', message: 'chore: merge', diff: undefined }]
        })
    });

    await expect(gitCommitsBetween('base', 'head', git)).resolves.toEqual([
      { hash: 'abc123', message: 'chore: merge', files: [] }
    ]);
  });
});

describe('lastGitCommitHash', () => {
  it('rev-parses HEAD and trims the result', async () => {
    const revparse = jest.fn(() => Promise.resolve('deadbeef\n'));

    await expect(lastGitCommitHash({}, fakeGit({ revparse }))).resolves.toBe('deadbeef');
    expect(revparse).toHaveBeenCalledWith(['HEAD']);
  });

  it('passes --short when a length is requested', async () => {
    const revparse = jest.fn(() => Promise.resolve('deadbee'));

    await lastGitCommitHash({ length: 7 }, fakeGit({ revparse }));

    expect(revparse).toHaveBeenCalledWith(['--short=7', 'HEAD']);
  });
});
