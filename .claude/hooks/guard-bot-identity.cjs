#!/usr/bin/env node
'use strict';

// PreToolUse hook (Bash | PowerShell): enforces the bot PR flow from
// docs/agents/conventions.md §1 so it doesn't rely on the agent remembering it.
//
// - `git push origin ...` is denied: agent pushes go through the `cybertec-bot` remote.
// - Bot-owned `gh pr` writes (create, merge, comment, edit, close, reopen, ready) are
//   denied unless `gh` is on `cybertec-bot`, or the same command switches to it first.
//
// Reads the hook payload on stdin, prints a PreToolUse decision on stdout. Anything it
// doesn't recognise is allowed through untouched. Set CLAUDE_BOT_GUARD=off to bypass.

const { execFileSync } = require('node:child_process');

const BOT_ACCOUNT = 'cybertec-bot';
const GH_PR_WRITE = /\bgh\s+pr\s+(create|merge|comment|edit|close|reopen|ready)\b/;
const GH_SWITCH_TO_BOT = new RegExp(
  `\\bgh\\s+auth\\s+switch\\b[^;&|\\n]*--user[\\s=]+${BOT_ACCOUNT}\\b`
);
const GIT_PUSH = /\bgit\s+(?:-C\s+\S+\s+|-c\s+\S+\s+)*push\b([^;&|\n]*)/g;

/** Returns the remote a `git push` argument string targets, or undefined if implicit. */
function pushRemote(args) {
  return args
    .trim()
    .split(/\s+/)
    .find(arg => arg && !arg.startsWith('-'));
}

/**
 * Decides whether a shell command may run.
 * @param {string} command the Bash / PowerShell command
 * @param {() => string | undefined} getActiveAccount lazily resolves the active gh account
 * @returns {{ decision: 'allow' | 'deny' | 'ask', reason?: string }}
 */
function evaluate(command, getActiveAccount) {
  for (const match of command.matchAll(GIT_PUSH)) {
    if (pushRemote(match[1]) === 'origin') {
      return {
        decision: 'deny',
        reason:
          'Agent pushes go through the `cybertec-bot` remote, never `origin` ' +
          '(docs/agents/conventions.md §1). Use `git push cybertec-bot {branch}`.'
      };
    }
  }

  const write = GH_PR_WRITE.exec(command);
  if (!write) return { decision: 'allow' };

  const switchToBot = GH_SWITCH_TO_BOT.exec(command);
  if (switchToBot && switchToBot.index < write.index) return { decision: 'allow' };

  const account = getActiveAccount();
  if (account === BOT_ACCOUNT) return { decision: 'allow' };
  if (account === undefined) {
    return {
      decision: 'ask',
      reason: `Could not read the active gh account; \`gh pr ${write[1]}\` must run as ${BOT_ACCOUNT}.`
    };
  }
  return {
    decision: 'deny',
    reason:
      `\`gh pr ${write[1]}\` must run as ${BOT_ACCOUNT}, but gh is on ${account}. ` +
      `Run \`gh auth switch --user ${BOT_ACCOUNT}\` first (docs/agents/conventions.md §1).`
  };
}

/** Reads the active github.com account from `gh auth status`, or undefined. */
function activeGhAccount() {
  try {
    const out = execFileSync('gh', ['auth', 'status', '--active', '--hostname', 'github.com'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000
    });
    return /account\s+(\S+)/.exec(out)?.[1];
  } catch {
    return undefined;
  }
}

function main() {
  if (process.env.CLAUDE_BOT_GUARD === 'off') return;

  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => (input += chunk));
  process.stdin.on('end', () => {
    const command = JSON.parse(input).tool_input?.command;
    if (typeof command !== 'string') return;

    const { decision, reason } = evaluate(command, activeGhAccount);
    if (decision === 'allow') return;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: decision,
          permissionDecisionReason: reason
        }
      })
    );
  });
}

if (require.main === module) main();

module.exports = { evaluate };
