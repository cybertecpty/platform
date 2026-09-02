// Terse commitlint failure output. Shows what was received, the shape we expect
// with a couple of examples, the rules that were actually broken, and a link to
// the reference.
//
// The valid types and the full format rules deliberately live in
// docs/agents/conventions.md §3 — not here — so there is one place to maintain
// them. When the failure is a bad type, commitlint's own `type-enum` message
// already lists the valid names in the Problems section.
//
// Loaded two ways: commitlint runs it under bare `node` (the `commit-msg` hook and
// CI), and jest/ts-jest compiles it for the spec beside it. Kept `.ts` (not `.mts`)
// so ts-jest handles it as CommonJS with no ESM config; `node` strips the types
// natively (default since 22.18 — see package.json `engines.node`) and the
// `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` in the hook / workflow silences
// the reparse notice. Constraints: `import type` only (a value import of a type
// throws at load), and erasable syntax only — no enums, namespaces, or parameter
// properties.

import type { Formatter } from '@commitlint/types';

const REFERENCE_URL =
  'https://github.com/cybertecpty/platform/blob/develop/docs/agents/conventions.md#commit-message-format';

const EXAMPLES = ['feat(auth): add password reset flow', 'fix(api): handle null profile'];

const formatter: Formatter = (report, options) => {
  const results = report?.results ?? [];
  const referenceUrl = options?.helpUrl || REFERENCE_URL;

  return results
    .map(result => {
      const errors = result.errors ?? [];
      const warnings = result.warnings ?? [];
      if (errors.length === 0 && warnings.length === 0) {
        return '';
      }

      const received = result.input?.trim() || '(empty commit message)';
      const headline =
        errors.length > 0 ? 'Commit message failed linting' : 'Commit message has warnings';

      return [
        '',
        headline,
        '',
        `  Received: ${received}`,
        '',
        '  Expected: type(scope): subject',
        `            e.g. ${EXAMPLES.join('  ·  ')}`,
        '',
        '  Problems:',
        ...errors.map(problem => `    ✖ ${problem.message} [${problem.name}]`),
        ...warnings.map(problem => `    ⚠ ${problem.message} [${problem.name}]`),
        '',
        `  Reference: ${referenceUrl}`,
        ''
      ].join('\n');
    })
    .filter(block => block !== '')
    .join('\n');
};

export default formatter;
