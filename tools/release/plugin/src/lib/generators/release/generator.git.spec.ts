import {
  cloneGitRepoFixture,
  createGitRepoFixture,
  type GitRepoFixture
} from '@cybertecpty/git-testing';
import { createPullRequest } from '@cybertecpty/github-utils';
import type { VersionData } from '@cybertecpty/nx-types';
import { dryRunEnabled } from '@cybertecpty/nx-utils';
import { logger, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { releaseVersion } from 'nx/release';

import { selectReleasableProjects } from '../../utils/release-projects.utils';
import { releaseGenerator } from './generator';
import type { ReleaseGeneratorOptions } from './schema';

// These specs run the generator against real git repositories: an `origin` and a clone of it.
// Only what leaves the machine or needs a full Nx workspace is faked: the Nx release engine,
// the GitHub client, and the choice of releasable projects.

// The generator builds its git client with `simpleGit()` when the module loads, so the client
// is bound to the current clone on every call instead of to the cwd at import time.
let mockRepoDir = '';

jest.mock('simple-git', () => {
  const actual = jest.requireActual('simple-git');
  const bound = (...args: unknown[]) =>
    args.length
      ? actual.simpleGit(...args)
      : new Proxy(
          {},
          {
            get: (_target, property) => {
              const client = actual.simpleGit(mockRepoDir || undefined);
              const value = client[property];

              return typeof value === 'function' ? value.bind(client) : value;
            }
          }
        );

  return { __esModule: true, ...actual, default: bound, simpleGit: bound };
});

jest.mock('@cybertecpty/github-utils', () => ({
  createPullRequest: jest.fn(),
  findOpenPullRequest: jest.fn(),
  getGithubAccountToken: jest.fn(),
  getGithubAuthenticatedUser: jest.fn(),
  updatePullRequest: jest.fn()
}));

jest.mock('@cybertecpty/nx-utils', () => ({
  dryRunEnabled: jest.fn(),
  verboseEnabled: jest.fn()
}));

jest.mock('nx/release', () => ({
  releaseChangelog: jest.fn(),
  releaseVersion: jest.fn()
}));

jest.mock('../../utils/release-projects.utils', () => ({
  ...jest.requireActual('../../utils/release-projects.utils'),
  selectReleasableProjects: jest.fn(),
  tagReleasedProjects: jest.fn()
}));

jest.setTimeout(30_000);

const RELEASE_BRANCH = 'release/2026-09-11';
const TAG = 'app@1.1.0';

const versionData: VersionData = {
  app: { currentVersion: '1.0.0', newVersion: '1.1.0', dependentProjects: [] }
};

// Stops the run at the preflight and preview, so a run that gets past them writes nothing.
const options = (over: Partial<ReleaseGeneratorOptions> = {}): ReleaseGeneratorOptions => ({
  releaseDate: '2026-09-11T12:00:00.000Z',
  skipChangelog: true,
  skipFormat: true,
  skipManifest: true,
  skipPullRequest: true,
  skipWorkspaceVersion: true,
  ...over
});

describe('releaseGenerator preflight against real git', () => {
  let origin: GitRepoFixture;
  let clone: GitRepoFixture;
  let tree: Tree;

  beforeEach(async () => {
    mockRepoDir = '';
    jest.clearAllMocks();
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.mocked(dryRunEnabled).mockReturnValue(false);
    jest.mocked(releaseVersion).mockResolvedValue({
      projectsVersionData: versionData,
      releaseGraph: {},
      workspaceVersion: undefined
    } as unknown as Awaited<ReturnType<typeof releaseVersion>>);
    jest
      .mocked(selectReleasableProjects)
      .mockResolvedValue({ projects: ['app'], released: ['app'] });

    origin = await createGitRepoFixture();
    await origin.commit('root');
    await origin.git.branch(['develop']);
    clone = await cloneGitRepoFixture(origin);
    // A working clone already has the base branch locally; the generator checks it out to refresh it.
    await clone.git.checkoutBranch('develop', 'origin/develop');
    await clone.git.checkout('main');
    mockRepoDir = clone.dir;
    tree = createTreeWithEmptyWorkspace();
  });

  afterEach(() => {
    mockRepoDir = '';
    clone.cleanup();
    origin.cleanup();
    jest.restoreAllMocks();
  });

  const localBranches = async () => (await clone.git.branchLocal()).all.sort();
  const originBranches = async () => (await origin.git.branchLocal()).all.sort();
  const head = async () => (await clone.git.revparse(['HEAD'])).trim();
  const currentBranch = async () => (await clone.git.branchLocal()).current;

  /** Everything a failed run must not leave behind, compared with how the clone started. */
  const snapshot = async () => ({
    clean: (await clone.git.status()).isClean(),
    commits: (await clone.git.raw(['rev-list', '--branches', '--count'])).trim(),
    currentBranch: await currentBranch(),
    head: await head(),
    localBranches: await localBranches(),
    originBranches: await originBranches(),
    treeChanges: tree.listChanges().length
  });

  const expectNothingLeftBehind = async (before: Awaited<ReturnType<typeof snapshot>>) => {
    expect(await snapshot()).toEqual(before);
    expect(createPullRequest).not.toHaveBeenCalled();
  };

  describe('a stale base', () => {
    beforeEach(async () => {
      await origin.commit('release on main');
    });

    it('fails and leaves no file, branch, commit or PR behind', async () => {
      const before = await snapshot();

      await expect(releaseGenerator(tree, options())).rejects.toThrow(
        /Cannot release from a stale base/
      );

      expect(releaseVersion).not.toHaveBeenCalled();
      await expectNothingLeftBehind(before);
    });

    it('only warns in a dry run, and the run continues', async () => {
      jest.mocked(dryRunEnabled).mockReturnValue(true);

      await expect(releaseGenerator(tree, options())).resolves.toEqual(expect.any(Function));

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Stale base'));
      expect(releaseVersion).toHaveBeenCalled();
    });
  });

  describe('a release tag on a foreign commit', () => {
    beforeEach(async () => {
      await clone.git.checkoutLocalBranch('other');
      await clone.commit('earlier release, never back-merged');
      await clone.git.addAnnotatedTag(TAG, TAG);
      await clone.git.checkout('main');
    });

    it('fails, naming the tag, and leaves no file, branch, commit or PR behind', async () => {
      const before = await snapshot();

      await expect(releaseGenerator(tree, options())).rejects.toThrow(TAG);

      await expectNothingLeftBehind(before);
    });

    it('fails the same way when started from a feature branch behind origin', async () => {
      await clone.git.checkoutLocalBranch('feature/x');
      const before = await snapshot();

      await expect(releaseGenerator(tree, options())).rejects.toThrow(TAG);

      await expectNothingLeftBehind(before);
    });

    it('warns instead of failing in a dry run, and leaves the checkout as it was', async () => {
      jest.mocked(dryRunEnabled).mockReturnValue(true);
      await clone.git.checkoutLocalBranch('feature/x');
      const before = await snapshot();

      await expect(releaseGenerator(tree, options())).resolves.toEqual(expect.any(Function));

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(TAG));
      await expectNothingLeftBehind(before);
    });

    it('is not checked when tagging is skipped', async () => {
      const callback = await releaseGenerator(tree, options({ skipTag: true }));
      await callback();

      expect(await currentBranch()).toBe('main');
    });
  });

  describe('a same-day re-run from a clone without the release branch', () => {
    beforeEach(async () => {
      await origin.git.checkoutBranch(RELEASE_BRANCH, 'develop');
      await origin.commit('chore(release): generate release artifacts');
      await origin.git.addAnnotatedTag(TAG, TAG);
      await origin.git.checkout('main');
      await clone.git.fetch(['origin', '--tags']);
    });

    it('passes when the release branch exists only on origin', async () => {
      expect(await localBranches()).not.toContain(RELEASE_BRANCH);

      const callback = await releaseGenerator(tree, options());

      expect(await currentBranch()).toBe(RELEASE_BRANCH);
      await callback();
      expect(await currentBranch()).toBe('main');
    });
  });
});
