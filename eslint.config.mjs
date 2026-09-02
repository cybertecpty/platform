import nx from '@nx/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';

const lodashMessage =
  'Import from lodash-es instead so bundle builds can tree-shake lodash utilities.';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/coverage',
      '**/.nx',
      '**/node_modules',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/test-results',
      '**/playwright-report',
      '**/__screenshots__',
      '**/.angular'
    ]
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              // Frontend (browser) code must keep bundles small: zod's classic API
              // (`zod`, `zod/v4`) is not tree-shakeable. Browser code imports schema
              // builders from zod/mini and core errors/types from zod/v4/core.
              // Backend code has no bundle budget and is not constrained here.
              // The dependency graph itself is still open (`*`) until the module-
              // boundaries work lands the real tag matrix; only the external-import
              // ban is active now, and only for projects tagged `scope:frontend`.
              sourceTag: 'scope:frontend',
              onlyDependOnLibsWithTags: ['*'],
              bannedExternalImports: ['zod', 'zod/v4']
            },
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*']
            }
          ]
        }
      ]
    }
  },
  {
    // Bundle hygiene (all code, all extensions): lodash's CommonJS entry points
    // defeat tree-shaking, so every runtime import must go through lodash-es. The
    // TS-aware rule lets `import type` through since it is erased at build time.
    files: ['**/*.{ts,tsx,cts,mts,js,jsx,cjs,mjs}'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'lodash', message: lodashMessage, allowTypeImports: true }],
          patterns: [{ group: ['lodash/*'], message: lodashMessage, allowTypeImports: true }]
        }
      ]
    }
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs'
    ],
    // Override or add rules here
    rules: {}
  },
  // Keep last: turns off ESLint stylistic rules that would conflict with Prettier.
  // Formatting is owned by `nx format` / the Prettier extension, not ESLint.
  eslintConfigPrettier
];
