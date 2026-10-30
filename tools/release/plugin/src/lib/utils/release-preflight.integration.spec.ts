import {
  cloneGitRepoFixture,
  createGitRepoFixture,
  type GitRepoFixture
} from '@cybertecpty/git-testing';
import type { VersionData } from '@cybertecpty/nx-types';
import { logger } from '@nx/devkit';

import { assertBaseIncludesTarget, assertReleaseTagsAvailable } from './release-preflight.utils';

const RELEASE_BRANCH = 'release/2026-09-11';

const versionData = (project: string, newVersion: string): VersionData => ({
  [project]: { currentVersion: '1.0.0', newVersion, dependentProjects: [] }
});

/**
 * An `origin` with `main` and `develop` level at one commit, and a working clone
 * of it. Tests move `origin` ahead after the clone is made.
 */
describe('release preflight (real git)', () => {
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

  const checkBase = (dryRun = false) =>
    assertBaseIncludesTarget({ baseBranch: 'develop', dryRun, targetBranch: 'main' }, clone.git);

  describe('assertBaseIncludesTarget', () => {
    it('passes when develop and main are level', async () => {
      await expect(checkBase()).resolves.toBeUndefined();
    });

    it('passes when develop is ahead of main', async () => {
      await origin.git.checkout('develop');
      await origin.commit('feature work');

      await expect(checkBase()).resolves.toBeUndefined();
    });

    it('fails when main has a release that develop lacks', async () => {
      await origin.commit('release on main');

      await expect(checkBase()).rejects.toThrow(/Back-merge main into develop/);
    });

    it('still fails after a squashed back-merge, since main commits are not in develop history', async () => {
      await origin.commit('release on main');
      await origin.git.checkout('develop');
      await origin.commit('squashed copy of the release');

      await expect(checkBase()).rejects.toThrow(/Back-merge main into develop/);
    });

    it('passes once main is merged into develop', async () => {
      await origin.commit('release on main');
      await origin.git.checkout('develop');
      await origin.git.raw(['merge', '--no-ff', '-m', 'back-merge', 'main']);

      await expect(checkBase()).resolves.toBeUndefined();
    });

    it('only warns in a dry run', async () => {
      await origin.commit('release on main');

      await expect(checkBase(true)).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Back-merge main'));
    });
  });

  describe('assertReleaseTagsAvailable', () => {
    const checkTags = (data: VersionData) =>
      assertReleaseTagsAvailable(data, RELEASE_BRANCH, clone.git);

    it('passes when the tag does not exist', async () => {
      await expect(checkTags(versionData('app', '1.1.0'))).resolves.toBeUndefined();
    });

    it('fails, naming the tag, when it exists on a commit off the release branch', async () => {
      await clone.commit('earlier release');
      await clone.git.addAnnotatedTag('app@1.1.0', 'app@1.1.0');

      await expect(checkTags(versionData('app', '1.1.0'))).rejects.toThrow('app@1.1.0');
    });

    it('fails when the release branch exists but does not contain the tag commit', async () => {
      await clone.git.checkoutBranch(RELEASE_BRANCH, 'origin/develop');
      await clone.git.checkout('main');
      await clone.commit('release on main');
      await clone.git.addAnnotatedTag('app@1.1.0', 'app@1.1.0');

      await expect(checkTags(versionData('app', '1.1.0'))).rejects.toThrow('app@1.1.0');
    });

    it('passes on a same-day re-run, where the tag sits on the release branch', async () => {
      await clone.git.checkoutBranch(RELEASE_BRANCH, 'origin/develop');
      await clone.commit('chore(release): generate release artifacts');
      await clone.git.addAnnotatedTag('app@1.1.0', 'app@1.1.0');
      await clone.git.checkout('main');

      await expect(checkTags(versionData('app', '1.1.0'))).resolves.toBeUndefined();
    });

    it('ignores a project that was not given a new version', async () => {
      await clone.git.addAnnotatedTag('app@1.1.0', 'app@1.1.0');

      await expect(
        checkTags({ app: { currentVersion: '1.1.0', newVersion: null, dependentProjects: [] } })
      ).resolves.toBeUndefined();
    });

    it('sees a tag that exists only on origin once the base check has fetched it', async () => {
      await origin.commit('release on main');
      await origin.git.addAnnotatedTag('app@1.1.0', 'app@1.1.0');

      await expect(checkBase()).rejects.toThrow(/Back-merge/);
      await expect(checkTags(versionData('app', '1.1.0'))).rejects.toThrow('app@1.1.0');
    });
  });
});
