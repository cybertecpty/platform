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
