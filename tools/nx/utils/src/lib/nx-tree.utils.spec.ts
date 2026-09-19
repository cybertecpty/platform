import { type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { listFilesRecursively } from './nx-tree.utils';

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
