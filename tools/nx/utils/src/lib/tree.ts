import { escapeRegExp } from '@cybertecpty/utils';
import type { ProjectConfiguration, Tree } from '@nx/devkit';
import { joinPathFragments } from '@nx/devkit';
import { addGlobal } from '@nx/js';
import { ensureTypescript } from '@nx/js/internal';
import { posix } from 'node:path';

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:'"`])\/\/.*$/gm;
const MODULE_SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/** The part of a project configuration that locates its source: enough to find its barrel. */
type ProjectSourceLocation = Pick<ProjectConfiguration, 'root' | 'sourceRoot'>;

/** The TypeScript module, loaded on first use the way `@nx/*` generators load it. */
let tsModule: ReturnType<typeof ensureTypescript> | undefined;

/**
 * Adds an export statement to a barrel file with `@nx/js`'s `addGlobal`, which inserts it after the
 * last `import` (at the top of an exports-only barrel). `statement` is the whole line as the barrel
 * should hold it, such as `export * from './lib/a';`. Creates the barrel when it does not exist. A
 * no-op when the barrel already holds the statement, whatever its quote style or line breaks.
 *
 * It does not sort or format the barrel: run `formatFiles` afterwards for that.
 */
export function addBarrelExport(tree: Tree, barrelPath: string, statement: string): void {
  if (!tree.exists(barrelPath)) {
    tree.write(barrelPath, '');
  }

  const barrel = tree.read(barrelPath, 'utf-8') ?? '';

  if (normalizeStatement(barrel).includes(normalizeStatement(statement))) {
    return;
  }

  tsModule ??= ensureTypescript();
  addGlobal(
    tree,
    tsModule.createSourceFile(barrelPath, barrel, tsModule.ScriptTarget.Latest, true),
    barrelPath,
    statement
  );
}

/**
 * Re-exports a module from a project's barrel as `export * from './lib/a';`. `modulePath` is the
 * module's workspace-relative path without its extension, such as `libs/demo/src/lib/a`, and the
 * specifier is written relative to the project's source root. See `addBarrelExport` for how the
 * statement is added.
 */
export function addProjectExport(
  tree: Tree,
  projectConfig: ProjectSourceLocation,
  modulePath: string
): void {
  const specifier = `./${posix.relative(projectSrcRootPath(projectConfig), modulePath)}`;

  addBarrelExport(tree, projectBarrelPath(projectConfig), `export * from '${specifier}';`);
}

/**
 * Recursively lists every file under `dir`, workspace-relative, regardless of
 * `.gitignore` status. Deliberately not `@nx/devkit`'s `visitNotIgnoredFiles`,
 * which skips gitignored paths entirely — callers that need to walk gitignored
 * build output (e.g. `dist/`) would otherwise silently visit zero files.
 */
export function listFilesRecursively(tree: Tree, dir: string): string[] {
  return tree.children(dir).flatMap(child => {
    const childPath = joinPathFragments(dir, child);

    return tree.isFile(childPath) ? [childPath] : listFilesRecursively(tree, childPath);
  });
}

/**
 * Lists the packages the `.ts` files under `dir` import, in the order they are first seen, with
 * each package named once: `@angular/common/http` is `@angular/common`, and `lodash-es/map` is
 * `lodash-es`. Relative and absolute paths are not packages and are left out, and a Node built-in
 * is returned as written (`node:fs`). It reads `import ... from`, a bare `import`, a dynamic
 * `import()` and `export ... from`.
 *
 * Comments are removed first, so an import named only in a comment does not count. An import
 * written inside a string still does. `ignoredFiles` is matched against each file's
 * workspace-relative path to skip it, such as the specs of a library.
 */
export function listImportedPackages(tree: Tree, dir: string, ignoredFiles?: RegExp): string[] {
  const names = new Set<string>();

  for (const file of listFilesRecursively(tree, dir)) {
    if (!file.endsWith('.ts') || ignoredFiles?.test(file)) {
      continue;
    }

    const source = (tree.read(file, 'utf-8') ?? '')
      .replace(BLOCK_COMMENT, '')
      .replace(LINE_COMMENT, '$1');

    for (const [, specifier] of source.matchAll(MODULE_SPECIFIER)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
        names.add(toPackageName(specifier));
      }
    }
  }

  return [...names];
}

/**
 * The project's barrel file, `index.ts` in its source root, as a workspace-relative path. The file
 * may not exist yet.
 */
export function projectBarrelPath(projectConfig: ProjectSourceLocation): string {
  return joinPathFragments(projectSrcRootPath(projectConfig), 'index.ts');
}

/** The `lib` folder of the project's source root, as a workspace-relative path. */
export function projectSrcLibPath(projectConfig: ProjectSourceLocation): string {
  return joinPathFragments(projectSrcRootPath(projectConfig), 'lib');
}

/**
 * The project's source root as a workspace-relative path: its `sourceRoot`, or `{root}/src` when it
 * has none.
 */
export function projectSrcRootPath(projectConfig: ProjectSourceLocation): string {
  return projectConfig.sourceRoot ?? joinPathFragments(projectConfig.root, 'src');
}

/**
 * Points the re-exports of one module in a barrel file at another: `export * from './lib/a'` and
 * `export { x } from './lib/a'` become `./lib/b` for `from: './lib/a'`, `to: './lib/b'`. `from` and
 * `to` are module specifiers as the barrel writes them, and either quote style matches. Other
 * exports, and an `import` of the same specifier, are left alone. A no-op when the barrel does not
 * exist or has no such re-export.
 */
export function replaceBarrelExport(
  tree: Tree,
  barrelPath: string,
  from: string,
  to: string
): void {
  const barrel = tree.read(barrelPath, 'utf-8');

  if (barrel === null) {
    return;
  }

  const reExport = new RegExp(
    String.raw`(\bexport\s[^;'"]*?\bfrom\s*)(['"])${escapeRegExp(from)}\2`,
    'g'
  );

  tree.write(
    barrelPath,
    barrel.replace(
      reExport,
      (_match, prefix: string, quote: string) => `${prefix}${quote}${to}${quote}`
    )
  );
}

/** Collapses whitespace and writes every quote single, so two spellings of a statement compare equal. */
function normalizeStatement(source: string): string {
  return source.replace(/"/g, "'").replace(/\s+/g, ' ');
}

/** `@scope/name/deep/path` is `@scope/name`, and `name/deep/path` is `name`. */
function toPackageName(specifier: string): string {
  const [first = '', second] = specifier.split('/');

  return first.startsWith('@') && second ? `${first}/${second}` : first;
}
