import type { FormattableProblem, FormattableReport } from '@commitlint/types';

import formatter from './commitlint-formatter';

const REFERENCE_URL =
  'https://github.com/cybertecpty/platform/blob/develop/docs/agents/conventions.md#commit-message-format';

// `@commitlint/types` is ESM-only, so nothing runtime is imported from it — only
// types. `level` (RuleConfigSeverity: 0/1/2) is a field the formatter never reads.
const problem =
  (level: FormattableProblem['level']) =>
  (name: FormattableProblem['name'], message: string): FormattableProblem => ({
    level,
    name,
    message
  });

const err = problem(2);
const warn = problem(1);

const report = (...results: NonNullable<FormattableReport['results']>): FormattableReport => ({
  results
});

describe('commitlintFormatter', () => {
  it('returns an empty string when the report has no results', () => {
    expect(formatter({}, {})).toBe('');
    expect(formatter({ results: [] }, {})).toBe('');
  });

  it('skips a result that has neither errors nor warnings', () => {
    expect(formatter(report({ input: 'feat: fine', errors: [], warnings: [] }), {})).toBe('');
  });

  it('renders a failing result with the failure headline, the message, and the reference', () => {
    const output = formatter(
      report({
        input: 'bad message',
        errors: [
          err('type-empty', 'type may not be empty'),
          err('subject-empty', 'subject may not be empty')
        ]
      }),
      {}
    );

    expect(output).toContain('Commit message failed linting');
    expect(output).toContain('  Received: bad message');
    expect(output).toContain('  Expected: type(scope): subject');
    expect(output).toContain(
      '            e.g. feat(auth): add password reset flow  ·  fix(api): handle null profile'
    );
    expect(output).toContain('    ✖ type may not be empty [type-empty]');
    expect(output).toContain('    ✖ subject may not be empty [subject-empty]');
    expect(output).toContain(`  Reference: ${REFERENCE_URL}`);
  });

  it('uses the warning headline and the ⚠ sign when a result has only warnings', () => {
    const output = formatter(
      report({
        input: 'feat: x',
        warnings: [warn('body-leading-blank', 'body must have a leading blank line')]
      }),
      {}
    );

    expect(output).toContain('Commit message has warnings');
    expect(output).not.toContain('failed linting');
    expect(output).toContain('    ⚠ body must have a leading blank line [body-leading-blank]');
  });

  it('prefers the failure headline when a result has both errors and warnings', () => {
    const output = formatter(
      report({
        input: 'x',
        errors: [err('type-empty', 'type may not be empty')],
        warnings: [warn('body-leading-blank', 'leading blank line missing')]
      }),
      {}
    );

    expect(output).toContain('Commit message failed linting');
    expect(output).toContain('    ✖ type may not be empty [type-empty]');
    expect(output).toContain('    ⚠ leading blank line missing [body-leading-blank]');
  });

  it('falls back to "(empty commit message)" when input is missing or blank', () => {
    const missing = formatter(report({ errors: [err('type-empty', 'nope')] }), {});
    const blank = formatter(report({ input: '   \n', errors: [err('type-empty', 'nope')] }), {});

    expect(missing).toContain('  Received: (empty commit message)');
    expect(blank).toContain('  Received: (empty commit message)');
  });

  it('trims surrounding whitespace from the received message', () => {
    const output = formatter(
      report({ input: '  feat: spaced  ', errors: [err('header-max-length', 'too long')] }),
      {}
    );

    expect(output).toContain('  Received: feat: spaced\n');
  });

  it('uses options.helpUrl for the reference link when provided', () => {
    const output = formatter(report({ input: 'x', errors: [err('type-empty', 'nope')] }), {
      helpUrl: 'https://example.test/commits'
    });

    expect(output).toContain('  Reference: https://example.test/commits');
    expect(output).not.toContain(REFERENCE_URL);
  });

  it('emits one block per failing result and drops the clean ones', () => {
    const output = formatter(
      report(
        { input: 'feat: clean', errors: [], warnings: [] },
        { input: 'bad one', errors: [err('type-empty', 'type may not be empty')] },
        { input: 'bad two', warnings: [warn('scope-empty', 'scope may not be empty')] }
      ),
      {}
    );

    expect(output.match(/ {2}Received:/g)).toHaveLength(2);
    expect(output).toContain('  Received: bad one');
    expect(output).toContain('  Received: bad two');
    expect(output).not.toContain('feat: clean');
  });
});
