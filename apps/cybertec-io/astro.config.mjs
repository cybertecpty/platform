import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Plain Nx project (ADR 0012): the targets in project.json wrap the Astro CLI.
export default defineConfig({
  // Canonical origin; drives the canonical, Open Graph and structured-data URLs.
  site: 'https://cybertec.io',
  // Build into the workspace-root dist/ tree, like every other project.
  outDir: '../../dist/apps/cybertec-io',
  vite: {
    plugins: [tailwindcss()]
  }
});
