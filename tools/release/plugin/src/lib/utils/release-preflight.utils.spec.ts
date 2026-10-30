import { gitBranchExists } from '@cybertecpty/git-utils';
import type { VersionData } from '@cybertecpty/nx-types';
import { logger } from '@nx/devkit';
import type { SimpleGit } from 'simple-git';

import { assertBaseIncludesTarget, assertReleaseTagsAvailable } from './release-preflight.utils';

jest.mock('@cybertecpty/git-utils', () => ({
  gitBranchExists: jest.fn()
}));

const mockGitBranchExists = jest.mocked(gitBranchExists);

interface GitSpies {
  fetch: jest.Mock;
  raw: jest.Mock;
}

const versionData = (newVersion: string | null): VersionData => ({
  'pkg-a': { currentVersion: '1.0.0', newVersion, dependentProjects: [] }
});

describe('assertBaseIncludesTarget', () => {
  let git: GitSpies;
  const run = (dryRun = false) =>
    assertBaseIncludesTarget(
      { baseBranch: 'develop', dryRun, targetBranch: 'main' },
      git as unknown as SimpleGit
    );

  beforeEach(() => {
    git = { fetch: jest.fn().mockResolvedValue(undefined), raw: jest.fn() };
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes when the base already has everything on the target', async () => {
    git.raw.mockResolvedValue('0\n');

    await expect(run()).resolves.toBeUndefined();

    expect(git.fetch).toHaveBeenCalledWith(['origin', 'develop', 'main', '--tags']);
    expect(git.raw).toHaveBeenCalledWith(['rev-list', '--count', 'origin/develop..origin/main']);
  });

  it('fails and tells the user to back-merge when the target is ahead', async () => {
    git.raw.mockResolvedValue('3\n');

    await expect(run()).rejects.toThrow(/Back-merge main into develop/);
  });

  it('fails rather than passing when git output is not a count', async () => {
    git.raw.mockResolvedValue('fatal: nonsense');

    await expect(run()).rejects.toThrow(/unexpected git output/);
  });

  it('only warns in a dry run', async () => {
    git.raw.mockResolvedValue('3\n');

    await expect(run(true)).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Back-merge main'));
  });
});

describe('assertReleaseTagsAvailable', () => {
  let git: GitSpies;
  const run = (data: VersionData) =>
    assertReleaseTagsAvailable(data, 'release/2026-09-11', git as unknown as SimpleGit);

  /** Resolves `rev-list` to `tagCommit` (or rejects when `null`), and `--is-ancestor` to `onBranch`. */
  const givenTag = (tagCommit: string | null, onBranch: boolean) => {
    git.raw.mockImplementation((args: string[]) => {
      if (args[0] === 'rev-list') {
        return tagCommit === null
          ? Promise.reject(new Error('unknown revision'))
          : Promise.resolve(`${tagCommit}\n`);
      }

      return onBranch ? Promise.resolve('') : Promise.reject(new Error('exit 1'));
    });
  };

  beforeEach(() => {
    git = { fetch: jest.fn(), raw: jest.fn() };
    mockGitBranchExists.mockResolvedValue(false);
  });

  it('passes when the tag does not exist', async () => {
    givenTag(null, false);

    await expect(run(versionData('1.1.0'))).resolves.toBeUndefined();
  });

  it('ignores projects without a new version', async () => {
    givenTag('abc1234567890', false);

    await expect(run(versionData(null))).resolves.toBeUndefined();
    expect(git.raw).not.toHaveBeenCalled();
  });

  it('fails, naming the tag, when it exists and the release branch does not', async () => {
    givenTag('abc1234567890', false);

    await expect(run(versionData('1.1.0'))).rejects.toThrow('pkg-a@1.1.0');
  });

  it('fails when the tag is on a commit outside the existing release branch', async () => {
    mockGitBranchExists.mockResolvedValue(true);
    givenTag('abc1234567890', false);

    await expect(run(versionData('1.1.0'))).rejects.toThrow('pkg-a@1.1.0');
  });

  it('passes on a same-day re-run, where the tag is on the release branch', async () => {
    mockGitBranchExists.mockResolvedValue(true);
    givenTag('abc1234567890', true);

    await expect(run(versionData('1.1.0'))).resolves.toBeUndefined();
    expect(git.raw).toHaveBeenCalledWith([
      'merge-base',
      '--is-ancestor',
      'abc1234567890',
      'release/2026-09-11'
    ]);
  });
});
