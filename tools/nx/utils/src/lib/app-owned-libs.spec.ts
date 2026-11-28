import { appOwnedImportBlocks, appOwnedLibAliases } from './app-owned-libs.mjs';

describe('appOwnedLibAliases', () => {
  it('groups the import aliases of libs under `apps/<app>` by their app', () => {
    expect(
      appOwnedLibAliases({
        '@cybertecpty/billing-ui': ['./apps/cybertec-io/billing/ui/src/index.ts'],
        '@cybertecpty/billing-feature': ['./apps/cybertec-io/billing/feature/src/index.ts'],
        '@cybertecpty/cart-ui': ['./apps/gamers-source/cart/ui/src/index.ts']
      })
    ).toEqual({
      'cybertec-io': ['@cybertecpty/billing-feature', '@cybertecpty/billing-ui'],
      'gamers-source': ['@cybertecpty/cart-ui']
    });
  });

  it('leaves out libs and tools, which no app owns', () => {
    expect(
      appOwnedLibAliases({
        '@cybertecpty/fs-utils': ['./libs/shared/fs/utils/src/index.ts'],
        '@cybertecpty/git-utils': ['./tools/git/utils/src/index.ts']
      })
    ).toEqual({});
  });

  it('reads a path with no leading `./`', () => {
    expect(
      appOwnedLibAliases({
        '@cybertecpty/billing-ui': ['apps/cybertec-io/billing/ui/src/index.ts']
      })
    ).toEqual({ 'cybertec-io': ['@cybertecpty/billing-ui'] });
  });

  it('is not fooled by a lib whose folder only starts with `apps`', () => {
    expect(
      appOwnedLibAliases({ '@cybertecpty/x': ['./libs/apps/x/src/index.ts', './appsx/y/index.ts'] })
    ).toEqual({});
  });

  it('skips an alias with no target', () => {
    expect(appOwnedLibAliases({ '@cybertecpty/empty': [] })).toEqual({});
  });
});

const CODE_FILES = '**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}';

describe('appOwnedImportBlocks', () => {
  it('returns no blocks when no app owns a lib', () => {
    expect(appOwnedImportBlocks({}, '/repo')).toEqual([]);
  });

  it('bans the app’s libs everywhere outside the app, and needs no block inside it', () => {
    const blocks = appOwnedImportBlocks({ 'cybertec-io': ['@cybertecpty/billing-ui'] }, '/repo');

    expect(blocks).toEqual([
      {
        basePath: '/repo',
        files: [CODE_FILES],
        ignores: ['apps/cybertec-io/**'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              paths: [
                {
                  name: '@cybertecpty/billing-ui',
                  message: expect.stringContaining('belongs to the app "cybertec-io"')
                }
              ]
            }
          ]
        }
      }
    ]);
  });

  it('bans each app’s libs from the other apps, and all of them from the rest of the code', () => {
    const blocks = appOwnedImportBlocks(
      {
        'cybertec-io': ['@cybertecpty/billing-ui'],
        'gamers-source': ['@cybertecpty/cart-ui']
      },
      '/repo'
    );
    const bannedNames = (block: (typeof blocks)[number]) =>
      block.rules['no-restricted-imports'][1].paths.map(path => path.name);

    expect(blocks.map(block => block.files)).toEqual([
      [CODE_FILES],
      ['apps/cybertec-io/**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}'],
      ['apps/gamers-source/**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}']
    ]);
    expect(blocks[0].ignores).toEqual(['apps/cybertec-io/**', 'apps/gamers-source/**']);
    expect(bannedNames(blocks[0])).toEqual(['@cybertecpty/billing-ui', '@cybertecpty/cart-ui']);
    expect(bannedNames(blocks[1])).toEqual(['@cybertecpty/cart-ui']);
    expect(bannedNames(blocks[2])).toEqual(['@cybertecpty/billing-ui']);
  });

  it('names the owning app in each message', () => {
    const [block] = appOwnedImportBlocks({ 'cybertec-io': ['@cybertecpty/billing-ui'] }, '/repo');

    expect(block.rules['no-restricted-imports'][1].paths[0].message).toBe(
      'This lib belongs to the app "cybertec-io" (ADR 0023), so only code under apps/cybertec-io/ may import it. Move it to libs/ to share it.'
    );
  });
});
