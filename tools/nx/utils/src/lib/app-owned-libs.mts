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

const CODE_EXTENSIONS = '{ts,tsx,cts,mts,js,jsx,cjs,mjs}';

/** A flat-config block that restricts imports, as far as `eslint.config.mjs` needs to describe it. */
export interface AppOwnedImportBlock {
  basePath: string;
  files: string[];
  ignores?: string[];
  rules: { 'no-restricted-imports': ['error', { paths: RestrictedPath[] }] };
}

interface RestrictedPath {
  message: string;
  name: string;
}

/**
 * The ESLint flat-config blocks that keep the libs an app owns (ADR 0023) inside that app: a lib
 * under `apps/<app>/` may be imported only by code under `apps/<app>/`. `aliasesByApp` is what
 * `appOwnedLibAliases` returns; with no owned lib there are no blocks.
 *
 * `@nx/enforce-module-boundaries` cannot do this, since it selects its rules by the importing
 * project's tags and has no negation. The base `no-restricted-imports` is free for it, because the
 * workspace's lodash and testing bans use the TypeScript-aware rule.
 *
 * Like `dep-constraints-const.mts`, this file has no value imports and keeps the `.mts` extension
 * so that bare Node can load it from `eslint.config.mjs`.
 *
 * @param aliasesByApp - The import aliases of each app's libs, keyed by app name.
 * @param basePath - The workspace root, which pins the globs to it whichever project is linted.
 *
 * @example
 * appOwnedImportBlocks({ 'cybertec-io': ['@cybertecpty/billing-ui'] }, workspaceRoot);
 * // => [{
 * //   basePath: workspaceRoot,
 * //   files: ['**\/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}'],
 * //   ignores: ['apps/cybertec-io/**'],
 * //   rules: { 'no-restricted-imports': ['error', { paths: [{ name: '@cybertecpty/billing-ui', message: '...' }] }] }
 * // }]
 */
export function appOwnedImportBlocks(
  aliasesByApp: Readonly<Record<string, readonly string[]>>,
  basePath: string
): AppOwnedImportBlock[] {
  const apps = Object.keys(aliasesByApp);

  const message = (app: string) =>
    `This lib belongs to the app "${app}" (ADR 0023), so only code under apps/${app}/ may import it. Move it to libs/ to share it.`;

  /** Every alias the given apps own, each with the message naming its owner. */
  const restrictedPaths = (ownerApps: string[]): RestrictedPath[] =>
    ownerApps.flatMap(app =>
      aliasesByApp[app].map(alias => ({ message: message(app), name: alias }))
    );

  const restrictImports = (paths: RestrictedPath[]): AppOwnedImportBlock['rules'] => ({
    'no-restricted-imports': ['error', { paths }]
  });

  // Code outside every owning app may import none of the owned libs.
  const outsideTheApps: AppOwnedImportBlock = {
    basePath,
    files: [`**/*.${CODE_EXTENSIONS}`],
    ignores: apps.map(app => `apps/${app}/**`),
    rules: restrictImports(restrictedPaths(apps))
  };

  // Code inside an app may import its own libs, but not another app's. An app that is alone has
  // nothing to ban, so it needs no block.
  const insideEachApp: AppOwnedImportBlock[] = apps
    .map(app => ({ app, paths: restrictedPaths(apps.filter(other => other !== app)) }))
    .filter(({ paths }) => paths.length > 0)
    .map(({ app, paths }) => ({
      basePath,
      files: [`apps/${app}/**/*.${CODE_EXTENSIONS}`],
      rules: restrictImports(paths)
    }));

  return apps.length > 0 ? [outsideTheApps, ...insideEachApp] : [];
}
