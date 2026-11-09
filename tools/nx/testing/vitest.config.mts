import { defineConfig, mergeConfig } from 'vitest/config';

import { createBaseVitestConfig } from '../../../vitest.base.mts';

export default mergeConfig(
  createBaseVitestConfig(import.meta.dirname),
  defineConfig({
    test: {
      name: 'nx-testing',
      environment: 'node'
    }
  })
);
