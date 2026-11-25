import {
  isReleaseType,
  pickVersionData,
  resolveProjectReleaseType,
  resolveWorkspaceReleaseType
} from './release-versions';

const entry = (newVersion: string | null, currentVersion = '1.0.0') => ({
  currentVersion,
  newVersion,
  dependentProjects: []
});

describe('isReleaseType', () => {
  it.each(['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'])(
    'accepts %s',
    value => {
      expect(isReleaseType(value)).toBe(true);
    }
  );

  it.each(['', 'Major', 'latest', '1.0.0'])('rejects %j', value => {
    expect(isReleaseType(value)).toBe(false);
  });
});

describe('pickVersionData', () => {
  const versionData = { a: entry('1.1.0'), b: entry('1.0.1'), c: entry(null) };

  it('keeps only the named projects, as Nx produced them', () => {
    expect(pickVersionData(versionData, ['a', 'c'])).toEqual({
      a: versionData.a,
      c: versionData.c
    });
  });

  it('returns nothing for no projects', () => {
    expect(pickVersionData(versionData, [])).toEqual({});
  });
});

describe('resolveProjectReleaseType', () => {
  it.each([
    ['1.0.0', '2.0.0', 'major'],
    ['1.0.0', '1.1.0', 'minor'],
    ['1.0.0', '1.0.1', 'patch']
  ] as const)('maps %s to %s as %s', (current, next, expected) => {
    expect(resolveProjectReleaseType(current, next)).toBe(expected);
  });

  it('returns null when the project has no new version', () => {
    expect(resolveProjectReleaseType('1.0.0', null)).toBeNull();
  });

  it('returns null when the version does not change', () => {
    expect(resolveProjectReleaseType('1.0.0', '1.0.0')).toBeNull();
  });

  it.each(['2.0.0-beta.0', '1.1.0-beta.0', '1.0.1-beta.0'])(
    'returns null for the prerelease %s',
    next => {
      expect(resolveProjectReleaseType('1.0.0', next)).toBeNull();
    }
  );
});

describe('resolveWorkspaceReleaseType', () => {
  it('returns null for no projects', () => {
    expect(resolveWorkspaceReleaseType({})).toBeNull();
  });

  it('returns null when no project changes', () => {
    expect(resolveWorkspaceReleaseType({ a: entry(null), b: entry('1.0.0') })).toBeNull();
  });

  it('returns patch when the largest change is a patch', () => {
    expect(resolveWorkspaceReleaseType({ a: entry(null), b: entry('1.0.1') })).toBe('patch');
  });

  it('returns minor over patch', () => {
    expect(resolveWorkspaceReleaseType({ a: entry('1.0.1'), b: entry('1.1.0') })).toBe('minor');
  });

  it('returns major over minor and patch', () => {
    expect(
      resolveWorkspaceReleaseType({ a: entry('1.0.1'), b: entry('1.1.0'), c: entry('2.0.0') })
    ).toBe('major');
  });

  it('ignores prerelease changes', () => {
    expect(resolveWorkspaceReleaseType({ a: entry('2.0.0-beta.0'), b: entry('1.0.1') })).toBe(
      'patch'
    );
  });
});
