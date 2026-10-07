import { gitCommitsBetween, type GitLogEntry } from '@cybertecpty/git-utils';
import type { ProjectChangelogs } from '@cybertecpty/nx-types';
import { createProjectRootMappings, findProjectForPath } from '@cybertecpty/nx-utils';
import { createProjectGraphAsync, type ProjectGraph } from '@nx/devkit';
import simpleGit, { type SimpleGit } from 'simple-git';

import {
  buildReleasePrBody,
  createProjectForFile,
  extractChangelogCommitHashes,
  groupCommitsByProject,
  type ProjectForFile,
  renderReleasePrBody,
  renderWorkspaceChangesSection,
  selectUncoveredCommits,
  WORKSPACE_OTHER_GROUP
} from './release-pr.utils';

jest.mock('@cybertecpty/git-utils', () => ({
  gitCommitsBetween: jest.fn()
}));

jest.mock('@cybertecpty/nx-utils', () => ({
  createProjectRootMappings: jest.fn(),
  findProjectForPath: jest.fn()
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

const mockGitCommitsBetween = jest.mocked(gitCommitsBetween);
const mockCreateProjectRootMappings = jest.mocked(createProjectRootMappings);
const mockFindProjectForPath = jest.mocked(findProjectForPath);
const mockCreateProjectGraphAsync = jest.mocked(createProjectGraphAsync);
const mockSimpleGit = jest.mocked(simpleGit);

const RELEASE_COMMIT_MSG = 'chore(release): generate release artifacts';

/** Builds a `GitLogEntry` with sensible defaults. */
const commit = (over: Partial<GitLogEntry> = {}): GitLogEntry => ({
  files: [],
  hash: '0123456789abcdef0123456789abcdef01234567',
  message: 'feat: do a thing',
  ...over
});

/** Builds a `ProjectChangelogs` map from `{ project: renderedMarkdown }`. */
const changelogs = (entries: Record<string, string>): ProjectChangelogs =>
  Object.fromEntries(
    Object.entries(entries).map(([project, contents]) => [project, { contents }])
  ) as unknown as ProjectChangelogs;

/** A `ProjectForFile` backed by an exact `file -> project` table. */
const route =
  (table: Record<string, string>): ProjectForFile =>
  file =>
    table[file] ?? null;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Pure functions — no I/O, no mocks
// ---------------------------------------------------------------------------

describe('extractChangelogCommitHashes', () => {
  it('returns nothing when there are no changelogs', () => {
    expect(extractChangelogCommitHashes(undefined)).toEqual([]);
  });

  it('returns nothing when no changelog references a commit link', () => {
    expect(
      extractChangelogCommitHashes(changelogs({ 'pkg-a': '### Features\n\n- did a thing' }))
    ).toEqual([]);
  });

  it('pulls the hash out of a `.../commit/<hash>` link', () => {
    expect(
      extractChangelogCommitHashes(
        changelogs({ 'pkg-a': '- feat: thing ([abc1234](https://github.com/o/r/commit/abc1234))' })
      )
    ).toEqual(['abc1234']);
  });

  it('collects hashes from every project changelog', () => {
    expect(
      extractChangelogCommitHashes(
        changelogs({
          'pkg-a': 'see https://github.com/o/r/commit/aaaaaaa and /commit/bbbbbbb',
          'pkg-b': 'https://github.com/o/r/commit/ccccccc'
        })
      )
    ).toEqual(['aaaaaaa', 'bbbbbbb', 'ccccccc']);
  });

  it('accepts abbreviated and full-length hex hashes', () => {
    const full = 'a'.repeat(40);

    expect(
      extractChangelogCommitHashes(changelogs({ 'pkg-a': `/commit/abc123 and /commit/${full}` }))
    ).toEqual(['abc123', full]);
  });

  it('ignores `commit/` fragments that are too short or not hex', () => {
    expect(
      extractChangelogCommitHashes(changelogs({ 'pkg-a': '/commit/abc /commit/ZZZZZZZ' }))
    ).toEqual([]);
  });
});

describe('selectUncoveredCommits', () => {
  it('keeps commits that no changelog covers', () => {
    const commits = [commit({ hash: 'aaaaaaa1' }), commit({ hash: 'bbbbbbb2' })];

    expect(selectUncoveredCommits(commits, [], RELEASE_COMMIT_MSG)).toEqual(commits);
  });

  it('drops commits whose hash a changelog references by short prefix', () => {
    const covered = commit({ hash: 'deadbeefcafe' });
    const kept = commit({ hash: 'feedface0000' });

    expect(selectUncoveredCommits([covered, kept], ['deadbee'], RELEASE_COMMIT_MSG)).toEqual([
      kept
    ]);
  });

  it('drops the generated release commit by its subject line', () => {
    const release = commit({ hash: 'rel00000', message: RELEASE_COMMIT_MSG });
    const kept = commit({ hash: 'work0000', message: 'chore: tidy' });

    expect(selectUncoveredCommits([release, kept], [], RELEASE_COMMIT_MSG)).toEqual([kept]);
  });

  it('returns an empty array when everything is covered or is the release commit', () => {
    const commits = [
      commit({ hash: 'covered0', message: 'feat: x' }),
      commit({ hash: 'rel00000', message: RELEASE_COMMIT_MSG })
    ];

    expect(selectUncoveredCommits(commits, ['covered'], RELEASE_COMMIT_MSG)).toEqual([]);
  });
});

describe('groupCommitsByProject', () => {
  it('returns an empty map when given no commits', () => {
    expect(groupCommitsByProject([], route({}))).toEqual(new Map());
  });

  it('groups a commit under the single project its files belong to', () => {
    const c = commit({ files: ['libs/pkg-a/src/index.ts'] });

    const groups = groupCommitsByProject([c], route({ 'libs/pkg-a/src/index.ts': 'pkg-a' }));

    expect(groups.get('pkg-a')).toEqual([c]);
  });

  it('lists a commit under every project it touches', () => {
    const c = commit({ files: ['libs/pkg-a/x.ts', 'libs/pkg-b/x.ts'] });

    const groups = groupCommitsByProject(
      [c],
      route({ 'libs/pkg-a/x.ts': 'pkg-a', 'libs/pkg-b/x.ts': 'pkg-b' })
    );

    expect(groups.get('pkg-a')).toEqual([c]);
    expect(groups.get('pkg-b')).toEqual([c]);
  });

  it('attributes a commit to a project once even when several of its files map there', () => {
    const c = commit({ files: ['libs/pkg-a/one.ts', 'libs/pkg-a/two.ts'] });

    const groups = groupCommitsByProject(
      [c],
      route({ 'libs/pkg-a/one.ts': 'pkg-a', 'libs/pkg-a/two.ts': 'pkg-a' })
    );

    expect(groups.get('pkg-a')).toEqual([c]);
  });

  it('collects commits whose files belong to no project under the catch-all group', () => {
    const c = commit({ files: ['README.md', 'docs/adr/0001.md'] });

    const groups = groupCommitsByProject([c], route({}));

    expect(groups.get(WORKSPACE_OTHER_GROUP)).toEqual([c]);
  });

  it('does not repeat a project-attributed commit under the catch-all group', () => {
    const c = commit({ files: ['libs/pkg-a/index.ts', 'README.md'] });

    const groups = groupCommitsByProject([c], route({ 'libs/pkg-a/index.ts': 'pkg-a' }));

    expect(groups.get('pkg-a')).toEqual([c]);
    expect(groups.has(WORKSPACE_OTHER_GROUP)).toBe(false);
  });

  it('keeps every commit that lands in the same group, in input order', () => {
    const first = commit({ hash: 'aaaaaaa1', files: ['libs/pkg-a/index.ts'] });
    const second = commit({ hash: 'bbbbbbb2', files: ['libs/pkg-a/index.ts'] });

    const groups = groupCommitsByProject(
      [first, second],
      route({ 'libs/pkg-a/index.ts': 'pkg-a' })
    );

    expect(groups.get('pkg-a')).toEqual([first, second]);
  });

  it('orders named project groups alphabetically with the catch-all group last', () => {
    // First-seen order is pkg-b, other, pkg-a — so the sort has to move both a
    // named group and the catch-all group past their neighbours.
    const commits = [
      commit({ hash: 'pkgb001', files: ['libs/pkg-b/x.ts'] }),
      commit({ hash: 'other01', files: ['README.md'] }),
      commit({ hash: 'pkga001', files: ['libs/pkg-a/x.ts'] })
    ];

    const groups = groupCommitsByProject(
      commits,
      route({ 'libs/pkg-b/x.ts': 'pkg-b', 'libs/pkg-a/x.ts': 'pkg-a' })
    );

    expect([...groups.keys()]).toEqual(['pkg-a', 'pkg-b', WORKSPACE_OTHER_GROUP]);
  });
});

describe('renderWorkspaceChangesSection', () => {
  it('returns null for an empty group map', () => {
    expect(renderWorkspaceChangesSection(new Map())).toBeNull();
  });

  it('renders one sub-section per group with short-hash bullet lines', () => {
    const groups = new Map<string, GitLogEntry[]>([
      ['pkg-a', [commit({ hash: 'abcdef1234', message: 'fix(pkg-a): a bug' })]],
      [WORKSPACE_OTHER_GROUP, [commit({ hash: '9876543210', message: 'docs: update readme' })]]
    ]);

    expect(renderWorkspaceChangesSection(groups)).toBe(
      [
        '## Workspace changes',
        '',
        '### pkg-a',
        '',
        '- fix(pkg-a): a bug (abcdef1)',
        '',
        '### other',
        '',
        '- docs: update readme (9876543)'
      ].join('\n')
    );
  });
});

describe('renderReleasePrBody', () => {
  it('renders one section per project changelog', () => {
    expect(
      renderReleasePrBody(
        changelogs({ 'pkg-a': '### Features\n\n- a', 'pkg-b': '### Fixes\n\n- b' }),
        null
      )
    ).toBe('## pkg-a\n\n### Features\n\n- a\n\n## pkg-b\n\n### Fixes\n\n- b');
  });

  it('appends the workspace section when one is given', () => {
    expect(
      renderReleasePrBody(
        changelogs({ 'pkg-a': '### Features\n\n- a' }),
        '## Workspace changes\n\n- x'
      )
    ).toBe('## pkg-a\n\n### Features\n\n- a\n\n## Workspace changes\n\n- x');
  });

  it('returns just the workspace section when there are no changelogs', () => {
    expect(renderReleasePrBody(undefined, '## Workspace changes\n\n- x')).toBe(
      '## Workspace changes\n\n- x'
    );
  });

  it('falls back to a placeholder when there is nothing to report', () => {
    expect(renderReleasePrBody({}, null)).toBe('This release contains no changelog entries.');
  });
});

// ---------------------------------------------------------------------------
// I/O boundary — the graph read and the git range
// ---------------------------------------------------------------------------

describe('createProjectForFile', () => {
  it('resolves a file to its project through the graph root mappings', async () => {
    const graph = { nodes: { 'pkg-a': {} }, dependencies: {} } as unknown as ProjectGraph;
    const mappings = new Map([['libs/pkg-a', 'pkg-a']]);
    mockCreateProjectGraphAsync.mockResolvedValue(graph);
    mockCreateProjectRootMappings.mockReturnValue(mappings);
    mockFindProjectForPath.mockReturnValue('pkg-a');

    const projectForFile = await createProjectForFile();

    expect(projectForFile('libs/pkg-a/src/index.ts')).toBe('pkg-a');
    expect(mockCreateProjectRootMappings).toHaveBeenCalledWith(graph.nodes);
    expect(mockFindProjectForPath).toHaveBeenCalledWith('libs/pkg-a/src/index.ts', mappings);
  });

  it('passes through a null result for an unowned file', async () => {
    mockCreateProjectGraphAsync.mockResolvedValue({ nodes: {}, dependencies: {} });
    mockCreateProjectRootMappings.mockReturnValue(new Map());
    mockFindProjectForPath.mockReturnValue(null);

    const projectForFile = await createProjectForFile();

    expect(projectForFile('README.md')).toBeNull();
  });
});

describe('buildReleasePrBody', () => {
  const baseOptions = {
    projectChangelogs: undefined as ProjectChangelogs | undefined,
    releaseBranch: 'release/2026-09-10',
    releaseCommitMessage: RELEASE_COMMIT_MSG,
    targetBranch: 'main'
  };

  beforeEach(() => {
    mockGitCommitsBetween.mockResolvedValue([]);
    mockCreateProjectGraphAsync.mockResolvedValue({ nodes: {}, dependencies: {} });
    mockCreateProjectRootMappings.mockReturnValue(new Map());
    mockFindProjectForPath.mockReturnValue(null);
  });

  it('reads the commit range from the remote target branch to the release branch', async () => {
    const gitStub = {} as SimpleGit;

    await buildReleasePrBody({ ...baseOptions, git: gitStub });

    expect(mockGitCommitsBetween).toHaveBeenCalledWith(
      'origin/main',
      'release/2026-09-10',
      gitStub
    );
  });

  it('falls back to simpleGit() when no client is passed', async () => {
    const fallbackGit = {} as SimpleGit;
    mockSimpleGit.mockReturnValue(fallbackGit);

    await buildReleasePrBody(baseOptions);

    expect(mockGitCommitsBetween).toHaveBeenCalledWith(
      'origin/main',
      'release/2026-09-10',
      fallbackGit
    );
  });

  it('renders changelog sections and skips the workspace section when the range is empty', async () => {
    const body = await buildReleasePrBody({
      ...baseOptions,
      projectChangelogs: changelogs({ 'pkg-a': '### Features\n\n- a' })
    });

    expect(body).toBe('## pkg-a\n\n### Features\n\n- a');
    expect(mockCreateProjectGraphAsync).not.toHaveBeenCalled();
  });

  it('skips the workspace section when every commit is changelog-covered', async () => {
    mockGitCommitsBetween.mockResolvedValue([commit({ hash: 'abc1234def' })]);

    const body = await buildReleasePrBody({
      ...baseOptions,
      projectChangelogs: changelogs({
        'pkg-a': '- feat ([abc1234](https://github.com/o/r/commit/abc1234))'
      })
    });

    expect(body).toBe('## pkg-a\n\n- feat ([abc1234](https://github.com/o/r/commit/abc1234))');
  });

  it('appends a workspace section built from the uncovered commits', async () => {
    mockGitCommitsBetween.mockResolvedValue([
      commit({ hash: 'abcdef1234', message: 'chore: tidy', files: ['README.md'] })
    ]);

    const body = await buildReleasePrBody({
      ...baseOptions,
      projectChangelogs: changelogs({ 'pkg-a': '### Features\n\n- a' })
    });

    expect(body).toBe(
      '## pkg-a\n\n### Features\n\n- a\n\n## Workspace changes\n\n### other\n\n- chore: tidy (abcdef1)'
    );
  });

  it('groups uncovered commits by the project their files touch', async () => {
    mockGitCommitsBetween.mockResolvedValue([
      commit({ hash: 'abcdef1234', message: 'fix(pkg-a): bug', files: ['libs/pkg-a/src/index.ts'] })
    ]);
    mockFindProjectForPath.mockReturnValue('pkg-a');

    const body = await buildReleasePrBody(baseOptions);

    expect(body).toBe('## Workspace changes\n\n### pkg-a\n\n- fix(pkg-a): bug (abcdef1)');
  });

  it('falls back to the placeholder when nothing is covered and nothing is left over', async () => {
    await expect(buildReleasePrBody({ ...baseOptions, projectChangelogs: {} })).resolves.toBe(
      'This release contains no changelog entries.'
    );
  });
});
