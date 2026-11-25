import {
  cloneGitRepoFixture,
  createGitRepoFixture,
  type GitRepoFixture
} from '@cybertecpty/git-testing';
import { logger } from '@nx/devkit';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import {
  checkoutReleaseBranch,
  resolveReleaseBranchName,
  type ReleaseBranchOptions
} from './release-branch';

const opts = (over: Partial<ReleaseBranchOptions> = {}): ReleaseBranchOptions => ({
  baseBranch: 'main',
  releaseDate: '2026-09-09T12:34:56.000Z',
  skipBranch: false,
  ...over
});

describe('release-branch', () => {
  describe('resolveReleaseBranchName', () => {
    it('names the branch after the date part of the release date', () => {
      expect(resolveReleaseBranchName(opts())).toBe('release/2026-09-09');
      expect(resolveReleaseBranchName(opts({ releaseDate: '2026-12-01T00:00:00.000Z' }))).toBe(
        'release/2026-12-01'
      );
    });

    it('is the base branch itself when branch creation is skipped', () => {
      expect(resolveReleaseBranchName(opts({ skipBranch: true }))).toBe('main');
      expect(resolveReleaseBranchName(opts({ skipBranch: true, baseBranch: 'develop' }))).toBe(
        'develop'
      );
    });
  });

  describe('checkoutReleaseBranch', () => {
    const RELEASE_BRANCH = 'release/2026-09-09';
    let origin: GitRepoFixture;
    let repo: GitRepoFixture;

    /** The hash a branch points at in the clone. */
    const branchHash = async (branch: string): Promise<string> =>
      (await repo.git.revparse([branch])).trim();

    /** Leaves the clone on a feature branch, as a developer's checkout would be. */
    const checkoutFeatureBranch = async (): Promise<void> => {
      await repo.git.checkoutLocalBranch('feature/x');
    };

    beforeEach(async () => {
      origin = await createGitRepoFixture();
      await origin.commit('first');
      repo = await cloneGitRepoFixture(origin);
      vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      repo.cleanup();
      origin.cleanup();
    });

    it('rejects without touching the tree when the working directory is dirty', async () => {
      await checkoutFeatureBranch();
      writeFileSync(join(repo.dir, 'dirty.txt'), 'dirty');

      await expect(checkoutReleaseBranch(opts(), repo.git)).rejects.toThrow(
        'Working directory is not clean'
      );
      expect((await repo.git.branchLocal()).current).toBe('feature/x');
      expect((await repo.git.branchLocal()).all).not.toContain(RELEASE_BRANCH);
    });

    describe('skipBranch', () => {
      it('checks out the base branch and reports the branch to restore', async () => {
        await checkoutFeatureBranch();

        await expect(checkoutReleaseBranch(opts({ skipBranch: true }), repo.git)).resolves.toEqual({
          created: false,
          releaseBranch: 'main',
          restoreBranch: 'feature/x'
        });
        expect((await repo.git.branchLocal()).current).toBe('main');
      });

      it('stays put when already on the base branch', async () => {
        await expect(checkoutReleaseBranch(opts({ skipBranch: true }), repo.git)).resolves.toEqual({
          created: false,
          releaseBranch: 'main',
          restoreBranch: null
        });
        expect((await repo.git.branchLocal()).current).toBe('main');
      });

      it('warns that the release will land on the base branch', async () => {
        await checkoutReleaseBranch(opts({ skipBranch: true }), repo.git);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Skipping release branch creation')
        );
      });
    });

    describe('an existing release branch', () => {
      beforeEach(async () => {
        await repo.git.checkoutLocalBranch(RELEASE_BRANCH);
        await repo.commit('release work');
      });

      it('is checked out as-is, without refreshing from the base branch', async () => {
        await checkoutFeatureBranch();
        const releaseHash = await branchHash(RELEASE_BRANCH);
        const mainHash = await branchHash('main');
        await origin.commit('origin moves on');

        await expect(checkoutReleaseBranch(opts(), repo.git)).resolves.toEqual({
          created: false,
          releaseBranch: RELEASE_BRANCH,
          restoreBranch: 'feature/x'
        });
        expect((await repo.git.branchLocal()).current).toBe(RELEASE_BRANCH);
        expect(await branchHash(RELEASE_BRANCH)).toBe(releaseHash);
        expect(await branchHash('main')).toBe(mainHash);
      });

      it('is left alone when it is already HEAD', async () => {
        await expect(checkoutReleaseBranch(opts(), repo.git)).resolves.toEqual({
          created: false,
          releaseBranch: RELEASE_BRANCH,
          restoreBranch: null
        });
        expect((await repo.git.branchLocal()).current).toBe(RELEASE_BRANCH);
      });

      it('reports no branch to restore from a detached HEAD', async () => {
        await repo.git.checkout(['--detach']);

        await expect(checkoutReleaseBranch(opts(), repo.git)).resolves.toEqual({
          created: false,
          releaseBranch: RELEASE_BRANCH,
          restoreBranch: null
        });
        expect((await repo.git.branchLocal()).current).toBe(RELEASE_BRANCH);
      });
    });

    describe('a new release branch', () => {
      it('cuts the release branch from the base branch as it is on origin', async () => {
        await checkoutFeatureBranch();
        const latest = await origin.commit('origin moves on');

        await expect(checkoutReleaseBranch(opts(), repo.git)).resolves.toEqual({
          created: true,
          releaseBranch: RELEASE_BRANCH,
          restoreBranch: 'feature/x'
        });
        expect((await repo.git.branchLocal()).current).toBe(RELEASE_BRANCH);
        expect(await branchHash(RELEASE_BRANCH)).toBe(latest);
        expect(await branchHash('main')).toBe(latest);
      });

      it('does not cut from the feature branch it was started on', async () => {
        await checkoutFeatureBranch();
        await repo.commit('feature work');

        await checkoutReleaseBranch(opts(), repo.git);

        expect(await branchHash(RELEASE_BRANCH)).toBe(await branchHash('main'));
        expect(await branchHash(RELEASE_BRANCH)).not.toBe(await branchHash('feature/x'));
      });
    });

    describe('default git client', () => {
      it('works on the repository in the current directory when no client is passed', async () => {
        const originalCwd = process.cwd();
        process.chdir(repo.dir);

        try {
          await expect(checkoutReleaseBranch(opts())).resolves.toMatchObject({
            created: true,
            releaseBranch: RELEASE_BRANCH
          });
        } finally {
          process.chdir(originalCwd);
        }
      });
    });
  });
});
