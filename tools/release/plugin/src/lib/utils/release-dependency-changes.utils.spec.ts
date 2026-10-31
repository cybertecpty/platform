import { createGitRepoFixture, type GitRepoFixture } from '@cybertecpty/git-testing';
import { createDependencyGraphFixture, createProjectNodeFixture } from '@cybertecpty/nx-testing';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  collectDependencyRoots,
  findDependencyChanges,
  releaseTagGlob,
  type ConventionalCommitTypes
} from './release-dependency-changes.utils';

const commitTypes: ConventionalCommitTypes = {
  chore: { changelog: { hidden: true } },
  feat: { changelog: { hidden: false } },
  fix: { changelog: { hidden: false } },
  off: { changelog: false }
};

const TAG_PATTERN = '{projectName}@{version}';

const graph = createDependencyGraphFixture(
  [
    createProjectNodeFixture({ name: 'web', root: 'apps/web', type: 'app' }),
    createProjectNodeFixture({ name: 'ui', root: 'libs/ui' }),
    createProjectNodeFixture({ name: 'core', root: 'libs/core' }),
    createProjectNodeFixture({ name: 'unrelated', root: 'libs/unrelated' })
  ],
  [
    ['web', 'ui'],
    ['ui', 'core'],
    ['web', 'npm:react']
  ]
);

describe('collectDependencyRoots', () => {
  it('follows workspace dependencies transitively and skips external packages', () => {
    expect(collectDependencyRoots(graph, 'web')).toEqual(['libs/ui', 'libs/core']);
  });

  it('returns nothing for a project that depends on nothing', () => {
    expect(collectDependencyRoots(graph, 'unrelated')).toEqual([]);
  });

  it('survives a dependency cycle', () => {
    const cyclic = createDependencyGraphFixture(
      [
        createProjectNodeFixture({ name: 'a', root: 'apps/a', type: 'app' }),
        createProjectNodeFixture({ name: 'b', root: 'libs/b' })
      ],
      [
        ['a', 'b'],
        ['b', 'a']
      ]
    );

    expect(collectDependencyRoots(cyclic, 'a')).toEqual(['libs/b']);
  });
});

describe('releaseTagGlob', () => {
  it('fills in the project and matches any version', () => {
    expect(releaseTagGlob('{projectName}@{version}', 'web')).toBe('web@*');
  });

  it('matches any release group and keeps the rest of a custom pattern', () => {
    expect(releaseTagGlob('{releaseGroupName}/{projectName}-v{version}', 'web')).toBe('*/web-v*');
  });
});

describe('findDependencyChanges', () => {
  let repo: GitRepoFixture;

  const commitFile = async (file: string, message: string): Promise<string> => {
    mkdirSync(dirname(join(repo.dir, file)), { recursive: true });
    writeFileSync(join(repo.dir, file), message);
    await repo.git.add(file);
    await repo.git.commit(message);

    return (await repo.git.revparse(['HEAD'])).trim();
  };

  const find = (knownHashes: string[] = [], project = 'web', releaseTagPattern = TAG_PATTERN) =>
    findDependencyChanges(
      { commitTypes, knownHashes, project, projectGraph: graph, releaseTagPattern },
      repo.git
    );

  beforeEach(async () => {
    repo = await createGitRepoFixture();
  });

  afterEach(() => {
    repo.cleanup();
  });

  it('lists a library commit since the last release as a change to the project', async () => {
    await commitFile('apps/web/main.ts', 'feat: first');
    await repo.git.addAnnotatedTag('web@1.0.0', 'web@1.0.0');
    const hash = await commitFile('libs/ui/button.ts', 'fix(ui): align the button');

    await expect(find()).resolves.toEqual([
      {
        affectedProjects: ['web'],
        authors: [],
        body: '',
        description: 'align the button',
        githubReferences: [],
        isBreaking: false,
        scope: 'ui',
        shortHash: hash.slice(0, 7),
        type: 'fix'
      }
    ]);
  });

  it('finds the last release through a custom tag pattern', async () => {
    await commitFile('libs/ui/old.ts', 'fix(ui): already released');
    await repo.git.addAnnotatedTag('release-web-1.0.0', 'release-web-1.0.0');
    await commitFile('libs/ui/new.ts', 'fix(ui): not yet released');

    await expect(find([], 'web', 'release-{projectName}-{version}')).resolves.toMatchObject([
      { description: 'not yet released' }
    ]);
  });

  it('reaches a library the project depends on only through another library', async () => {
    await commitFile('apps/web/main.ts', 'feat: first');
    await repo.git.addAnnotatedTag('web@1.0.0', 'web@1.0.0');
    await commitFile('libs/core/state.ts', 'feat(core): add state');

    await expect(find()).resolves.toMatchObject([{ scope: 'core', type: 'feat' }]);
  });

  it('leaves out commits before the last release', async () => {
    await commitFile('libs/ui/old.ts', 'fix(ui): already released');
    await repo.git.addAnnotatedTag('web@1.0.0', 'web@1.0.0');

    await expect(find()).resolves.toEqual([]);
  });

  it('reads the whole history when the project was never released', async () => {
    await commitFile('libs/ui/button.ts', 'fix(ui): align the button');

    await expect(find()).resolves.toMatchObject([{ description: 'align the button' }]);
  });

  it('leaves out commits to libraries the project does not depend on', async () => {
    await commitFile('libs/unrelated/x.ts', 'fix(unrelated): something');

    await expect(find()).resolves.toEqual([]);
  });

  it('leaves out a library path that only shares a name prefix', async () => {
    await commitFile('libs/ui-extra/x.ts', 'fix: something');

    await expect(find()).resolves.toEqual([]);
  });

  it('leaves out commits the changelog already lists', async () => {
    const hash = await commitFile('libs/ui/button.ts', 'fix(ui): align the button');

    await expect(find([hash.slice(0, 7)])).resolves.toEqual([]);
  });

  it('leaves out hidden, disabled, unknown and non-conventional commits', async () => {
    await commitFile('libs/ui/a.ts', 'chore(ui): tidy');
    await commitFile('libs/ui/b.ts', 'off(ui): disabled type');
    await commitFile('libs/ui/c.ts', 'wibble(ui): unknown type');
    await commitFile('libs/ui/d.ts', 'not a conventional commit');

    await expect(find()).resolves.toEqual([]);
  });

  it('marks a breaking commit and handles a missing scope', async () => {
    await commitFile('libs/ui/a.ts', 'feat!: drop the old api');

    await expect(find()).resolves.toMatchObject([{ isBreaking: true, scope: '' }]);
  });

  it('finds nothing for a project with no workspace dependencies', async () => {
    await commitFile('libs/ui/a.ts', 'fix(ui): x');

    await expect(find([], 'unrelated')).resolves.toEqual([]);
  });
});
