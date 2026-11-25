import { createGitRepoFixture, type GitRepoFixture } from '@cybertecpty/git-testing';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  gitBranchExists,
  gitCurrentBranch,
  isCleanGitBranch,
  isCurrentGitBranch
} from './git-branches';

let repo: GitRepoFixture;

beforeEach(async () => {
  repo = await createGitRepoFixture();
  await repo.commit('first');
});

afterEach(() => {
  repo.cleanup();
});

describe('git-branches', () => {
  describe('gitBranchExists', () => {
    it('is true for a local branch', async () => {
      await repo.git.branch(['feature/x']);

      await expect(gitBranchExists('feature/x', repo.git)).resolves.toBe(true);
    });

    it('is false for a branch that does not exist', async () => {
      await expect(gitBranchExists('feature/x', repo.git)).resolves.toBe(false);
    });

    it('is false for a name that only exists as a tag', async () => {
      await repo.git.raw(['tag', 'feature/x']);

      await expect(gitBranchExists('feature/x', repo.git)).resolves.toBe(false);
    });
  });

  describe('gitCurrentBranch', () => {
    it('returns the checked-out branch name', async () => {
      await expect(gitCurrentBranch(repo.git)).resolves.toBe('main');

      await repo.git.checkoutLocalBranch('feature/x');

      await expect(gitCurrentBranch(repo.git)).resolves.toBe('feature/x');
    });

    it('returns an empty string in a detached HEAD', async () => {
      await repo.git.checkout(['--detach']);

      await expect(gitCurrentBranch(repo.git)).resolves.toBe('');
    });
  });

  describe('isCleanGitBranch', () => {
    it('is true for a tree with nothing to commit', async () => {
      await expect(isCleanGitBranch(repo.git)).resolves.toBe(true);
    });

    it('is false for an untracked file', async () => {
      writeFileSync(join(repo.dir, 'a.txt'), 'a');

      await expect(isCleanGitBranch(repo.git)).resolves.toBe(false);
    });

    it('is false for a staged change', async () => {
      writeFileSync(join(repo.dir, 'a.txt'), 'a');
      await repo.git.add('a.txt');

      await expect(isCleanGitBranch(repo.git)).resolves.toBe(false);
    });

    it('is false for a modified tracked file', async () => {
      writeFileSync(join(repo.dir, 'a.txt'), 'a');
      await repo.git.add('a.txt');
      await repo.git.commit('add a');
      writeFileSync(join(repo.dir, 'a.txt'), 'changed');

      await expect(isCleanGitBranch(repo.git)).resolves.toBe(false);
    });
  });

  describe('isCurrentGitBranch', () => {
    it('compares the argument against the checked-out branch', async () => {
      await expect(isCurrentGitBranch('main', repo.git)).resolves.toBe(true);
      await expect(isCurrentGitBranch('develop', repo.git)).resolves.toBe(false);
    });

    it('is false for a commit hash in a detached HEAD', async () => {
      await repo.git.checkout(['--detach']);
      const head = (await repo.git.revparse(['HEAD'])).trim();

      await expect(isCurrentGitBranch(head, repo.git)).resolves.toBe(false);
      await expect(isCurrentGitBranch('main', repo.git)).resolves.toBe(false);
    });
  });

  describe('default git client', () => {
    let originalCwd: string;

    beforeEach(() => {
      originalCwd = process.cwd();
      process.chdir(repo.dir);
    });

    afterEach(() => {
      process.chdir(originalCwd);
    });

    it('works on the repository in the current directory when no client is passed', async () => {
      await expect(gitBranchExists('main')).resolves.toBe(true);
      await expect(gitCurrentBranch()).resolves.toBe('main');
      await expect(isCleanGitBranch()).resolves.toBe(true);
      await expect(isCurrentGitBranch('main')).resolves.toBe(true);
    });
  });
});
