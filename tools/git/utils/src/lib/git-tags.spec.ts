import simpleGit, { type SimpleGit } from 'simple-git';

import { gitTagCommit, gitTagsMatching } from './git-tags';

jest.mock('simple-git', () => ({ __esModule: true, default: jest.fn() }));

const mockSimpleGit = jest.mocked(simpleGit);

const fakeGit = (all: string[]): SimpleGit =>
  ({ tags: () => Promise.resolve({ all }) }) as unknown as SimpleGit;

describe('gitTagCommit', () => {
  const fakeRawGit = (raw: jest.Mock): SimpleGit => ({ raw }) as unknown as SimpleGit;

  it('returns the commit the tag points at', async () => {
    const raw = jest.fn().mockResolvedValueOnce('app@1.0.0\n').mockResolvedValueOnce('abc123\n');

    await expect(gitTagCommit('app@1.0.0', fakeRawGit(raw))).resolves.toBe('abc123');
    expect(raw).toHaveBeenLastCalledWith(['rev-list', '-n', '1', 'refs/tags/app@1.0.0']);
  });

  it('returns null when the tag does not exist', async () => {
    const raw = jest.fn().mockResolvedValue('');

    await expect(gitTagCommit('app@1.0.0', fakeRawGit(raw))).resolves.toBeNull();
    expect(raw).toHaveBeenCalledTimes(1);
  });

  it('rethrows a git failure instead of reporting a missing tag', async () => {
    const raw = jest
      .fn()
      .mockResolvedValueOnce('app@1.0.0\n')
      .mockRejectedValueOnce(new Error('fatal: corrupt'));

    await expect(gitTagCommit('app@1.0.0', fakeRawGit(raw))).rejects.toThrow('fatal: corrupt');
  });
});

describe('gitTagsMatching', () => {
  it('keeps only the tags that contain the given substring', async () => {
    const git = fakeGit(['v1.0.0', 'v1.0.0-rc.1', 'v2.0.0']);

    await expect(gitTagsMatching('1.0.0', git)).resolves.toEqual(['v1.0.0', 'v1.0.0-rc.1']);
  });

  it('returns an empty array when nothing matches', async () => {
    await expect(gitTagsMatching('9.9.9', fakeGit(['v1.0.0']))).resolves.toEqual([]);
  });

  it('falls back to simpleGit() when no client is passed', async () => {
    mockSimpleGit.mockReturnValue(fakeGit(['v1.0.0', 'v2.0.0']));

    await expect(gitTagsMatching('1.0.0')).resolves.toEqual(['v1.0.0']);
    expect(mockSimpleGit).toHaveBeenCalledTimes(1);

    mockSimpleGit.mockReset();
  });
});
