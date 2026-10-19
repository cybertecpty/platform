/**
 * Guard for ADR 0004's browser-safe rule on `scope:shared` libs (issue #164).
 *
 * The `typecheck` target checks each project's `tsconfig.lib.json`, so a Node global
 * (`process`, `Buffer`, …) in a lib's source fails CI only if that config doesn't load
 * `node` types. This finds every project tagged `scope:shared` (no hand-kept list) and
 * reports the cases that would silently let Node globals through: no `typecheck` target,
 * `node` in the lib tsconfig's `types` (directly or through `extends`), or no `types` at
 * all, which loads every visible `@types` package. A missing or invalid lib tsconfig
 * isn't checked here — `typecheck` already fails on it.
 *
 * Run by `node --test` (`shared-lib-types.test.cjs`) in `pnpm verify` and CI.
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'tmp', '.git', '.nx']);
const TAG = 'scope:shared';

/**
 * Lists every `project.json` under `root`, skipping build output and dependencies.
 * @param {string} root
 * @returns {string[]} absolute paths
 */
function findProjectFiles(root) {
  const found = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (entry.name === 'project.json') {
        found.push(path.join(dir, entry.name));
      }
    }
  };
  walk(root);
  return found;
}

/**
 * Resolves a tsconfig's effective `compilerOptions.types`, following `extends`.
 * @param {string} configPath
 * @returns {string[] | undefined} undefined when no config in the chain sets `types`
 */
function effectiveTypes(configPath) {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined }
  );
  return parsed?.options.types;
}

/**
 * Reports each `scope:shared` project whose source could use Node globals unnoticed.
 * @param {string} root workspace root
 * @returns {{ project: string, problem: string }[]} project is the root-relative directory
 */
function findViolations(root) {
  const violations = [];
  for (const projectFile of findProjectFiles(root)) {
    const { tags = [], targets = {} } = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
    if (!tags.includes(TAG)) continue;

    const dir = path.dirname(projectFile);
    const project = path.relative(root, dir).split(path.sep).join('/');
    if (!targets.typecheck) {
      violations.push({ project, problem: 'has no "typecheck" target' });
    }

    const libConfig = path.join(dir, 'tsconfig.lib.json');
    if (!fs.existsSync(libConfig)) continue;

    const types = effectiveTypes(libConfig);
    if (types === undefined) {
      violations.push({
        project,
        problem: 'tsconfig.lib.json sets no "types", so every @types package (node too) loads'
      });
    } else if (types.includes('node')) {
      violations.push({ project, problem: 'tsconfig.lib.json loads "node" types' });
    }
  }
  return violations;
}

module.exports = { findViolations };
