import { gitMergeBase } from '@cybertecpty/git-utils';
import { createDependencyGraphFixture, createProjectNodeFixture } from '@cybertecpty/nx-testing';
import { findMatchingProjects, getAffectedGraphNodes } from '@cybertecpty/nx-utils';
import {
  createProjectGraphAsync,
  logger,
  readNxJson,
  updateNxJson,
  type NxJsonConfiguration,
  type Tree
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { releaseChangelog } from 'nx/release';
import simpleGit, { type SimpleGit } from 'simple-git';

import {
  getReleaseCommandOptions,
  partitionReleasableProjects,
  readReleasePatterns,
  resolveAffectedBase,
  resolveAffectedReleaseProjects,
  resolveReleaseProjects,
  selectAffectedReleaseProjects,
  selectReleasableProjects
} from './release-projects.utils';

jest.mock('@cybertecpty/git-utils', () => ({
  gitMergeBase: jest.fn()
}));

jest.mock('@cybertecpty/nx-utils', () => ({
  findMatchingProjects: jest.fn(),
  getAffectedGraphNodes: jest.fn()
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn()
}));

jest.mock('nx/release', () => ({
  releaseChangelog: jest.fn()
}));

jest.mock('simple-git', () => ({
  __esModule: true,
  default: jest.fn(),
  simpleGit: jest.fn()
}));

const mockGitMergeBase = jest.mocked(gitMergeBase);
const mockFindMatchingProjects = jest.mocked(findMatchingProjects);
const mockGetAffectedGraphNodes = jest.mocked(getAffectedGraphNodes);
const mockCreateProjectGraphAsync = jest.mocked(createProjectGraphAsync);
const mockSimpleGit = jest.mocked(simpleGit);
const mockReleaseChangelog = jest.mocked(releaseChangelog);

/** A throwaway git client; every function under test has its git calls mocked. */
const gitStub = {} as SimpleGit;

/** Builds the affected-scan return shape from a list of project names. */
const affectedNodes = (...names: string[]) =>
  names.map(name => ({ name })) as unknown as Awaited<ReturnType<typeof getAffectedGraphNodes>>;

let tree: Tree;

/** Points `nx.json`'s `release` block at `release` and leaves the rest intact. */
const withRelease = (release: NxJsonConfiguration['release']): void => {
  updateNxJson(tree, { ...(readNxJson(tree) as NxJsonConfiguration), release });
};

beforeEach(() => {
  jest.clearAllMocks();
  tree = createTreeWithEmptyWorkspace();
});

describe('readReleasePatterns', () => {
  it('wraps a single top-level `release.projects` pattern in an array', () => {
    withRelease({ projects: 'packages/*' });

    expect(readReleasePatterns(tree)).toEqual(['packages/*']);
  });

  it('passes a `release.projects` list through unchanged', () => {
    withRelease({ projects: ['packages/a', 'packages/b'] });

    expect(readReleasePatterns(tree)).toEqual(['packages/a', 'packages/b']);
  });

  it('unions the `projects` of every `release.groups` entry, in declaration order', () => {
    withRelease({
      groups: {
        apps: { projects: 'apps/*' },
        packages: { projects: ['packages/a', 'packages/b'] }
      }
    });

    expect(readReleasePatterns(tree)).toEqual(['apps/*', 'packages/a', 'packages/b']);
  });

  it('reads `release.groups` even when `release.projects` is also present', () => {
    withRelease({
      projects: 'should-be-ignored',
      groups: { packages: { projects: 'packages/*' } }
    });

    expect(readReleasePatterns(tree)).toEqual(['packages/*']);
  });

  it.each([
    ['`release` is absent', undefined],
    ['`release` is empty', {}],
    ['`release.projects` is an empty string', { projects: '' }],
    ['`release.projects` is an empty list', { projects: [] }],
    ['`release.groups` is empty', { groups: {} }],
    ['a `release.groups` entry has no projects', { groups: { packages: { projects: [] } } }]
  ] as [string, NxJsonConfiguration['release']][])('throws when %s', (_label, release) => {
    withRelease(release);

    expect(() => readReleasePatterns(tree)).toThrow(
      'nx.json configures no releasable projects: set release.projects or release.groups.'
    );
  });
});

describe('resolveReleaseProjects', () => {
  const graph = createDependencyGraphFixture([
    createProjectNodeFixture({ name: 'pkg-a' }),
    createProjectNodeFixture({ name: 'pkg-b' })
  ]);

  it('matches the release patterns against the graph nodes', () => {
    withRelease({ projects: ['pkg-a', 'pkg-b'] });
    mockFindMatchingProjects.mockReturnValue(['pkg-a']);

    expect(resolveReleaseProjects(tree, graph)).toEqual(['pkg-a']);
    expect(mockFindMatchingProjects).toHaveBeenCalledWith(['pkg-a', 'pkg-b'], graph.nodes);
  });

  it('propagates the missing-config error without calling the matcher', () => {
    expect(() => resolveReleaseProjects(tree, graph)).toThrow(
      'nx.json configures no releasable projects'
    );
    expect(mockFindMatchingProjects).not.toHaveBeenCalled();
  });
});

describe('selectAffectedReleaseProjects', () => {
  it('keeps the release-config order rather than the affected order', () => {
    expect(selectAffectedReleaseProjects(['a', 'b', 'c'], ['c', 'a'])).toEqual(['a', 'c']);
  });

  it('drops releasable projects that were not affected', () => {
    expect(selectAffectedReleaseProjects(['a', 'b', 'c'], ['b'])).toEqual(['b']);
  });

  it('ignores affected projects that are not releasable', () => {
    expect(selectAffectedReleaseProjects(['a'], ['a', 'x', 'y'])).toEqual(['a']);
  });

  it('returns nothing when the affected set is empty', () => {
    expect(selectAffectedReleaseProjects(['a', 'b'], [])).toEqual([]);
  });

  it('returns nothing when there are no releasable projects', () => {
    expect(selectAffectedReleaseProjects([], ['a', 'b'])).toEqual([]);
  });

  it('accepts a Set as the affected collection', () => {
    expect(selectAffectedReleaseProjects(['a', 'b'], new Set(['b']))).toEqual(['b']);
  });
});

describe('resolveAffectedBase', () => {
  it('resolves the merge-base of `targetBranch` and HEAD', async () => {
    mockGitMergeBase.mockResolvedValue('abc123');

    await expect(resolveAffectedBase({ targetBranch: 'main' }, gitStub)).resolves.toBe('abc123');
    expect(mockGitMergeBase).toHaveBeenCalledWith('main', 'HEAD', gitStub);
  });

  it('prefers an explicit `base` over `targetBranch`', async () => {
    mockGitMergeBase.mockResolvedValue('deadbeef');

    await resolveAffectedBase({ targetBranch: 'main', base: 'v1.2.0' }, gitStub);

    expect(mockGitMergeBase).toHaveBeenCalledWith('v1.2.0', 'HEAD', gitStub);
  });

  it('falls back to `targetBranch` when there is no merge-base', async () => {
    mockGitMergeBase.mockResolvedValue(null);

    await expect(resolveAffectedBase({ targetBranch: 'main' }, gitStub)).resolves.toBe('main');
  });

  it('falls back to the explicit `base` when there is no merge-base', async () => {
    mockGitMergeBase.mockResolvedValue(null);

    await expect(
      resolveAffectedBase({ targetBranch: 'main', base: 'v1.2.0' }, gitStub)
    ).resolves.toBe('v1.2.0');
  });

  it('uses simpleGit() when no client is passed', async () => {
    const fallbackGit = {} as SimpleGit;
    mockSimpleGit.mockReturnValue(fallbackGit);
    mockGitMergeBase.mockResolvedValue('abc123');

    await resolveAffectedBase({ targetBranch: 'main' });

    expect(mockGitMergeBase).toHaveBeenCalledWith('main', 'HEAD', fallbackGit);
  });
});

describe('resolveAffectedReleaseProjects', () => {
  beforeEach(() => {
    mockGitMergeBase.mockResolvedValue('base-sha');
    mockCreateProjectGraphAsync.mockResolvedValue({ nodes: {}, dependencies: {} });
  });

  it('returns the releasable projects that were affected, in release-config order', async () => {
    withRelease({ projects: ['pkg-a', 'pkg-b', 'pkg-c'] });
    mockFindMatchingProjects.mockReturnValue(['pkg-a', 'pkg-b', 'pkg-c']);
    mockGetAffectedGraphNodes.mockResolvedValue(affectedNodes('pkg-c', 'pkg-a', 'unrelated'));

    await expect(
      resolveAffectedReleaseProjects(tree, { targetBranch: 'main' }, gitStub)
    ).resolves.toEqual(['pkg-a', 'pkg-c']);
  });

  it('scans the committed `base..HEAD` diff, ignoring working-tree state', async () => {
    withRelease({ projects: 'pkg-a' });
    mockFindMatchingProjects.mockReturnValue(['pkg-a']);
    mockGetAffectedGraphNodes.mockResolvedValue(affectedNodes());

    await resolveAffectedReleaseProjects(tree, { targetBranch: 'main' }, gitStub);

    expect(mockGitMergeBase).toHaveBeenCalledWith('main', 'HEAD', gitStub);
    expect(mockGetAffectedGraphNodes).toHaveBeenCalledWith(
      { base: 'base-sha', head: 'HEAD' },
      expect.anything()
    );
  });

  it('feeds the one created project graph to both the affected scan and the matcher', async () => {
    const graph = createDependencyGraphFixture([createProjectNodeFixture({ name: 'pkg-a' })]);
    mockCreateProjectGraphAsync.mockResolvedValue(graph);
    withRelease({ projects: 'pkg-a' });
    mockFindMatchingProjects.mockReturnValue(['pkg-a']);
    mockGetAffectedGraphNodes.mockResolvedValue(affectedNodes('pkg-a'));

    await resolveAffectedReleaseProjects(tree, { targetBranch: 'main' }, gitStub);

    expect(mockGetAffectedGraphNodes).toHaveBeenCalledWith(expect.anything(), graph);
    expect(mockFindMatchingProjects).toHaveBeenCalledWith(['pkg-a'], graph.nodes);
  });

  it('returns nothing when no releasable project was affected', async () => {
    withRelease({ projects: ['pkg-a', 'pkg-b'] });
    mockFindMatchingProjects.mockReturnValue(['pkg-a', 'pkg-b']);
    mockGetAffectedGraphNodes.mockResolvedValue(affectedNodes('unrelated'));

    await expect(
      resolveAffectedReleaseProjects(tree, { targetBranch: 'main' }, gitStub)
    ).resolves.toEqual([]);
  });

  it('falls back to simpleGit() when no client is passed', async () => {
    const fallbackGit = {} as SimpleGit;
    mockSimpleGit.mockReturnValue(fallbackGit);
    withRelease({ projects: 'pkg-a' });
    mockFindMatchingProjects.mockReturnValue(['pkg-a']);
    mockGetAffectedGraphNodes.mockResolvedValue(affectedNodes('pkg-a'));

    await resolveAffectedReleaseProjects(tree, { targetBranch: 'main' });

    expect(mockGitMergeBase).toHaveBeenCalledWith('main', 'HEAD', fallbackGit);
  });

  it('surfaces the missing-config error from nx.json', async () => {
    mockGetAffectedGraphNodes.mockResolvedValue(affectedNodes('pkg-a'));

    await expect(
      resolveAffectedReleaseProjects(tree, { targetBranch: 'main' }, gitStub)
    ).rejects.toThrow('nx.json configures no releasable projects');
  });
});

describe('partitionReleasableProjects', () => {
  const entry = (newVersion: string | null, dependents: string[] = []) => ({
    currentVersion: '1.0.0',
    newVersion,
    dependentProjects: dependents.map(source => ({
      source,
      target: 'unused',
      type: 'static',
      dependencyCollection: null,
      rawVersionSpec: null
    }))
  });
  const changelogs = (...projects: string[]) =>
    Object.fromEntries(
      projects.map(project => [
        project,
        { releaseVersion: {}, contents: '## 1.0.1 fixes', postGitTask: null }
      ])
    ) as unknown as Parameters<typeof partitionReleasableProjects>[1];

  it('skips a versioned project with no changelog entries and no released dependency', () => {
    expect(partitionReleasableProjects({ app: entry('1.0.1') }, {})).toEqual({
      released: [],
      skipped: ['app']
    });
  });

  it('releases a project with changelog entries', () => {
    expect(partitionReleasableProjects({ app: entry('1.0.1') }, changelogs('app'))).toEqual({
      released: ['app'],
      skipped: []
    });
  });

  it('treats whitespace-only contents as no entries', () => {
    const empty = { app: { releaseVersion: {}, contents: '  ', postGitTask: null } };

    expect(partitionReleasableProjects({ app: entry('1.0.1') }, empty as never).skipped).toEqual([
      'app'
    ]);
  });

  it('releases a project with no entries when a workspace dependency is released', () => {
    const versionData = { lib: entry('1.0.1', ['app']), app: entry('1.0.1') };

    expect(partitionReleasableProjects(versionData, changelogs('lib'))).toEqual({
      released: ['lib', 'app'],
      skipped: []
    });
  });

  it('follows released dependencies transitively', () => {
    const versionData = {
      lib: entry('1.0.1', ['mid']),
      mid: entry('1.0.1', ['app']),
      app: entry('1.0.1')
    };

    expect(partitionReleasableProjects(versionData, changelogs('lib')).released).toEqual([
      'lib',
      'mid',
      'app'
    ]);
  });

  it('does not release a dependent of a dependency that is itself skipped', () => {
    const versionData = { lib: entry('1.0.1', ['app']), app: entry('1.0.1') };

    expect(partitionReleasableProjects(versionData, {}).skipped).toEqual(['lib', 'app']);
  });

  it('leaves projects Nx did not version out of both lists', () => {
    expect(partitionReleasableProjects({ app: entry(null) }, undefined)).toEqual({
      released: [],
      skipped: []
    });
  });
});

describe('getReleaseCommandOptions', () => {
  it('stages Nx release changes without committing, tagging or pushing', () => {
    expect(getReleaseCommandOptions(false)).toEqual({
      dryRun: false,
      gitCommit: false,
      gitPush: false,
      gitTag: false,
      stageChanges: true
    });
  });

  it('carries the dry-run flag through', () => {
    expect(getReleaseCommandOptions(true).dryRun).toBe(true);
  });
});

describe('selectReleasableProjects', () => {
  const graph = { preview: true } as unknown as Parameters<typeof selectReleasableProjects>[2];
  const versionData = {
    'pkg-a': { currentVersion: '1.0.0', newVersion: '1.1.0', dependentProjects: [] },
    'pkg-b': { currentVersion: '1.0.0', newVersion: '1.0.1', dependentProjects: [] },
    'pkg-c': { currentVersion: '1.0.0', newVersion: null, dependentProjects: [] }
  };
  const changelogsFor = (...projects: string[]) =>
    ({
      projectChangelogs: Object.fromEntries(
        projects.map(project => [
          project,
          { contents: '## 1.1.0 entry', postGitTask: null, releaseVersion: {} }
        ])
      ),
      workspaceChangelog: undefined
    }) as unknown as Awaited<ReturnType<typeof releaseChangelog>>;

  beforeEach(() => {
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  });

  it('previews the changelog as a write-free dry run from the given version data and graph', async () => {
    mockReleaseChangelog.mockResolvedValue(changelogsFor('pkg-a'));

    await selectReleasableProjects(
      { firstRelease: true, projects: ['pkg-a', 'pkg-b'] },
      versionData,
      graph
    );

    expect(mockReleaseChangelog).toHaveBeenCalledWith({
      createRelease: false,
      dryRun: true,
      firstRelease: true,
      gitCommit: false,
      gitPush: false,
      gitTag: false,
      projects: ['pkg-a', 'pkg-b'],
      releaseGraph: graph,
      stageChanges: true,
      verbose: false,
      versionData
    });
  });

  it('keeps projects with changelog entries, skips the rest, and logs each skipped one', async () => {
    mockReleaseChangelog.mockResolvedValue(changelogsFor('pkg-a'));

    await expect(selectReleasableProjects({}, versionData, graph)).resolves.toEqual({
      projects: ['pkg-a'],
      released: ['pkg-a']
    });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Skipping pkg-b'));
  });

  it('returns nothing when every versioned project is skipped', async () => {
    mockReleaseChangelog.mockResolvedValue(changelogsFor());

    await expect(selectReleasableProjects({}, versionData, graph)).resolves.toEqual({
      projects: [],
      released: []
    });
  });

  it('keeps every versioned project and the requested projects when skipChangelog is set', async () => {
    await expect(
      selectReleasableProjects({ projects: ['pkg-a'], skipChangelog: true }, versionData, graph)
    ).resolves.toEqual({ projects: ['pkg-a'], released: ['pkg-a', 'pkg-b'] });
    expect(mockReleaseChangelog).not.toHaveBeenCalled();
  });
});
