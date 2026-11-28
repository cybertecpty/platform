import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addBarrelExport,
  addProjectExport,
  listFilesRecursively,
  listImportedPackages,
  projectBarrelPath,
  projectSrcLibPath,
  projectSrcRootPath,
  replaceBarrelExport
} from './tree';

describe('tree', () => {
  describe('project source paths', () => {
    const withSourceRoot = { root: 'libs/demo', sourceRoot: 'libs/demo/lib-src' };
    const withoutSourceRoot = { root: 'libs/demo' };

    describe('projectSrcRootPath', () => {
      it('is the `sourceRoot` when the project has one', () => {
        expect(projectSrcRootPath(withSourceRoot)).toBe('libs/demo/lib-src');
      });

      it('is `{root}/src` when the project has no `sourceRoot`', () => {
        expect(projectSrcRootPath(withoutSourceRoot)).toBe('libs/demo/src');
      });
    });

    describe('projectBarrelPath', () => {
      it('is `index.ts` in the source root', () => {
        expect(projectBarrelPath(withSourceRoot)).toBe('libs/demo/lib-src/index.ts');
      });

      it('falls back to `{root}/src/index.ts`', () => {
        expect(projectBarrelPath(withoutSourceRoot)).toBe('libs/demo/src/index.ts');
      });
    });

    describe('projectSrcLibPath', () => {
      it('is the `lib` folder of the source root', () => {
        expect(projectSrcLibPath(withSourceRoot)).toBe('libs/demo/lib-src/lib');
      });

      it('falls back to `{root}/src/lib`', () => {
        expect(projectSrcLibPath(withoutSourceRoot)).toBe('libs/demo/src/lib');
      });
    });
  });

  describe('addProjectExport', () => {
    const BARREL = 'libs/demo/src/index.ts';
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      tree.write(BARREL, "export * from './lib/existing';\n");
    });

    it('exports the module relative to the source root', () => {
      addProjectExport(tree, { root: 'libs/demo' }, 'libs/demo/src/lib/stores/a-store');

      expect(tree.read(BARREL, 'utf-8')).toContain("export * from './lib/stores/a-store';");
    });

    it('writes to the barrel in a custom source root', () => {
      tree.write('libs/demo/app/index.ts', '');

      addProjectExport(
        tree,
        { root: 'libs/demo', sourceRoot: 'libs/demo/app' },
        'libs/demo/app/lib/a-store'
      );

      expect(tree.read('libs/demo/app/index.ts', 'utf-8')).toContain(
        "export * from './lib/a-store';"
      );
      expect(tree.read(BARREL, 'utf-8')).not.toContain('a-store');
    });

    it('does not add a module the barrel already exports', () => {
      addProjectExport(tree, { root: 'libs/demo' }, 'libs/demo/src/lib/existing');

      expect(tree.read(BARREL, 'utf-8')).toBe("export * from './lib/existing';\n");
    });
  });

  describe('addBarrelExport', () => {
    const BARREL = 'libs/demo/src/index.ts';
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('adds the statement to an exports-only barrel', () => {
      tree.write(BARREL, `export * from './lib/a';\n`);

      addBarrelExport(tree, BARREL, `export * from './lib/b';`);

      const barrel = tree.read(BARREL, 'utf-8');

      expect(barrel).toContain(`export * from './lib/a';`);
      expect(barrel).toContain(`export * from './lib/b';`);
    });

    it('creates the barrel when it does not exist', () => {
      addBarrelExport(tree, BARREL, `export * from './lib/a';`);

      expect(tree.read(BARREL, 'utf-8')).toContain(`export * from './lib/a';`);
    });

    it('adds the statement after the last import of a barrel that has imports', () => {
      tree.write(BARREL, `import { x } from './lib/x';\n\nexport { x };\n`);

      addBarrelExport(tree, BARREL, `export * from './lib/b';`);

      const barrel = tree.read(BARREL, 'utf-8') ?? '';

      expect(barrel.indexOf(`export * from './lib/b';`)).toBeGreaterThan(
        barrel.indexOf(`import { x }`)
      );
    });

    it('adds a statement whose only copy in the barrel is a comment', () => {
      tree.write(BARREL, `// export * from './lib/a';\nexport * from './lib/b';\n`);

      addBarrelExport(tree, BARREL, `export * from './lib/a';`);

      expect(tree.read(BARREL, 'utf-8')).toMatch(/^export \* from '\.\/lib\/a';$/m);
    });

    it('adds a statement that is only a prefix of an existing one', () => {
      tree.write(BARREL, `export * from './lib/a/deep';\n`);

      addBarrelExport(tree, BARREL, `export * from './lib/a';`);

      expect(tree.read(BARREL, 'utf-8')).toContain(`export * from './lib/a';`);
    });

    it('does not add a statement the barrel already holds', () => {
      tree.write(BARREL, `export * from './lib/a';\n`);

      addBarrelExport(tree, BARREL, `export * from './lib/a';`);

      expect(tree.read(BARREL, 'utf-8')).toBe(`export * from './lib/a';\n`);
    });

    it('matches an existing statement in the other quote style', () => {
      tree.write(BARREL, `export * from "./lib/a";\n`);

      addBarrelExport(tree, BARREL, `export * from './lib/a';`);

      expect(tree.read(BARREL, 'utf-8')).toBe(`export * from "./lib/a";\n`);
    });

    it('matches an existing statement written over several lines', () => {
      tree.write(BARREL, `export {\n  one,\n  two\n} from './lib/a';\n`);

      addBarrelExport(tree, BARREL, `export { one, two } from './lib/a';`);

      expect(tree.read(BARREL, 'utf-8')).toBe(`export {\n  one,\n  two\n} from './lib/a';\n`);
    });
  });

  describe('listFilesRecursively', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('lists every file directly under a flat directory', () => {
      tree.write('dist/web/index.html', '<html></html>');
      tree.write('dist/web/main.js', 'console.log(1)');

      expect(listFilesRecursively(tree, 'dist/web').sort()).toEqual([
        'dist/web/index.html',
        'dist/web/main.js'
      ]);
    });

    it('recurses into nested subdirectories', () => {
      tree.write('dist/web/index.html', '<html></html>');
      tree.write('dist/web/assets/logo.svg', '<svg></svg>');
      tree.write('dist/web/assets/icons/star.svg', '<svg></svg>');

      expect(listFilesRecursively(tree, 'dist/web').sort()).toEqual([
        'dist/web/assets/icons/star.svg',
        'dist/web/assets/logo.svg',
        'dist/web/index.html'
      ]);
    });

    it('returns an empty array for a directory with no files', () => {
      expect(listFilesRecursively(tree, 'dist/web')).toEqual([]);
    });

    it('returns an empty array for a directory with only empty subdirectories', () => {
      // `Tree` has no concept of an empty directory on its own — this seeds one by
      // writing then deleting the only file it ever contained.
      tree.write('dist/web/nested/.keep', '');
      tree.delete('dist/web/nested/.keep');

      expect(listFilesRecursively(tree, 'dist/web')).toEqual([]);
    });

    it('returns an empty array for a directory that does not exist', () => {
      expect(listFilesRecursively(tree, 'does/not/exist')).toEqual([]);
    });

    it('includes gitignored files, unlike `visitNotIgnoredFiles`', () => {
      tree.write('.gitignore', 'dist\n');
      tree.write('dist/web/index.html', '<html></html>');

      expect(listFilesRecursively(tree, 'dist/web')).toEqual(['dist/web/index.html']);
    });

    it('does not include the directory itself or unrelated sibling files', () => {
      tree.write('dist/web/index.html', '<html></html>');
      tree.write('dist/other/index.html', '<html></html>');

      expect(listFilesRecursively(tree, 'dist/web')).toEqual(['dist/web/index.html']);
    });
  });

  describe('listImportedPackages', () => {
    const SRC = 'libs/demo/src';
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('names each imported package once, in the order first seen', () => {
      tree.write(
        `${SRC}/a.ts`,
        "import { map } from 'rxjs';\nimport { Component } from '@angular/core';"
      );
      tree.write(`${SRC}/b.ts`, "import { filter } from 'rxjs';");

      expect(listImportedPackages(tree, SRC)).toEqual(['rxjs', '@angular/core']);
    });

    it('reduces a deep import to its package', () => {
      tree.write(
        `${SRC}/a.ts`,
        "import { HttpClient } from '@angular/common/http';\nimport map from 'lodash-es/map';"
      );

      expect(listImportedPackages(tree, SRC)).toEqual(['@angular/common', 'lodash-es']);
    });

    it('reads a bare import, a dynamic import and a re-export', () => {
      tree.write(
        `${SRC}/a.ts`,
        "import 'zone.js';\nconst x = import('@angular/forms');\nexport * from '@angular/router';"
      );

      expect(listImportedPackages(tree, SRC)).toEqual([
        'zone.js',
        '@angular/forms',
        '@angular/router'
      ]);
    });

    it('leaves out relative and absolute paths', () => {
      tree.write(
        `${SRC}/a.ts`,
        "import { a } from './a';\nimport { b } from '../b';\nimport c from '/c';"
      );

      expect(listImportedPackages(tree, SRC)).toEqual([]);
    });

    it('ignores an import that only appears in a comment', () => {
      tree.write(
        `${SRC}/a.ts`,
        [
          "// moved from 'rxjs'",
          "/* import { x } from 'zod'; */",
          "import { Component } from '@angular/core'; // not 'tslib'"
        ].join('\n')
      );

      expect(listImportedPackages(tree, SRC)).toEqual(['@angular/core']);
    });

    it('skips files that are not `.ts` and files that match `ignoredFiles`', () => {
      tree.write(`${SRC}/a.js`, "import 'rxjs';");
      tree.write(`${SRC}/a.spec.ts`, "import 'vitest';");
      tree.write(`${SRC}/a.ts`, "import 'zod';");

      expect(listImportedPackages(tree, SRC, /\.spec\.ts$/)).toEqual(['zod']);
    });

    it('reads files in nested directories', () => {
      tree.write(`${SRC}/lib/deep/a.ts`, "import 'zod';");

      expect(listImportedPackages(tree, SRC)).toEqual(['zod']);
    });

    it('returns an empty array for a directory that does not exist', () => {
      expect(listImportedPackages(tree, 'does/not/exist')).toEqual([]);
    });
  });

  describe('replaceBarrelExport', () => {
    const BARREL = 'libs/demo/src/index.ts';
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('points an `export *` of the module at the new one', () => {
      tree.write(BARREL, `export * from './lib/a';\n`);

      replaceBarrelExport(tree, BARREL, './lib/a', './lib/b');

      expect(tree.read(BARREL, 'utf-8')).toBe(`export * from './lib/b';\n`);
    });

    it('points a named re-export of the module at the new one', () => {
      tree.write(BARREL, `export { one, two } from './lib/a';\n`);

      replaceBarrelExport(tree, BARREL, './lib/a', './lib/b');

      expect(tree.read(BARREL, 'utf-8')).toBe(`export { one, two } from './lib/b';\n`);
    });

    it('handles a re-export written over several lines', () => {
      tree.write(
        BARREL,
        `export {
  one,
  two
} from './lib/a';
`
      );

      replaceBarrelExport(tree, BARREL, './lib/a', './lib/b');

      expect(tree.read(BARREL, 'utf-8')).toContain(`} from './lib/b';`);
    });

    it('handles a type re-export and a namespace re-export', () => {
      tree.write(BARREL, `export type { One } from './lib/a';\nexport * as ns from './lib/a';\n`);

      replaceBarrelExport(tree, BARREL, './lib/a', './lib/b');

      expect(tree.read(BARREL, 'utf-8')).toBe(
        `export type { One } from './lib/b';\nexport * as ns from './lib/b';\n`
      );
    });

    it('matches either quote style and keeps the one the barrel uses', () => {
      tree.write(BARREL, `export * from "./lib/a";\n`);

      replaceBarrelExport(tree, BARREL, './lib/a', './lib/b');

      expect(tree.read(BARREL, 'utf-8')).toBe(`export * from "./lib/b";\n`);
    });

    it('keeps the other exports of the barrel', () => {
      tree.write(BARREL, `export * from './lib/other';\nexport * from './lib/a';\n`);

      replaceBarrelExport(tree, BARREL, './lib/a', './lib/b');

      expect(tree.read(BARREL, 'utf-8')).toBe(
        `export * from './lib/other';\nexport * from './lib/b';\n`
      );
    });

    it('does not match a module whose specifier only starts with the one given', () => {
      tree.write(BARREL, `export * from './lib/ab';\n`);

      replaceBarrelExport(tree, BARREL, './lib/a', './lib/b');

      expect(tree.read(BARREL, 'utf-8')).toBe(`export * from './lib/ab';\n`);
    });

    it('takes the specifier literally, not as a pattern', () => {
      tree.write(BARREL, `export * from './lib/a.b';\nexport * from './lib/axb';\n`);

      replaceBarrelExport(tree, BARREL, './lib/a.b', './lib/c');

      expect(tree.read(BARREL, 'utf-8')).toBe(
        `export * from './lib/c';\nexport * from './lib/axb';\n`
      );
    });

    it('writes a replacement that contains a `$` as it is', () => {
      tree.write(BARREL, `export * from './lib/a';\n`);

      replaceBarrelExport(tree, BARREL, './lib/a', './lib/$&b');

      expect(tree.read(BARREL, 'utf-8')).toBe(`export * from './lib/$&b';\n`);
    });

    it('leaves an `import` of the same module alone', () => {
      tree.write(BARREL, `import { one } from './lib/a';\nexport * from './lib/a';\n`);

      replaceBarrelExport(tree, BARREL, './lib/a', './lib/b');

      expect(tree.read(BARREL, 'utf-8')).toBe(
        `import { one } from './lib/a';\nexport * from './lib/b';\n`
      );
    });

    it('leaves a barrel that does not re-export the module as it is', () => {
      tree.write(BARREL, `export * from './lib/other';\n`);

      replaceBarrelExport(tree, BARREL, './lib/a', './lib/b');

      expect(tree.read(BARREL, 'utf-8')).toBe(`export * from './lib/other';\n`);
    });

    it('does nothing when the barrel does not exist', () => {
      expect(() => replaceBarrelExport(tree, BARREL, './lib/a', './lib/b')).not.toThrow();
      expect(tree.exists(BARREL)).toBe(false);
    });
  });
});
