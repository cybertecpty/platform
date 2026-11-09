import { createProjectGraphAsync, readJsonFile, type ProjectGraph } from '@nx/devkit';
import type { ChangelogChange } from 'nx/release/changelog-renderer';
import { vi } from 'vitest';

import { findDependencyChanges } from '../utils/release-dependency-changes.utils';
import DependencyChangelogRenderer from './dependency-changelog-renderer';

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual('@nx/devkit')),
  createProjectGraphAsync: vi.fn(),
  readJsonFile: vi.fn()
}));

vi.mock('../utils/release-dependency-changes.utils', () => ({
  findDependencyChanges: vi.fn()
}));

const mockFindDependencyChanges = vi.mocked(findDependencyChanges);
const projectGraph = { dependencies: {}, nodes: {} } as ProjectGraph;

const commitTypes = {
  fix: { changelog: { hidden: false, title: '### Fixes' } }
};

const fix = (description: string, shortHash: string): ChangelogChange => ({
  affectedProjects: ['web'],
  description,
  scope: 'ui',
  shortHash,
  type: 'fix'
});

const render = (project: string | null, changes: ChangelogChange[]): Promise<string> =>
  new DependencyChangelogRenderer({
    changelogEntryVersion: '1.0.1',
    changelogRenderOptions: { authors: false, versionTitleDate: false },
    changes,
    conventionalCommitsConfig: { types: commitTypes },
    entryWhenNoChanges: false,
    isVersionPlans: false,
    project,
    remoteReleaseClient: { getRemoteRepoData: () => null }
  } as unknown as ConstructorParameters<typeof DependencyChangelogRenderer>[0]).render();

beforeEach(() => {
  vi.mocked(createProjectGraphAsync).mockResolvedValue(projectGraph);
  vi.mocked(readJsonFile).mockReturnValue({
    release: { releaseTag: { pattern: '{projectName}@{version}' } }
  });
});

describe('DependencyChangelogRenderer', () => {
  it('lists the dependency changes beside the project’s own and passes their hashes along', async () => {
    mockFindDependencyChanges.mockResolvedValue([fix('from a library', 'bbbbbbb')]);

    const contents = await render('web', [fix('in the app', 'aaaaaaa')]);

    expect(mockFindDependencyChanges).toHaveBeenCalledWith({
      commitTypes,
      knownHashes: ['aaaaaaa'],
      project: 'web',
      projectGraph,
      releaseTagPattern: '{projectName}@{version}'
    });
    expect(contents).toContain('in the app');
    expect(contents).toContain('from a library');
  });

  it('renders an entry for a project whose only change is a dependency’s', async () => {
    mockFindDependencyChanges.mockResolvedValue([fix('from a library', 'bbbbbbb')]);

    await expect(render('web', [])).resolves.toContain('from a library');
  });

  it('stays empty when no dependency changed', async () => {
    mockFindDependencyChanges.mockResolvedValue([]);

    await expect(render('web', [])).resolves.toBe('');
  });

  it('leaves the workspace changelog alone', async () => {
    mockFindDependencyChanges.mockClear();

    await render(null, [fix('in the app', 'aaaaaaa')]);

    expect(mockFindDependencyChanges).not.toHaveBeenCalled();
  });
});
