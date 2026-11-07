import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEFAULT_RELEASE_TAG_PATTERN,
  formatReleaseTag,
  readReleaseTagPattern,
  toReleaseTagGlob
} from './release-tags.utils';

describe('readReleaseTagPattern', () => {
  let root: string;

  const writeNxJson = (config: object) =>
    writeFileSync(join(root, 'nx.json'), JSON.stringify(config));

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'release-tags-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reads the configured pattern', () => {
    writeNxJson({ release: { releaseTag: { pattern: 'v{version}-{projectName}' } } });

    expect(readReleaseTagPattern(root)).toBe('v{version}-{projectName}');
  });

  it("falls back to Nx's default when no pattern is set", () => {
    writeNxJson({ release: {} });

    expect(readReleaseTagPattern(root)).toBe(DEFAULT_RELEASE_TAG_PATTERN);
  });

  it('falls back when nx.json has no release config', () => {
    writeNxJson({});

    expect(readReleaseTagPattern(root)).toBe('{projectName}@{version}');
  });
});

describe('formatReleaseTag', () => {
  it('fills in the project and version', () => {
    expect(formatReleaseTag('{projectName}@{version}', 'web', '1.2.3')).toBe('web@1.2.3');
  });

  it('follows a custom pattern', () => {
    expect(formatReleaseTag('release-{version}/{projectName}', 'web', '1.2.3')).toBe(
      'release-1.2.3/web'
    );
  });

  it('refuses a pattern with a placeholder it cannot fill', () => {
    expect(() =>
      formatReleaseTag('{releaseGroupName}/{projectName}-{version}', 'web', '1.0.0')
    ).toThrow('{releaseGroupName}');
  });
});

describe('toReleaseTagGlob', () => {
  it('fills in the project and matches any version', () => {
    expect(toReleaseTagGlob('{projectName}@{version}', 'web')).toBe('web@*');
  });

  it('matches any release group and keeps the rest of a custom pattern', () => {
    expect(toReleaseTagGlob('{releaseGroupName}/{projectName}-v{version}', 'web')).toBe('*/web-v*');
  });
});
