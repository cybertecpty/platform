import { gitMergeBase } from '@cybertecpty/git-utils';
import { findMatchingProjects, getAffectedGraphNodes } from '@cybertecpty/nx-utils';
import {
  createProjectGraphAsync,
  readNxJson,
  updateNxJson,
  type NxJsonConfiguration,
  type ProjectGraph,
  type Tree
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import simpleGit, { type SimpleGit } from 'simple-git';

import {
  readReleasePatterns,
  resolveAffectedBase,
  resolveAffectedReleaseProjects,
  resolveReleaseProjects,
  selectAffectedReleaseProjects
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
  const graph = { nodes: { 'pkg-a': {}, 'pkg-b': {} } } as unknown as ProjectGraph;

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
    const graph = { nodes: { 'pkg-a': {} }, dependencies: {} } as unknown as ProjectGraph;
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
