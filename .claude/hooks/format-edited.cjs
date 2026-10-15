#!/usr/bin/env node
'use strict';

// Formats the files this session edited, once per turn, with the workspace Prettier
// config (docs/agents/conventions.md §8 "Formatting").
//
//   track  — PostToolUse (Write | Edit): records the edited file for this session.
//   flush  — Stop: runs Prettier over the recorded files, then clears the list.
//
// Formatting is deferred to the end of the turn on purpose: the Prettier config includes
// prettier-plugin-organize-imports, which strips an import whose first use hasn't been
// written yet. Formatting after every edit would eat imports mid-change. Only files this
// session touched are formatted, so another session's in-flight work in a shared clone is
// left alone.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STATE_DIR = path.join(os.tmpdir(), 'claude-format-edited');

/** Path of the per-session list of edited files. */
function stateFile(sessionId) {
  return path.join(STATE_DIR, `${String(sessionId).replace(/[^\w-]/g, '_')}.txt`);
}

/** Nearest ancestor of `file` that has Prettier installed, or undefined. */
function prettierRoot(file) {
  let dir = path.dirname(file);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'node_modules', 'prettier', 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Groups existing files by the Prettier root that should format them. */
function groupByRoot(files) {
  const groups = new Map();
  for (const file of new Set(files)) {
    if (!fs.existsSync(file)) continue;
    const root = prettierRoot(file);
    if (!root) continue;
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(path.relative(root, file));
  }
  return groups;
}

function track(payload) {
  const file = payload.tool_input?.file_path ?? payload.tool_response?.filePath;
  if (typeof file !== 'string') return;
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.appendFileSync(stateFile(payload.session_id), `${path.resolve(file)}\n`);
}

function flush(payload) {
  const list = stateFile(payload.session_id);
  if (!fs.existsSync(list)) return;
  const files = fs.readFileSync(list, 'utf8').split('\n').filter(Boolean);
  fs.rmSync(list, { force: true });

  const failures = [];
  for (const [root, relFiles] of groupByRoot(files)) {
    const cli = path.join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
    try {
      execFileSync(
        process.execPath,
        [cli, '--write', '--ignore-unknown', '--log-level', 'warn', ...relFiles],
        { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }
      );
    } catch (error) {
      failures.push(`${root}: ${String(error.stderr || error.message).trim()}`);
    }
  }
  if (failures.length > 0) {
    process.stdout.write(
      JSON.stringify({ systemMessage: `Prettier failed on edited files:\n${failures.join('\n')}` })
    );
  }
}

function main() {
  const mode = process.argv[2];
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => (input += chunk));
  process.stdin.on('end', () => {
    const payload = JSON.parse(input);
    if (mode === 'track') track(payload);
    else if (mode === 'flush') flush(payload);
  });
}

if (require.main === module) main();

module.exports = { groupByRoot, prettierRoot };
