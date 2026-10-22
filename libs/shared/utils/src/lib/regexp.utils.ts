/**
 * Matches every character that has a special meaning in a regular expression:
 * `. * + ? ^ $ { } ( ) | [ ] \`.
 *
 * `-` is not in the set. It is only special inside a character class, and the result of
 * `escapeRegExp` is meant to be placed outside one.
 */
const REGEXP_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

/**
 * Escapes `value` so a regular expression built from it matches that exact text.
 *
 * Every special character gets a backslash in front of it, so `a.b` becomes `a\.b` and matches
 * only a literal dot, not any character. Use it whenever literal text, such as a tag, a path or
 * a user-supplied name, ends up inside a `RegExp`.
 *
 * Do not use the result inside a character class (`[...]`), where `-` and `^` have a different
 * meaning.
 *
 * @param value - Literal text to match.
 * @returns `value` with each regular-expression special character escaped.
 */
export function escapeRegExp(value: string): string {
  // `$&` in the replacement stands for the whole match, so each special character is replaced by
  // a backslash followed by itself.
  return value.replace(REGEXP_SPECIAL_CHARS, '\\$&');
}

/**
 * Builds a regular expression from a wildcard pattern, for matching a whole string against it.
 *
 * `*` is the only special character. It matches any run of characters, including none, and
 * including `/`, so `libs/*` matches `libs/a/b`. This is not glob matching: there is no `?`,
 * `[...]`, `{a,b}` or `**` with a meaning of its own, and every other character, including the
 * ones that are special in a regular expression, matches only itself.
 *
 * The expression is anchored at both ends, so `@scope/*` matches `@scope/pkg` but not
 * `x@scope/pkg`, and a pattern with no `*` matches only that exact string. It has no flags, so
 * `.test` keeps no state between calls and one instance can be reused for many values. Because
 * the `s` flag is not set, `*` does not match a line break.
 *
 * @example
 * wildcardToRegExp('src/*.spec.ts').test('src/a/b.spec.ts'); // true
 * wildcardToRegExp('@scope/*').test('@other/pkg'); // false
 * wildcardToRegExp('type:*').test('type:api'); // true
 * wildcardToRegExp('a.b').test('aXb'); // false
 *
 * @param pattern - Text in which each `*` stands for any characters.
 * @returns An anchored regular expression that matches strings equal to `pattern` with each
 * `*` replaced by any characters.
 */
export function wildcardToRegExp(pattern: string): RegExp {
  // Escape the text between the `*`s so it matches literally, then join the pieces with `.*`.
  const escaped = pattern.split('*').map(escapeRegExp).join('.*');

  return new RegExp(`^${escaped}$`);
}
