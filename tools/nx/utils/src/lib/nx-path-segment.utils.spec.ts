import { assertValidPathSegment, PATH_SEGMENT_PATTERN } from './nx-path-segment.utils';

describe('PATH_SEGMENT_PATTERN', () => {
  it.each(['release', 'release-manifest', 'e2e', '1password'])('matches `%s`', value => {
    expect(PATH_SEGMENT_PATTERN.test(value)).toBe(true);
  });

  it.each(['', 'Release', 'release/manifest', '-release', 'release-', 'release--manifest'])(
    'does not match `%s`',
    value => {
      expect(PATH_SEGMENT_PATTERN.test(value)).toBe(false);
    }
  );
});

describe('assertValidPathSegment', () => {
  it('accepts a lowercase single word', () => {
    expect(() => assertValidPathSegment('release', 'directory')).not.toThrow();
  });

  it('accepts lowercase words joined by single hyphens', () => {
    expect(() => assertValidPathSegment('release-manifest', 'directory')).not.toThrow();
  });

  it('throws for an empty string, naming the option', () => {
    expect(() => assertValidPathSegment('', 'directory')).toThrow(
      '`directory` segment "" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for an uppercase segment', () => {
    expect(() => assertValidPathSegment('Release', 'directory')).toThrow(
      '`directory` segment "Release" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for a slash-separated value', () => {
    expect(() => assertValidPathSegment('release/manifest', 'directory')).toThrow(
      '`directory` segment "release/manifest" must be lowercase alphanumeric words joined by single hyphens.'
    );
  });

  it('throws for leading, trailing, or doubled hyphens', () => {
    expect(() => assertValidPathSegment('-release', 'directory')).toThrow();
    expect(() => assertValidPathSegment('release-', 'directory')).toThrow();
    expect(() => assertValidPathSegment('release--manifest', 'directory')).toThrow();
  });
});
