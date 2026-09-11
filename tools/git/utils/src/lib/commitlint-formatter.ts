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
// CI), and jest/ts-jest compiles it for the spec beside it. `node` strips the
// types natively (default since 22.18 — see package.json `engines.node`), then
// runs what's left as plain JS — so the module system it picks matters. Node
// resolves that from the *nearest* package.json's `"type"` field, which every
// buildable project in the workspace sets to `"commonjs"` (see
// tools/nx/utils/package.json for the shape) — git-utils' own package.json is
// still bare `{name, version}` only because it predates that convention, not
// because this file needs it to be. Relying on the project staying typeless
// (so Node falls back to syntax-detecting this file as ESM) is exactly the trap
// that bit this file: the moment git-utils' package.json is brought in line
// with every sibling project, `export default` below becomes a syntax error
// under bare node. `module.exports =` sidesteps the whole question — it's valid
// CommonJS regardless of what the package.json says, today or later, and is
// also what bare-node type stripping expects when there's no explicit ESM
// marker. `export =` (TS's own CJS-export syntax, which would keep this typed
// for the spec's `import`) is off the table too — Node's strip-types explicitly
// rejects it ("TypeScript export assignment is not supported in strip-only
// mode"), unlike `export default`, which is why the spec beside this file reads
// this module with a plain `require` + type assertion instead of a static
// import. Constraints: `import type` only (a value import of a type throws at
// load), and erasable syntax only — no enums, namespaces, or parameter
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

module.exports = formatter;
