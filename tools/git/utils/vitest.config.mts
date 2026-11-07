import { defineConfig, mergeConfig } from 'vitest/config';

import { createSharedVitestConfig } from '../../../vitest.shared';

export default mergeConfig(
  createSharedVitestConfig(import.meta.dirname),
  defineConfig({
    test: {
      name: 'git-utils',
      environment: 'node'
    }
  })
);
