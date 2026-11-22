import type { Tree } from '@nx/devkit';
import { readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ensureEntrypointExports, replaceAngularPeerDependencies } from './ng-package.utils';

const ROOT = 'libs/billing/feature';

function peerDependencies(tree: Tree): Record<string, string> {
  return readJson(tree, `${ROOT}/package.json`).peerDependencies;
}

describe('replaceAngularPeerDependencies', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'package.json', {
      dependencies: { '@angular/core': '~22.0.4', '@angular/router': '~22.0.4' }
    });
    writeJson(tree, `${ROOT}/package.json`, {
      name: '@cybertecpty/billing-feature',
      peerDependencies: { '@angular/common': '^22.0.0', '@angular/core': '^22.0.0' }
    });
  });

  it('drops the peers the library does not import and adds the ones it does', () => {
    tree.write(
      `${ROOT}/src/lib/billing.routes.ts`,
      "import type { Route } from '@angular/router';"
    );

    replaceAngularPeerDependencies(tree, ROOT);

    expect(peerDependencies(tree)).toEqual({ '@angular/router': '^22.0.0' });
  });

  it('keeps the range of a peer that stays, and takes a caret on the root major for a new one', () => {
    tree.write(
      `${ROOT}/src/lib/billing.ts`,
      "import { Component } from '@angular/core';\nimport { Router } from '@angular/router';"
    );

    replaceAngularPeerDependencies(tree, ROOT);

    expect(peerDependencies(tree)).toEqual({
      '@angular/core': '^22.0.0',
      '@angular/router': '^22.0.0'
    });
  });

  it('keeps a root range that is not a plain version as it is', () => {
    writeJson(tree, 'package.json', { dependencies: { '@angular/router': 'workspace:*' } });
    tree.write(`${ROOT}/src/lib/billing.ts`, "import { Router } from '@angular/router';");

    replaceAngularPeerDependencies(tree, ROOT);

    expect(peerDependencies(tree)).toEqual({ '@angular/router': 'workspace:*' });
  });

  it('keeps a root range that starts below major 1 as it is', () => {
    writeJson(tree, 'package.json', { dependencies: { '@angular/router': '*' } });
    tree.write(`${ROOT}/src/lib/billing.ts`, "import { Router } from '@angular/router';");

    replaceAngularPeerDependencies(tree, ROOT);

    expect(peerDependencies(tree)).toEqual({ '@angular/router': '*' });
  });

  it('reduces a root range of another shape to a caret on its lowest major', () => {
    writeJson(tree, 'package.json', { dependencies: { '@angular/router': '>=22.1.0 <23' } });
    tree.write(`${ROOT}/src/lib/billing.ts`, "import { Router } from '@angular/router';");

    replaceAngularPeerDependencies(tree, ROOT);

    expect(peerDependencies(tree)).toEqual({ '@angular/router': '^22.0.0' });
  });

  it('counts a secondary entry point and a dynamic import', () => {
    tree.write(
      `${ROOT}/src/lib/billing.ts`,
      "import { HttpClient } from '@angular/common/http';\nconst core = import('@angular/core');"
    );

    replaceAngularPeerDependencies(tree, ROOT);

    expect(Object.keys(peerDependencies(tree))).toEqual(['@angular/common', '@angular/core']);
  });

  it('ignores specs and the test setup, which are not published', () => {
    tree.write(
      `${ROOT}/src/lib/billing.spec.ts`,
      "import { TestBed } from '@angular/core/testing';"
    );
    tree.write(`${ROOT}/src/test-setup.ts`, "import '@angular/compiler';");

    replaceAngularPeerDependencies(tree, ROOT);

    expect(peerDependencies(tree)).toEqual({});
  });

  it('leaves peers outside `@angular/` alone', () => {
    writeJson(tree, `${ROOT}/package.json`, {
      peerDependencies: { '@angular/core': '^22.0.0', rxjs: '^7.8.0' }
    });

    replaceAngularPeerDependencies(tree, ROOT);

    expect(peerDependencies(tree)).toEqual({ rxjs: '^7.8.0' });
  });

  it('skips an imported package whose range cannot be found', () => {
    tree.write(`${ROOT}/src/lib/billing.ts`, "import { x } from '@angular/forms';");

    replaceAngularPeerDependencies(tree, ROOT);

    expect(peerDependencies(tree)).toEqual({});
  });

  it('keeps the range of a peer that stays when the workspace has no root `package.json`', () => {
    tree.delete('package.json');
    tree.write(`${ROOT}/src/lib/billing.ts`, "import { Component } from '@angular/core';");

    replaceAngularPeerDependencies(tree, ROOT);

    expect(peerDependencies(tree)).toEqual({ '@angular/core': '^22.0.0' });
  });

  it('does nothing when the library has no `package.json`', () => {
    tree.delete(`${ROOT}/package.json`);

    replaceAngularPeerDependencies(tree, ROOT);

    expect(tree.exists(`${ROOT}/package.json`)).toBe(false);
  });
});

describe('ensureEntrypointExports', () => {
  const INDEX = `${ROOT}/src/index.ts`;
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, `${ROOT}/package.json`, { name: '@cybertecpty/billing-feature' });
  });

  it('writes `export {};` to an empty entrypoint', () => {
    tree.write(INDEX, '');

    ensureEntrypointExports(tree, ROOT);

    expect(tree.read(INDEX, 'utf-8')).toBe('export {};\n');
  });

  it('writes it when the entrypoint is missing', () => {
    ensureEntrypointExports(tree, ROOT);

    expect(tree.read(INDEX, 'utf-8')).toBe('export {};\n');
  });

  it('keeps an entrypoint that has content', () => {
    tree.write(INDEX, "export * from './lib/billing';\n");

    ensureEntrypointExports(tree, ROOT);

    expect(tree.read(INDEX, 'utf-8')).toBe("export * from './lib/billing';\n");
  });

  it('does nothing for a library without a `package.json`', () => {
    tree.delete(`${ROOT}/package.json`);
    tree.write(INDEX, '');

    ensureEntrypointExports(tree, ROOT);

    expect(tree.read(INDEX, 'utf-8')).toBe('');
  });
});
