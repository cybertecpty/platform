import { escapeRegExp } from './escape-reg-exp';

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
