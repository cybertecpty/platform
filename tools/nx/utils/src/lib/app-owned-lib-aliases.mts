/**
 * The import aliases of the libs each app owns (ADR 0023), read from the `paths` of
 * `tsconfig.base.json`: an alias whose first target lies under `apps/<app>/` belongs to `<app>`.
 * Each app's aliases are sorted; an app that owns none is absent.
 *
 * `eslint.config.mjs` uses it to ban an import of such an alias from code outside that app
 * (`@nx/enforce-module-boundaries` selects its rules by the importing project's tags and cannot
 * say "only this app"). Like `dep-constraints-const.mts`, it has no value imports and keeps the
 * `.mts` extension so that bare Node can load it.
 *
 * @example
 * // Libs under `apps/<app>/` are grouped by app, with each app's aliases sorted.
 * appOwnedLibAliases({
 *   '@cybertecpty/billing-ui': ['./apps/cybertec-io/billing/ui/src/index.ts'],
 *   '@cybertecpty/billing-feature': ['./apps/cybertec-io/billing/feature/src/index.ts'],
 *   '@cybertecpty/cart-ui': ['./apps/gamers-source/cart/ui/src/index.ts']
 * });
 * // => {
 * //   'cybertec-io': ['@cybertecpty/billing-feature', '@cybertecpty/billing-ui'],
 * //   'gamers-source': ['@cybertecpty/cart-ui']
 * // }
 *
 * @example
 * // Libs under `libs/` and `tools/` belong to no app, so they are left out.
 * appOwnedLibAliases({
 *   '@cybertecpty/fs-utils': ['./libs/shared/fs/utils/src/index.ts'],
 *   '@cybertecpty/git-utils': ['./tools/git/utils/src/index.ts']
 * });
 * // => {}
 */
export function appOwnedLibAliases(
  paths: Readonly<Record<string, readonly string[]>>
): Record<string, string[]> {
  const aliasesByApp: Record<string, string[]> = {};

  for (const [alias, targets] of Object.entries(paths)) {
    const app = /^(?:\.\/)?apps\/([^/]+)\//.exec(targets[0] ?? '')?.[1];

    if (app) {
      (aliasesByApp[app] ??= []).push(alias);
    }
  }

  for (const aliases of Object.values(aliasesByApp)) {
    aliases.sort();
  }

  return aliasesByApp;
}
