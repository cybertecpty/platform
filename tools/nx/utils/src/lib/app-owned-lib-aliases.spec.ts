import { appOwnedLibAliases } from './app-owned-lib-aliases.mjs';

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
