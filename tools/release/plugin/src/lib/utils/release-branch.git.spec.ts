import {
  cloneGitRepoFixture,
  createGitRepoFixture,
  type GitRepoFixture
} from '@cybertecpty/git-testing';
import { logger } from '@nx/devkit';

import { checkoutReleaseBranch, type ReleaseBranchOptions } from './release-branch.utils';

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
});
