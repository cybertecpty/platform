/**
 * Guard for ADR 0004's browser-safe rule on `scope:shared` libs (issue #164).
 *
 * The `typecheck` target checks each project's `tsconfig.lib.json`, so a Node global
 * (`process`, `Buffer`, …) in a lib's source fails CI only if that config doesn't load
 * `node` types. Nx generators add `node` to a new lib's `types`, so this finds every
 * project tagged `scope:shared` (no hand-kept list) and reports any that has no
 * `typecheck` target, or whose lib tsconfig is missing, has config errors, or would load
 * Node types: `node` listed directly or through `extends`, or no `types` at all, which
 * loads every visible `@types` package.
 *
 * Run by `node --test` (`shared-lib-types.test.cjs`) in `pnpm verify` and CI.
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/** TS18003 "No inputs were found" — irrelevant here, since only `compilerOptions` is read. */
const NO_INPUTS_FOUND = 18003;
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
 * @returns {{ types: string[] | undefined, errors: string[] }} `types` is undefined when no
 *   config in the chain sets it; `errors` holds TypeScript's config diagnostics
 */
function effectiveTypes(configPath) {
  const unrecoverable = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: diagnostic => unrecoverable.push(diagnostic)
    }
  );
  const errors = [...unrecoverable, ...(parsed?.errors ?? [])]
    .filter(diagnostic => diagnostic.code !== NO_INPUTS_FOUND)
    .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
  return { types: parsed?.options.types, errors };
}

/**
 * Reports each `scope:shared` project whose source isn't type-checked without Node types:
 * no `typecheck` target, or a `tsconfig.lib.json` that is missing, invalid, or loads `node`.
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
    if (!fs.existsSync(libConfig)) {
      violations.push({ project, problem: 'has no tsconfig.lib.json' });
      continue;
    }

    const { types, errors } = effectiveTypes(libConfig);
    if (errors.length > 0) {
      violations.push({ project, problem: `tsconfig.lib.json has errors: ${errors.join('; ')}` });
    } else if (types === undefined) {
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
