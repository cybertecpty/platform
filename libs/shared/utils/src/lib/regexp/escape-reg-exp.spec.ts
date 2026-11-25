import { escapeRegExp } from './escape-reg-exp';

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
