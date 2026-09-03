import { gitTagsMatching } from '@cybertecpty/git-utils';

import { getLatestProjectVersion, getProjectVersions } from './project-version';

jest.mock('@cybertecpty/git-utils', () => ({
  gitTagsMatching: jest.fn()
}));

const mockGitTagsMatching = gitTagsMatching as jest.MockedFunction<typeof gitTagsMatching>;

const withTags = (tags: string[]) => mockGitTagsMatching.mockResolvedValue(tags);

beforeEach(() => {
  mockGitTagsMatching.mockReset();
});

describe('getProjectVersions', () => {
  it('queries tags with the `project@` prefix', async () => {
    withTags([]);

    await getProjectVersions('release-utils');

    expect(mockGitTagsMatching).toHaveBeenCalledWith('release-utils@');
  });

  it('returns the matching versions newest first by default', async () => {
    withTags(['release-utils@1.0.0', 'release-utils@2.1.0', 'release-utils@2.0.0']);

    await expect(getProjectVersions('release-utils')).resolves.toEqual(['2.1.0', '2.0.0', '1.0.0']);
  });

  it('sorts ascending when asked', async () => {
    withTags(['release-utils@2.0.0', 'release-utils@1.0.0']);

    await expect(getProjectVersions('release-utils', 'asc')).resolves.toEqual(['1.0.0', '2.0.0']);
  });

  it('ignores tags for another project that merely contains the name as a substring', async () => {
    withTags(['release-utils@2.0.0', 'graphql-release-utils@9.9.9', 'release-utils-extra@5.0.0']);

    await expect(getProjectVersions('release-utils')).resolves.toEqual(['2.0.0']);
  });

  it('drops matched tags whose version is not valid semver', async () => {
    withTags([
      'release-utils@1.2.0',
      'release-utils-v2-migration',
      'release-utils@latest',
      'release-utils@2.0'
    ]);

    await expect(getProjectVersions('release-utils')).resolves.toEqual(['1.2.0']);
  });
});

describe('getLatestProjectVersion', () => {
  it('returns the newest matching version', async () => {
    withTags(['release-utils@1.0.0', 'release-utils@1.3.0', 'release-utils@1.2.0']);

    await expect(getLatestProjectVersion('release-utils')).resolves.toBe('1.3.0');
  });

  it('returns undefined when no versions match', async () => {
    withTags([]);

    await expect(getLatestProjectVersion('release-utils')).resolves.toBeUndefined();
  });
});
