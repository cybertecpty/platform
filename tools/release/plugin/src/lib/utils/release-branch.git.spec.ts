import {
  cloneGitRepoFixture,
  createGitRepoFixture,
  type GitRepoFixture
} from '@cybertecpty/git-testing';
import { logger } from '@nx/devkit';

import {
  checkoutReleaseBranch,
  checkoutReleasePreview,
  type ReleaseBranchOptions
} from './release-branch.utils';

jest.setTimeout(30_000);

const RELEASE_BRANCH = 'release/2026-09-11';

const opts = (over: Partial<ReleaseBranchOptions> = {}): ReleaseBranchOptions => ({
  baseBranch: 'develop',
  releaseDate: '2026-09-11T12:00:00.000Z',
  skipBranch: false,
  ...over
});

// Real git: an `origin` with `main` and `develop` level at one commit, and a clone of it.
describe('release branch against real git', () => {
  let origin: GitRepoFixture;
  let clone: GitRepoFixture;

  beforeEach(async () => {
    origin = await createGitRepoFixture();
    await origin.commit('root');
    await origin.git.branch(['develop']);
    clone = await cloneGitRepoFixture(origin);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    clone.cleanup();
    origin.cleanup();
    jest.restoreAllMocks();
  });

  const pushReleaseBranchToOrigin = async (): Promise<string> => {
    await origin.git.checkoutBranch(RELEASE_BRANCH, 'develop');
    const hash = await origin.commit('chore(release): generate release artifacts');
    await origin.git.checkout('main');

    return hash;
  };

  const head = async () => (await clone.git.revparse(['HEAD'])).trim();

  describe('checkoutReleaseBranch', () => {
    it('continues from origin when the release branch exists only there', async () => {
      const releaseCommit = await pushReleaseBranchToOrigin();

      const result = await checkoutReleaseBranch(opts(), clone.git);

      expect(result).toEqual({
        created: false,
        releaseBranch: RELEASE_BRANCH,
        restoreBranch: 'main'
      });
      expect((await clone.git.branchLocal()).current).toBe(RELEASE_BRANCH);
      expect(await head()).toBe(releaseCommit);
    });
  });

  describe('checkoutReleasePreview', () => {
    it('detaches at the tip origin has for the release branch, from any starting branch', async () => {
      const releaseCommit = await pushReleaseBranchToOrigin();
      await clone.git.checkoutLocalBranch('feature/x');
      await clone.commit('unrelated work');

      const restore = await checkoutReleasePreview(opts(), clone.git);

      expect(await head()).toBe(releaseCommit);
      expect((await clone.git.revparse(['--abbrev-ref', 'HEAD'])).trim()).toBe('HEAD');
      expect((await clone.git.branchLocal()).all).not.toContain(RELEASE_BRANCH);

      await restore?.();

      expect((await clone.git.branchLocal()).current).toBe('feature/x');
    });

    it('detaches at origin/<base> when there is no release branch, ignoring a stale local base', async () => {
      await origin.git.checkout('develop');
      const baseTip = await origin.commit('feature work');
      await clone.git.fetch('origin');
      // The clone's local develop is still behind origin/develop.

      const restore = await checkoutReleasePreview(opts(), clone.git);

      expect(await head()).toBe(baseTip);
      await restore?.();
      expect((await clone.git.branchLocal()).current).toBe('main');
    });

    it('restores a detached starting point by hash', async () => {
      const start = await head();
      await clone.git.checkout(['--detach', start]);

      const restore = await checkoutReleasePreview(opts(), clone.git);
      await restore?.();

      expect(await head()).toBe(start);
    });

    it('leaves a dirty working tree alone and returns null', async () => {
      await clone.git.raw(['commit', '--allow-empty', '-m', 'x']);
      const { writeFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      writeFileSync(join(clone.dir, 'untracked.txt'), 'x');
      const before = await head();

      await expect(checkoutReleasePreview(opts(), clone.git)).resolves.toBeNull();
      expect(await head()).toBe(before);
    });
  });
});
