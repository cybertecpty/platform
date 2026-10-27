import { escapeRegExp, wildcardToRegExp } from './regexp.utils';

describe('escapeRegExp', () => {
  it('returns text without special characters unchanged', () => {
    expect(escapeRegExp('plain-text_123')).toBe('plain-text_123');
  });

  it('returns an empty string unchanged', () => {
    expect(escapeRegExp('')).toBe('');
  });

  it.each([
    ['.', '\\.'],
    ['*', '\\*'],
    ['+', '\\+'],
    ['?', '\\?'],
    ['^', '\\^'],
    ['$', '\\$'],
    ['{', '\\{'],
    ['}', '\\}'],
    ['(', '\\('],
    [')', '\\)'],
    ['|', '\\|'],
    ['[', '\\['],
    [']', '\\]'],
    ['\\', '\\\\']
  ])('puts a backslash in front of %s', (character, escaped) => {
    expect(escapeRegExp(character)).toBe(escaped);
  });

  it('does not escape a hyphen, which is only special inside a character class', () => {
    expect(escapeRegExp('a-b')).toBe('a-b');
  });

  it('escapes every special character in a longer string', () => {
    expect(escapeRegExp('libs/*/utils (v1.0)')).toBe('libs/\\*/utils \\(v1\\.0\\)');
  });

  it('escapes the same character each time it appears', () => {
    expect(escapeRegExp('a.b.c')).toBe('a\\.b\\.c');
  });

  describe('as part of a regular expression', () => {
    const anchored = (value: string): RegExp => new RegExp(`^${escapeRegExp(value)}$`);

    it.each(['a.b', 'type:*', 'libs/*/utils', '(x|y)+', '[a]', '\\', '^start$', '{2}', 'a-b'])(
      'matches the original text %p',
      value => {
        expect(anchored(value).test(value)).toBe(true);
      }
    );

    it('treats a dot as a literal dot, not any character', () => {
      expect(anchored('a.b').test('aXb')).toBe(false);
    });

    it('treats a star as a literal star, not a repetition', () => {
      expect(anchored('a*').test('aaa')).toBe(false);
    });

    it('treats alternation characters as literal text', () => {
      expect(anchored('x|y').test('x')).toBe(false);
    });

    it('treats anchors as literal text', () => {
      expect(anchored('^a$').test('a')).toBe(false);
    });
  });
});

describe('wildcardToRegExp', () => {
  describe('matching a trailing wildcard', () => {
    it.each(['type:api', 'type:data-access', 'type:'])('matches %p against type:*', value => {
      expect(wildcardToRegExp('type:*').test(value)).toBe(true);
    });

    it.each(['scope:backend', 'type', 'my-type:api'])('does not match %p against type:*', value => {
      expect(wildcardToRegExp('type:*').test(value)).toBe(false);
    });
  });

  describe('matching a bare wildcard', () => {
    it.each(['anything at all', 'type:api', 'libs/a/b', ''])('matches %p against *', value => {
      expect(wildcardToRegExp('*').test(value)).toBe(true);
    });
  });

  describe('matching a wildcard inside the pattern', () => {
    it('matches the text between the fixed parts', () => {
      expect(wildcardToRegExp('libs/*/utils').test('libs/shared/utils')).toBe(true);
    });

    it('lets a wildcard match nothing', () => {
      expect(wildcardToRegExp('libs/*utils').test('libs/utils')).toBe(true);
    });

    it('lets a wildcard match across slashes, unlike a glob', () => {
      expect(wildcardToRegExp('libs/*/utils').test('libs/a/b/utils')).toBe(true);
    });

    it('requires the fixed parts on both sides to be present', () => {
      const pattern = wildcardToRegExp('libs/*/utils');

      expect(pattern.test('libs/shared')).toBe(false);
      expect(pattern.test('shared/utils')).toBe(false);
    });

    it('handles several wildcards', () => {
      const pattern = wildcardToRegExp('a*b*c');

      expect(pattern.test('aXbYc')).toBe(true);
      expect(pattern.test('abc')).toBe(true);
      expect(pattern.test('aXbY')).toBe(false);
    });

    it('treats consecutive wildcards like a single one', () => {
      const pattern = wildcardToRegExp('a**b');

      expect(pattern.test('ab')).toBe(true);
      expect(pattern.test('aXYb')).toBe(true);
      expect(pattern.test('aXY')).toBe(false);
    });

    it('matches a scoped package pattern', () => {
      const pattern = wildcardToRegExp('@scope/*');

      expect(pattern.test('@scope/pkg')).toBe(true);
      expect(pattern.test('@other/pkg')).toBe(false);
    });
  });

  describe('matching a pattern without wildcards', () => {
    it('matches only the identical string', () => {
      const pattern = wildcardToRegExp('exact');

      expect(pattern.test('exact')).toBe(true);
      expect(pattern.test('exactly')).toBe(false);
      expect(pattern.test('not exact')).toBe(false);
    });

    it('matches only the empty string for an empty pattern', () => {
      const pattern = wildcardToRegExp('');

      expect(pattern.test('')).toBe(true);
      expect(pattern.test('x')).toBe(false);
    });
  });

  describe('special characters other than the wildcard', () => {
    it('treats a dot as a literal dot, not any character', () => {
      const pattern = wildcardToRegExp('a.b');

      expect(pattern.test('a.b')).toBe(true);
      expect(pattern.test('aXb')).toBe(false);
    });

    it.each(['(x|y)+', '[a]', '^start$', '{2}', 'a?b'])(
      'matches %p only as literal text',
      value => {
        const pattern = wildcardToRegExp(value);

        expect(pattern.test(value)).toBe(true);
        expect(pattern.test(`${value}${value}`)).toBe(false);
      }
    );

    it('treats a question mark as literal text, not a single-character wildcard', () => {
      expect(wildcardToRegExp('a?c').test('abc')).toBe(false);
    });

    it('keeps a backslash literal and still treats the following star as a wildcard', () => {
      const pattern = wildcardToRegExp('\\*');

      expect(pattern.test('\\')).toBe(true);
      expect(pattern.test('\\anything')).toBe(true);
      expect(pattern.test('anything')).toBe(false);
    });
  });

  describe('the returned regular expression', () => {
    it('has no flags, so reusing it keeps no state between calls', () => {
      const pattern = wildcardToRegExp('type:*');

      expect(pattern.flags).toBe('');
      expect(pattern.test('type:api')).toBe(true);
      expect(pattern.test('type:api')).toBe(true);
      expect(pattern.test('scope:api')).toBe(false);
    });

    it('does not let a wildcard match a line break', () => {
      expect(wildcardToRegExp('type:*').test('type:a\nb')).toBe(false);
    });
  });
});
