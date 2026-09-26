import { defineConfig } from 'vitest/config';

// Build-output assertions over the static site (ADR 0007, 2026-09-23 amendment). The site
// has no TypeScript modules yet, so it is exempt from the coverage threshold. Add the
// coverage block from that amendment when the first `src/**/*.ts` module lands.
export default defineConfig({
  test: {
    name: 'cybertec-io',
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    passWithNoTests: true,
    watch: false
  }
});
