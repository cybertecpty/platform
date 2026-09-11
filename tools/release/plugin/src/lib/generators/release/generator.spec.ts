import { lastGitCommitHash } from '@cybertecpty/git-utils';
import {
  createPullRequest,
  findOpenPullRequest,
  updatePullRequest
} from '@cybertecpty/github-utils';
import type { ProjectChangelogs, VersionData } from '@cybertecpty/nx-types';
import { dryRunEnabled, releaseVersion, verboseEnabled } from '@cybertecpty/nx-utils';
import {
  buildReleasePrBody,
  checkoutReleaseBranch,
  releaseChangelog,
  resolveAffectedReleaseProjects,
  resolveReleaseBranchName,
  resolveWorkspaceReleaseType,
  tagReleasedProjects
} from '@cybertecpty/release-utils';
import { formatFiles, logger, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import simpleGit from 'simple-git';

import { packageVersionGenerator } from '../package-version/generator';
import releaseManifestGenerator from '../release-manifest/generator';
import { releaseGenerator } from './generator';
import type { ReleaseGeneratorOptions } from './schema';

jest.mock('@cybertecpty/git-utils', () => ({
  lastGitCommitHash: jest.fn()
}));

jest.mock('@cybertecpty/github-utils', () => ({
  createPullRequest: jest.fn(),
  findOpenPullRequest: jest.fn(),
  updatePullRequest: jest.fn()
}));

jest.mock('@cybertecpty/nx-utils', () => ({
  dryRunEnabled: jest.fn(),
  releaseVersion: jest.fn(),
  verboseEnabled: jest.fn()
}));

jest.mock('@cybertecpty/release-utils', () => ({
  buildReleasePrBody: jest.fn(),
  checkoutReleaseBranch: jest.fn(),
  releaseChangelog: jest.fn(),
  resolveAffectedReleaseProjects: jest.fn(),
  resolveReleaseBranchName: jest.fn(),
  resolveWorkspaceReleaseType: jest.fn(),
  tagReleasedProjects: jest.fn()
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  formatFiles: jest.fn()
}));

jest.mock('simple-git', () => {
  const client = {
    add: jest.fn(),
    checkout: jest.fn(),
    commit: jest.fn(),
    fetch: jest.fn(),
    push: jest.fn()
  };

  return {
    __esModule: true,
    default: jest.fn(() => client),
    simpleGit: jest.fn(() => client)
  };
});

jest.mock('../package-version/generator', () => ({
  packageVersionGenerator: jest.fn()
}));

jest.mock('../release-manifest/generator', () => ({
  __esModule: true,
  default: jest.fn()
}));

const mockLastGitCommitHash = jest.mocked(lastGitCommitHash);
const mockCreatePullRequest = jest.mocked(createPullRequest);
const mockFindOpenPullRequest = jest.mocked(findOpenPullRequest);
const mockUpdatePullRequest = jest.mocked(updatePullRequest);
const mockDryRunEnabled = jest.mocked(dryRunEnabled);
const mockReleaseVersion = jest.mocked(releaseVersion);
const mockVerboseEnabled = jest.mocked(verboseEnabled);
const mockBuildReleasePrBody = jest.mocked(buildReleasePrBody);
const mockCheckoutReleaseBranch = jest.mocked(checkoutReleaseBranch);
const mockReleaseChangelog = jest.mocked(releaseChangelog);
const mockResolveAffectedReleaseProjects = jest.mocked(resolveAffectedReleaseProjects);
const mockResolveReleaseBranchName = jest.mocked(resolveReleaseBranchName);
const mockResolveWorkspaceReleaseType = jest.mocked(resolveWorkspaceReleaseType);
const mockTagReleasedProjects = jest.mocked(tagReleasedProjects);
const mockFormatFiles = jest.mocked(formatFiles);
const mockPackageVersionGenerator = jest.mocked(packageVersionGenerator);
const mockReleaseManifestGenerator = jest.mocked(releaseManifestGenerator);

/** Subject line the generator uses for its own release commit. */
const RELEASE_COMMIT_MESSAGE = 'chore(release): generate release artifacts';

/** Everything `gitClient.<method>` needs to be assertable as a jest mock. */
interface GitSpies {
  add: jest.Mock;
  checkout: jest.Mock;
  commit: jest.Mock;
  fetch: jest.Mock;
  push: jest.Mock;
}

type ReleaseVersionResult = Awaited<ReturnType<typeof releaseVersion>>;
type ReleaseChangelogResult = Awaited<ReturnType<typeof releaseChangelog>>;

/** Placeholder release graph, opaque to the generator — it only passes it through. */
const FAKE_RELEASE_GRAPH = {} as unknown as ReleaseVersionResult['releaseGraph'];

const versionResult = (
  projectsVersionData: VersionData,
  releaseGraph: ReleaseVersionResult['releaseGraph'] = FAKE_RELEASE_GRAPH
): ReleaseVersionResult => ({
  projectsVersionData,
  releaseGraph,
  workspaceVersion: undefined
});

const changelogResult = (projectChangelogs?: ProjectChangelogs): ReleaseChangelogResult => ({
  projectChangelogs,
  workspaceChangelog: undefined
});

/** Builds a `VersionData` map from `{ project: newVersion }`. */
const buildVersionData = (entries: Record<string, string | null>): VersionData =>
  Object.fromEntries(
    Object.entries(entries).map(([project, newVersion]) => [
      project,
      { currentVersion: '1.0.0', newVersion, dependentProjects: [] }
    ])
  );

const options = (over: Partial<ReleaseGeneratorOptions> = {}): ReleaseGeneratorOptions => ({
  releaseDate: '2026-09-11T12:00:00.000Z',
  ...over
});

describe('releaseGenerator', () => {
  let tree: Tree;
  let gitClient: GitSpies;

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    gitClient = jest.mocked(simpleGit)() as unknown as GitSpies;

    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

    mockDryRunEnabled.mockReturnValue(false);
    mockVerboseEnabled.mockReturnValue(false);
    mockResolveReleaseBranchName.mockReturnValue('release/2026-09-11');
    mockCheckoutReleaseBranch.mockResolvedValue({
      releaseBranch: 'release/2026-09-11',
      restoreBranch: null
    });
    mockReleaseVersion.mockResolvedValue(versionResult(buildVersionData({})));
    mockReleaseChangelog.mockResolvedValue(changelogResult(undefined));
    mockResolveWorkspaceReleaseType.mockReturnValue(null);
    mockPackageVersionGenerator.mockResolvedValue(undefined);
    mockReleaseManifestGenerator.mockImplementation((_tree, manifestOpts) =>
      Promise.resolve(`${manifestOpts.project}/release-manifest.json`)
    );
    mockLastGitCommitHash.mockResolvedValue('abc1234567');
    mockTagReleasedProjects.mockResolvedValue([]);
    mockBuildReleasePrBody.mockResolvedValue('pr body');
    mockFindOpenPullRequest.mockResolvedValue(null);
    mockCreatePullRequest.mockResolvedValue('https://github.com/cybertecpty/platform/pull/1');
    mockUpdatePullRequest.mockResolvedValue('https://github.com/cybertecpty/platform/pull/1');
    mockFormatFiles.mockResolvedValue(undefined);
    mockResolveAffectedReleaseProjects.mockResolvedValue([]);

    gitClient.add.mockResolvedValue(undefined);
    gitClient.checkout.mockResolvedValue(undefined);
    gitClient.commit.mockResolvedValue(undefined);
    gitClient.fetch.mockResolvedValue(undefined);
    gitClient.push.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('option defaults', () => {
    it('fills in baseBranch, skipBranch, and the release date when omitted', async () => {
      await releaseGenerator(tree, options());

      expect(mockResolveReleaseBranchName).toHaveBeenCalledWith({
        baseBranch: 'develop',
        releaseDate: '2026-09-11T12:00:00.000Z',
        skipBranch: false
      });
    });

    it('honors explicit baseBranch and skipBranch overrides', async () => {
      await releaseGenerator(tree, options({ baseBranch: 'release-line', skipBranch: true }));

      expect(mockResolveReleaseBranchName).toHaveBeenCalledWith({
        baseBranch: 'release-line',
        releaseDate: '2026-09-11T12:00:00.000Z',
        skipBranch: true
      });
    });

    it('defaults releaseDate to roughly the current time when omitted', async () => {
      await releaseGenerator(tree, {});

      const branchOpts = mockResolveReleaseBranchName.mock.calls[0][0];

      expect(branchOpts.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(Date.now() - Date.parse(branchOpts.releaseDate)).toBeLessThan(5_000);
    });
  });

  describe('--affected with nothing to release', () => {
    it('returns a no-op release when no releasable project is affected', async () => {
      mockResolveAffectedReleaseProjects.mockResolvedValue([]);

      const callback = await releaseGenerator(tree, options({ affected: true }));
      await expect(callback()).resolves.toBeUndefined();

      expect(mockCheckoutReleaseBranch).not.toHaveBeenCalled();
      expect(mockReleaseVersion).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('No affected projects matched')
      );
    });

    it('proceeds normally when the affected scan finds releasable projects', async () => {
      mockResolveAffectedReleaseProjects.mockResolvedValue(['pkg-a']);

      await releaseGenerator(tree, options({ affected: true }));

      expect(mockReleaseVersion).toHaveBeenCalledWith(
        expect.objectContaining({ projects: ['pkg-a'] })
      );
    });
  });

  describe('dry run', () => {
    it('skips the real branch checkout and only resolves the branch name', async () => {
      mockDryRunEnabled.mockReturnValue(true);

      await releaseGenerator(tree, options());

      expect(mockCheckoutReleaseBranch).not.toHaveBeenCalled();
      expect(mockResolveReleaseBranchName).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Dry run: release would be cut on release/2026-09-11')
      );
    });

    it('passes dryRun through to releaseVersion and releaseChangelog', async () => {
      mockDryRunEnabled.mockReturnValue(true);

      await releaseGenerator(tree, options());

      expect(mockReleaseVersion).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
      expect(mockReleaseChangelog).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    });
  });

  describe('release branch checkout (non-dry-run)', () => {
    it('checks out the release branch with the shared git client', async () => {
      await releaseGenerator(tree, options({ baseBranch: 'develop' }));

      expect(mockCheckoutReleaseBranch).toHaveBeenCalledWith(
        { baseBranch: 'develop', releaseDate: '2026-09-11T12:00:00.000Z', skipBranch: false },
        gitClient
      );
    });
  });

  describe('project versioning and changelog', () => {
    it('passes firstRelease, projects, and the version specifier to releaseVersion', async () => {
      await releaseGenerator(
        tree,
        options({ firstRelease: true, projects: ['pkg-a', 'pkg-b'], vers: '1.2.3' })
      );

      expect(mockReleaseVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          firstRelease: true,
          projects: ['pkg-a', 'pkg-b'],
          specifier: '1.2.3'
        })
      );
    });

    it("reuses releaseVersion's releaseGraph in the releaseChangelog call", async () => {
      mockReleaseVersion.mockResolvedValue(versionResult(buildVersionData({}), FAKE_RELEASE_GRAPH));

      await releaseGenerator(tree, options());

      expect(mockReleaseChangelog).toHaveBeenCalledWith(
        expect.objectContaining({ releaseGraph: FAKE_RELEASE_GRAPH })
      );
    });

    it('skips releaseChangelog entirely when skipChangelog is set', async () => {
      await releaseGenerator(tree, options({ skipChangelog: true }));

      expect(mockReleaseChangelog).not.toHaveBeenCalled();
    });

    it('calls releaseChangelog with remote release creation disabled and the resolved version data', async () => {
      const versionData = buildVersionData({ 'pkg-a': '1.1.0' });
      mockReleaseVersion.mockResolvedValue(versionResult(versionData));

      await releaseGenerator(tree, options());

      expect(mockReleaseChangelog).toHaveBeenCalledWith(
        expect.objectContaining({ createRelease: false, versionData })
      );
    });
  });

  describe('workspace version bump', () => {
    it('skips the bump without even checking the release type when skipWorkspaceVersion is set', async () => {
      await releaseGenerator(tree, options({ skipWorkspaceVersion: true }));

      expect(mockResolveWorkspaceReleaseType).not.toHaveBeenCalled();
      expect(mockPackageVersionGenerator).not.toHaveBeenCalled();
    });

    it('warns and skips the bump when there is no workspace-level release type', async () => {
      mockResolveWorkspaceReleaseType.mockReturnValue(null);

      await releaseGenerator(tree, options());

      expect(mockPackageVersionGenerator).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No project version bumps found')
      );
    });

    it('bumps the workspace package.json to the highest project release type', async () => {
      mockResolveWorkspaceReleaseType.mockReturnValue('minor');

      await releaseGenerator(tree, options());

      expect(mockPackageVersionGenerator).toHaveBeenCalledWith(tree, {
        path: 'package.json',
        skipFormat: true,
        vers: 'minor'
      });
    });

    it('includes the bumped workspace package.json in the release commit', async () => {
      mockResolveWorkspaceReleaseType.mockReturnValue('patch');

      const callback = await releaseGenerator(tree, options({ skipManifest: true }));
      await callback();

      expect(gitClient.add).toHaveBeenCalledWith(['package.json']);
    });
  });

  describe('release manifests', () => {
    it('skips manifest generation entirely when skipManifest is set', async () => {
      mockReleaseVersion.mockResolvedValue(versionResult(buildVersionData({ 'pkg-a': '1.1.0' })));

      const callback = await releaseGenerator(
        tree,
        options({ skipManifest: true, skipWorkspaceVersion: true })
      );
      await callback();

      expect(mockReleaseManifestGenerator).not.toHaveBeenCalled();
      expect(gitClient.add).not.toHaveBeenCalled();
    });

    it('only generates a manifest for projects that actually received a new version', async () => {
      mockReleaseVersion.mockResolvedValue(
        versionResult(buildVersionData({ 'pkg-a': '1.1.0', 'pkg-b': null }))
      );

      await releaseGenerator(tree, options());

      expect(mockReleaseManifestGenerator).toHaveBeenCalledTimes(1);
      expect(mockReleaseManifestGenerator).toHaveBeenCalledWith(
        tree,
        expect.objectContaining({ project: 'pkg-a' })
      );
    });

    it('passes the resolved source commit, author, and version through to the manifest generator', async () => {
      mockLastGitCommitHash.mockResolvedValue('deadbeef12');
      mockReleaseVersion.mockResolvedValue(versionResult(buildVersionData({ 'pkg-a': '1.1.0' })));

      await releaseGenerator(tree, options({ author: 'Jane Doe' }));

      expect(mockLastGitCommitHash).toHaveBeenCalledWith({ length: 10 }, gitClient);
      expect(mockReleaseManifestGenerator).toHaveBeenCalledWith(tree, {
        author: 'Jane Doe',
        project: 'pkg-a',
        sourceCommit: 'deadbeef12',
        version: '1.1.0',
        skipFormat: true
      });
    });

    it('includes every generated manifest path in the release commit', async () => {
      mockReleaseVersion.mockResolvedValue(
        versionResult(buildVersionData({ 'pkg-a': '1.1.0', 'pkg-b': '2.0.0' }))
      );

      const callback = await releaseGenerator(tree, options({ skipWorkspaceVersion: true }));
      await callback();

      expect(gitClient.add).toHaveBeenCalledWith([
        'pkg-a/release-manifest.json',
        'pkg-b/release-manifest.json'
      ]);
    });
  });

  describe('formatting', () => {
    it('formats the tree by default', async () => {
      await releaseGenerator(tree, options());

      expect(mockFormatFiles).toHaveBeenCalledWith(tree);
    });

    it('skips formatting when skipFormat is set', async () => {
      await releaseGenerator(tree, options({ skipFormat: true }));

      expect(mockFormatFiles).not.toHaveBeenCalled();
    });
  });

  describe('the returned commit/push callback', () => {
    it('only logs and restores the branch when there is nothing to release', async () => {
      mockCheckoutReleaseBranch.mockResolvedValue({
        releaseBranch: 'release/2026-09-11',
        restoreBranch: 'feature/x'
      });

      const callback = await releaseGenerator(
        tree,
        options({ skipManifest: true, skipWorkspaceVersion: true })
      );
      await callback();

      expect(gitClient.add).not.toHaveBeenCalled();
      expect(gitClient.commit).not.toHaveBeenCalled();
      expect(mockTagReleasedProjects).not.toHaveBeenCalled();
      expect(gitClient.fetch).not.toHaveBeenCalled();
      expect(gitClient.push).not.toHaveBeenCalled();
      expect(mockFindOpenPullRequest).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Release complete.');
      expect(gitClient.checkout).toHaveBeenCalledWith('feature/x');
    });

    describe('when there is something to release', () => {
      beforeEach(() => {
        mockResolveWorkspaceReleaseType.mockReturnValue('patch');
      });

      it('commits, tags, fetches, pushes, and opens the PR in that order', async () => {
        const order: string[] = [];
        gitClient.add.mockImplementation(() => {
          order.push('add');
          return Promise.resolve();
        });
        gitClient.commit.mockImplementation(() => {
          order.push('commit');
          return Promise.resolve();
        });
        mockTagReleasedProjects.mockImplementation(() => {
          order.push('tag');
          return Promise.resolve([]);
        });
        gitClient.fetch.mockImplementation(() => {
          order.push('fetch');
          return Promise.resolve();
        });
        gitClient.push.mockImplementation(() => {
          order.push('push');
          return Promise.resolve();
        });
        mockFindOpenPullRequest.mockImplementation(() => {
          order.push('pr');
          return Promise.resolve(null);
        });

        const callback = await releaseGenerator(tree, options({ skipManifest: true }));
        await callback();

        expect(order).toEqual(['add', 'commit', 'tag', 'fetch', 'push', 'pr']);
      });

      it('commits the release with the standard subject line', async () => {
        const callback = await releaseGenerator(tree, options({ skipManifest: true }));
        await callback();

        expect(gitClient.commit).toHaveBeenCalledWith(RELEASE_COMMIT_MESSAGE);
      });

      it('forwards skipTag to tagReleasedProjects', async () => {
        const versionData = buildVersionData({ 'pkg-a': '1.1.0' });
        mockReleaseVersion.mockResolvedValue(versionResult(versionData));

        const callback = await releaseGenerator(
          tree,
          options({ skipManifest: true, skipTag: true })
        );
        await callback();

        expect(mockTagReleasedProjects).toHaveBeenCalledWith(versionData, true);
      });

      it('refreshes remote refs before a force-with-lease, follow-tags push', async () => {
        const callback = await releaseGenerator(tree, options({ skipManifest: true }));
        await callback();

        expect(gitClient.fetch).toHaveBeenCalledWith(['origin', '--prune']);
        expect(gitClient.push).toHaveBeenCalledWith('origin', 'release/2026-09-11', [
          '--force-with-lease',
          '--follow-tags'
        ]);
      });

      it('restores the starting branch after a successful release', async () => {
        mockCheckoutReleaseBranch.mockResolvedValue({
          releaseBranch: 'release/2026-09-11',
          restoreBranch: 'feature/x'
        });

        const callback = await releaseGenerator(tree, options({ skipManifest: true }));
        await callback();

        expect(gitClient.checkout).toHaveBeenCalledWith('feature/x');
      });

      it('does not attempt to restore when there was nothing to restore', async () => {
        mockCheckoutReleaseBranch.mockResolvedValue({
          releaseBranch: 'release/2026-09-11',
          restoreBranch: null
        });

        const callback = await releaseGenerator(tree, options({ skipManifest: true }));
        await callback();

        expect(gitClient.checkout).not.toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('restores the starting branch and rethrows when releaseVersion fails', async () => {
      mockCheckoutReleaseBranch.mockResolvedValue({
        releaseBranch: 'release/2026-09-11',
        restoreBranch: 'feature/x'
      });
      mockReleaseVersion.mockRejectedValue(new Error('boom'));

      await expect(releaseGenerator(tree, options())).rejects.toThrow('boom');
      expect(gitClient.checkout).toHaveBeenCalledWith('feature/x');
    });

    it('restores the starting branch even when the commit/push callback itself fails', async () => {
      mockCheckoutReleaseBranch.mockResolvedValue({
        releaseBranch: 'release/2026-09-11',
        restoreBranch: 'feature/x'
      });
      mockResolveWorkspaceReleaseType.mockReturnValue('patch');
      gitClient.push.mockRejectedValue(new Error('push failed'));

      const callback = await releaseGenerator(tree, options({ skipManifest: true }));

      await expect(callback()).rejects.toThrow('push failed');
      expect(gitClient.checkout).toHaveBeenCalledWith('feature/x');
    });
  });

  describe('release pull request', () => {
    beforeEach(() => {
      // A non-empty release commit is required to reach the PR step at all.
      mockResolveWorkspaceReleaseType.mockReturnValue('patch');
    });

    const run = (over: Partial<ReleaseGeneratorOptions> = {}) =>
      releaseGenerator(tree, options({ skipManifest: true, ...over })).then(callback => callback());

    it('skips the PR entirely when skipPullRequest is set', async () => {
      await run({ skipPullRequest: true });

      expect(mockBuildReleasePrBody).not.toHaveBeenCalled();
      expect(mockFindOpenPullRequest).not.toHaveBeenCalled();
    });

    it('skips the PR entirely when skipBranch is set', async () => {
      await run({ skipBranch: true });

      expect(mockBuildReleasePrBody).not.toHaveBeenCalled();
    });

    it('skips the PR when the release branch equals the target branch', async () => {
      mockResolveReleaseBranchName.mockReturnValue('main');

      await run({ targetBranch: 'main' });

      expect(mockBuildReleasePrBody).not.toHaveBeenCalled();
    });

    it('opens a new PR when none is already open', async () => {
      mockFindOpenPullRequest.mockResolvedValue(null);

      await run({ targetBranch: 'main' });

      expect(mockCreatePullRequest).toHaveBeenCalledWith({
        base: 'main',
        body: 'pr body',
        head: 'release/2026-09-11',
        title: 'Release/2026-09-11'
      });
      expect(mockUpdatePullRequest).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/cybertecpty/platform/pull/1')
      );
    });

    it('updates the existing PR instead of creating a new one', async () => {
      mockFindOpenPullRequest.mockResolvedValue(42);

      await run();

      expect(mockUpdatePullRequest).toHaveBeenCalledWith({
        body: 'pr body',
        number: 42,
        title: 'Release/2026-09-11'
      });
      expect(mockCreatePullRequest).not.toHaveBeenCalled();
    });

    it('swallows a PR-body build failure and logs a manual fallback instead of throwing', async () => {
      mockBuildReleasePrBody.mockRejectedValue(new Error('git range lookup failed'));

      await expect(run({ targetBranch: 'main' })).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to open the release pull request')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('gh pr create --base main --head release/2026-09-11')
      );
    });

    it('stringifies a non-Error rejection in the manual fallback message', async () => {
      mockBuildReleasePrBody.mockRejectedValue('rate limited');

      await run();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to open the release pull request: rate limited')
      );
    });
  });
});
