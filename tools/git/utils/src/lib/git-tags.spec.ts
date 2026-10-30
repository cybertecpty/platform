import simpleGit, { type SimpleGit } from 'simple-git';

import { gitTagsMatching } from './git-tags';

jest.mock('simple-git', () => ({ __esModule: true, default: jest.fn() }));

const mockSimpleGit = jest.mocked(simpleGit);

const fakeGit = (all: string[]): SimpleGit =>
  ({ tags: () => Promise.resolve({ all }) }) as unknown as SimpleGit;

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
