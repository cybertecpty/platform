import { gitBranchExists, gitCurrentBranch, isCleanGitBranch } from '@cybertecpty/git-utils';
import { logger } from '@nx/devkit';
import { simpleGit, type SimpleGit } from 'simple-git';

import {
  checkoutReleaseBranch,
  resolveReleaseBranchName,
  type ReleaseBranchOptions
} from './release-branch.utils';

jest.mock('@cybertecpty/git-utils', () => ({
  gitBranchExists: jest.fn(),
  gitCurrentBranch: jest.fn(),
  isCleanGitBranch: jest.fn()
}));

jest.mock('simple-git', () => ({
  __esModule: true,
  simpleGit: jest.fn(),
  default: jest.fn()
}));

const mockBranchExists = jest.mocked(gitBranchExists);
const mockCurrentBranch = jest.mocked(gitCurrentBranch);
const mockIsClean = jest.mocked(isCleanGitBranch);
const mockSimpleGit = jest.mocked(simpleGit);

type GitSpies = {
  checkout: jest.Mock;
  pull: jest.Mock;
  checkoutLocalBranch: jest.Mock;
};

/** A git double exposing only the mutating calls `checkoutReleaseBranch` makes directly. */
const makeGit = (): { git: SimpleGit; spies: GitSpies } => {
  const spies: GitSpies = {
    checkout: jest.fn(() => Promise.resolve()),
    pull: jest.fn(() => Promise.resolve()),
    checkoutLocalBranch: jest.fn(() => Promise.resolve())
  };

  return { git: spies as unknown as SimpleGit, spies };
};

const opts = (over: Partial<ReleaseBranchOptions> = {}): ReleaseBranchOptions => ({
  baseBranch: 'develop',
  releaseDate: '2026-09-09T12:34:56.000Z',
  skipBranch: false,
  ...over
});

describe('resolveReleaseBranchName', () => {
  it('names the branch after the date part of the release date', () => {
    expect(resolveReleaseBranchName(opts())).toBe('release/2026-09-09');
    expect(resolveReleaseBranchName(opts({ releaseDate: '2026-12-01T00:00:00.000Z' }))).toBe(
      'release/2026-12-01'
    );
  });

  it('is the base branch itself when branch creation is skipped', () => {
    expect(resolveReleaseBranchName(opts({ skipBranch: true }))).toBe('develop');
    expect(resolveReleaseBranchName(opts({ skipBranch: true, baseBranch: 'main' }))).toBe('main');
  });
});

describe('checkoutReleaseBranch', () => {
  beforeEach(() => {
    mockBranchExists.mockReset().mockResolvedValue(false);
    mockCurrentBranch.mockReset().mockResolvedValue('feature/x');
    mockIsClean.mockReset().mockResolvedValue(true);
    mockSimpleGit.mockReset();
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects without touching the tree when the working directory is dirty', async () => {
    mockIsClean.mockResolvedValue(false);
    const { git, spies } = makeGit();

    await expect(checkoutReleaseBranch(opts(), git)).rejects.toThrow(
      'Working directory is not clean'
    );
    expect(spies.checkout).not.toHaveBeenCalled();
    expect(spies.checkoutLocalBranch).not.toHaveBeenCalled();
  });

  describe('skipBranch', () => {
    it('checks out the base branch and reports the branch to restore', async () => {
      mockCurrentBranch.mockResolvedValue('feature/x');
      const { git, spies } = makeGit();

      await expect(checkoutReleaseBranch(opts({ skipBranch: true }), git)).resolves.toEqual({
        releaseBranch: 'develop',
        restoreBranch: 'feature/x'
      });
      expect(spies.checkout).toHaveBeenCalledWith('develop');
    });

    it('stays put when already on the base branch', async () => {
      mockCurrentBranch.mockResolvedValue('develop');
      const { git, spies } = makeGit();

      await expect(checkoutReleaseBranch(opts({ skipBranch: true }), git)).resolves.toEqual({
        releaseBranch: 'develop',
        restoreBranch: null
      });
      expect(spies.checkout).not.toHaveBeenCalled();
    });

    it('warns that the release will land on the base branch', async () => {
      await checkoutReleaseBranch(opts({ skipBranch: true }), makeGit().git);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping release branch creation')
      );
    });
  });

  describe('an existing release branch', () => {
    beforeEach(() => {
      mockBranchExists.mockResolvedValue(true);
    });

    it('is checked out as-is, without refreshing from the base branch', async () => {
      mockCurrentBranch.mockResolvedValue('feature/x');
      const { git, spies } = makeGit();

      await expect(checkoutReleaseBranch(opts(), git)).resolves.toEqual({
        releaseBranch: 'release/2026-09-09',
        restoreBranch: 'feature/x'
      });
      expect(spies.checkout).toHaveBeenCalledWith('release/2026-09-09');
      expect(spies.pull).not.toHaveBeenCalled();
      expect(spies.checkoutLocalBranch).not.toHaveBeenCalled();
    });

    it('is left alone when it is already HEAD', async () => {
      mockCurrentBranch.mockResolvedValue('release/2026-09-09');
      const { git, spies } = makeGit();

      await expect(checkoutReleaseBranch(opts(), git)).resolves.toEqual({
        releaseBranch: 'release/2026-09-09',
        restoreBranch: null
      });
      expect(spies.checkout).not.toHaveBeenCalled();
    });

    it('reports no branch to restore from a detached HEAD', async () => {
      mockCurrentBranch.mockResolvedValue('');
      const { git } = makeGit();

      await expect(checkoutReleaseBranch(opts(), git)).resolves.toEqual({
        releaseBranch: 'release/2026-09-09',
        restoreBranch: null
      });
    });
  });

  describe('a new release branch', () => {
    it('refreshes the base branch from origin, then cuts the release branch', async () => {
      const { git, spies } = makeGit();
      const calls: string[] = [];
      spies.checkout.mockImplementation((branch: string) => {
        calls.push(`checkout:${branch}`);
        return Promise.resolve();
      });
      spies.pull.mockImplementation((remote: string, branch: string) => {
        calls.push(`pull:${remote}/${branch}`);
        return Promise.resolve();
      });
      spies.checkoutLocalBranch.mockImplementation((branch: string) => {
        calls.push(`checkoutLocalBranch:${branch}`);
        return Promise.resolve();
      });

      await expect(checkoutReleaseBranch(opts(), git)).resolves.toEqual({
        releaseBranch: 'release/2026-09-09',
        restoreBranch: 'feature/x'
      });
      expect(calls).toEqual([
        'checkout:develop',
        'pull:origin/develop',
        'checkoutLocalBranch:release/2026-09-09'
      ]);
    });
  });

  describe('default git client', () => {
    it('falls back to simpleGit() when no client is passed', async () => {
      const { git } = makeGit();
      mockSimpleGit.mockReturnValue(git);
      mockBranchExists.mockResolvedValue(true);
      mockCurrentBranch.mockResolvedValue('release/2026-09-09');

      await checkoutReleaseBranch(opts());

      expect(mockSimpleGit).toHaveBeenCalledTimes(1);
    });
  });
});
