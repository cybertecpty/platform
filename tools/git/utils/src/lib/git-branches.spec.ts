import type { SimpleGit } from 'simple-git';

import {
  gitBranchExists,
  gitCurrentBranch,
  isCleanGitBranch,
  isCurrentGitBranch
} from './git-branches';

const fakeGit = (overrides: Record<string, unknown>): SimpleGit =>
  overrides as unknown as SimpleGit;

const withBranches = (all: string[], current = all[0] ?? '') =>
  fakeGit({ branchLocal: () => Promise.resolve({ all, current }) });

describe('gitBranchExists', () => {
  it('is true when the local branch list contains the name', async () => {
    await expect(
      gitBranchExists('feature/x', withBranches(['develop', 'feature/x']))
    ).resolves.toBe(true);
  });

  it('is false when the name is absent from the local branch list', async () => {
    await expect(gitBranchExists('feature/x', withBranches(['develop']))).resolves.toBe(false);
  });
});

describe('gitCurrentBranch', () => {
  it('returns the checked-out branch name', async () => {
    await expect(gitCurrentBranch(withBranches(['develop'], 'develop'))).resolves.toBe('develop');
  });
});

describe('isCleanGitBranch', () => {
  it('reflects the status summary isClean() result', async () => {
    const git = (clean: boolean) =>
      fakeGit({ status: () => Promise.resolve({ isClean: () => clean }) });

    await expect(isCleanGitBranch(git(true))).resolves.toBe(true);
    await expect(isCleanGitBranch(git(false))).resolves.toBe(false);
  });
});

describe('isCurrentGitBranch', () => {
  it('compares the argument against the current branch', async () => {
    const git = withBranches(['develop'], 'develop');

    await expect(isCurrentGitBranch('develop', git)).resolves.toBe(true);
    await expect(isCurrentGitBranch('main', git)).resolves.toBe(false);
  });
});
