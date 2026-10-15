'use strict';

// Run with `node --test .claude/hooks/*.test.cjs`.

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { evaluate } = require('./guard-bot-identity.cjs');

const asBot = () => 'cybertec-bot';
const asMaintainer = () => 'djmcgrath101';
const unknown = () => undefined;
const unreachable = () => assert.fail('gh account should not be looked up');

describe('evaluate', () => {
  it('allows commands that are neither pushes nor gh pr writes', () => {
    assert.equal(evaluate('git status', unreachable).decision, 'allow');
    assert.equal(evaluate('gh pr view 12 --json state', unreachable).decision, 'allow');
  });

  it('denies an explicit push to origin', () => {
    assert.equal(evaluate('git push origin feat/x', unreachable).decision, 'deny');
    assert.equal(evaluate('git push -u origin HEAD', unreachable).decision, 'deny');
    assert.equal(evaluate('git -C /c/repo push origin x', unreachable).decision, 'deny');
  });

  it('denies a push to origin chained after other commands', () => {
    assert.equal(
      evaluate('git commit -F msg.txt; git push origin x', unreachable).decision,
      'deny'
    );
  });

  it('allows a push to the bot remote or an implicit upstream', () => {
    assert.equal(evaluate('git push cybertec-bot feat/x', unreachable).decision, 'allow');
    assert.equal(
      evaluate('git push --set-upstream cybertec-bot HEAD', unreachable).decision,
      'allow'
    );
    assert.equal(evaluate('git push', unreachable).decision, 'allow');
  });

  it('allows a gh pr write when gh is on the bot account', () => {
    assert.equal(evaluate('gh pr create --base develop', asBot).decision, 'allow');
  });

  it('denies a gh pr write when gh is on the maintainer account', () => {
    const result = evaluate('gh pr merge 12 --auto --squash', asMaintainer);
    assert.equal(result.decision, 'deny');
    assert.match(result.reason, /gh auth switch --user cybertec-bot/);
  });

  it('allows a gh pr write preceded by a switch to the bot in the same command', () => {
    const command = 'gh auth switch --user cybertec-bot; gh pr create --fill';
    assert.equal(evaluate(command, unreachable).decision, 'allow');
  });

  it('does not count a switch that comes after the gh pr write', () => {
    const command = 'gh pr create --fill; gh auth switch --user cybertec-bot';
    assert.equal(evaluate(command, asMaintainer).decision, 'deny');
  });

  it('asks when the active gh account cannot be read', () => {
    assert.equal(evaluate('gh pr comment 12 --body-file b.md', unknown).decision, 'ask');
  });

  it('leaves maintainer-only gh pr actions alone', () => {
    assert.equal(evaluate('gh pr review 12 --approve', unreachable).decision, 'allow');
  });
});
