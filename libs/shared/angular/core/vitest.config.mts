import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, mergeConfig } from 'vitest/config';

import { createBaseVitestConfig } from '../../../../vitest.base.mts';

export default mergeConfig(
  createBaseVitestConfig(import.meta.dirname),
  defineConfig({
    plugins: [angular()],
    test: {
      name: 'angular-core',
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      coverage: { exclude: ['src/test-setup.ts'] }
    }
  })
);
