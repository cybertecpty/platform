// Commit-message linting. Enforced locally by the `.husky/commit-msg` hook and in
// CI by `.github/workflows/commitlint.yml` (which lints the PR title — the subject
// that lands, since `develop` squash-merges).
//
// The valid types and the full format rules live in
// docs/agents/conventions.md §3 ("Commit message format"); `helpUrl` points there
// and the terse custom formatter (scripts/commitlint-formatter.mjs) links to it
// rather than restating it.

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  formatter: './scripts/commitlint-formatter.mjs',
  helpUrl:
    'https://github.com/cybertecpty/platform/blob/develop/docs/agents/conventions.md#commit-message-format',
  rules: {
    // Stricter than @commitlint/config-conventional (which only bans
    // sentence/start/pascal/upper-case): the subject must be fully lower-case,
    // acronyms included. See docs/agents/conventions.md §3.
    'subject-case': [2, 'always', 'lower-case']
  }
};
