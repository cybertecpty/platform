import { readJson, type Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { packageVersionGenerator } from './generator';

const PACKAGE_PATH = 'pkg/package.json';

describe('packageVersionGenerator', () => {
  let tree: Tree;

  const readVersion = (path = PACKAGE_PATH): string =>
    readJson<{ version: string }>(tree, path).version;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, PACKAGE_PATH, { name: 'pkg', version: '1.2.3' });
  });

  it('sets an explicit semantic version', async () => {
    await packageVersionGenerator(tree, { path: PACKAGE_PATH, vers: '2.0.0' });

    expect(readVersion()).toBe('2.0.0');
  });

  it('normalizes a loose explicit version before writing it', async () => {
    await packageVersionGenerator(tree, { path: PACKAGE_PATH, vers: 'v2.1.0' });

    expect(readVersion()).toBe('2.1.0');
  });

  it.each([
    ['major', '2.0.0'],
    ['minor', '1.3.0'],
    ['patch', '1.2.4'],
    ['premajor', '2.0.0-0'],
    ['prerelease', '1.2.4-0']
  ])('bumps the current version by release type "%s"', async (vers, expected) => {
    await packageVersionGenerator(tree, { path: PACKAGE_PATH, vers });

    expect(readVersion()).toBe(expected);
  });

  it('keeps the version field in its original position', async () => {
    writeJson(tree, PACKAGE_PATH, { name: 'pkg', version: '1.2.3', private: true });

    await packageVersionGenerator(tree, { path: PACKAGE_PATH, vers: 'minor' });

    expect(Object.keys(readJson(tree, PACKAGE_PATH))).toEqual(['name', 'version', 'private']);
  });

  it('throws when the package.json does not exist', async () => {
    await expect(
      packageVersionGenerator(tree, { path: 'missing/package.json', vers: 'minor' })
    ).rejects.toThrow('Package.json not found at path: missing/package.json');
  });

  it('throws when bumping a package whose current version is invalid', async () => {
    writeJson(tree, PACKAGE_PATH, { name: 'pkg', version: 'not-a-version' });

    await expect(
      packageVersionGenerator(tree, { path: PACKAGE_PATH, vers: 'minor' })
    ).rejects.toThrow('Invalid version in package.json: not-a-version');
  });

  it('throws on an unrecognized version specifier', async () => {
    await expect(
      packageVersionGenerator(tree, { path: PACKAGE_PATH, vers: 'bogus' })
    ).rejects.toThrow('Invalid version specifier: bogus');
  });

  it('updates the version without formatting when skipFormat is set', async () => {
    await packageVersionGenerator(tree, {
      path: PACKAGE_PATH,
      vers: 'patch',
      skipFormat: true
    });

    expect(readVersion()).toBe('1.2.4');
  });
});
