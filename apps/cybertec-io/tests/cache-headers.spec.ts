import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

interface Route {
  headers?: Record<string, string>;
  route: string;
}

interface SwaConfig {
  globalHeaders?: Record<string, string>;
  routes?: Route[];
}

// Asserts over the emitted Azure Static Web Apps config (the `test` target dependsOn `build`).
const distDir = join(dirname(fileURLToPath(import.meta.url)), '../../../dist/apps/cybertec-io');

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const IMAGE_EXT = /\.(ico|png|svg|webp|jpe?g|gif|avif)$/;

/** The first route SWA would match for a URL path: exact, or a trailing `/*` prefix. */
function routeFor(routes: Route[], path: string): Route | undefined {
  return routes.find(({ route }) =>
    route.endsWith('/*') ? path.startsWith(route.slice(0, -1)) : path === route
  );
}

/** Every emitted file, as the URL path SWA serves it at. */
function listDistFiles(): string[] {
  return readdirSync(distDir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(
      entry => '/' + relative(distDir, join(entry.parentPath, entry.name)).replaceAll('\\', '/')
    );
}

describe('cybertec-io cache headers', () => {
  let config: SwaConfig = {};
  let routes: Route[] = [];

  beforeAll(() => {
    const configPath = join(distDir, 'staticwebapp.config.json');
    // A plain throw, not `expect`: a precondition guard (vitest/no-standalone-expect).
    if (!existsSync(configPath)) {
      throw new Error(`build output missing at ${configPath}; run \`nx build cybertec-io\` first`);
    }
    config = JSON.parse(readFileSync(configPath, 'utf8')) as SwaConfig;
    routes = config.routes ?? [];
  });

  it('caches every hashed /_astro asset for a year as immutable', () => {
    const assets = listDistFiles().filter(path => path.startsWith('/_astro/'));
    expect(assets.length).toBeGreaterThan(0);
    for (const path of assets) {
      expect(routeFor(routes, path)?.headers?.['Cache-Control'], `route for ${path}`).toBe(
        IMMUTABLE_CACHE_CONTROL
      );
    }
  });

  it('gives every unhashed image a bounded, non-immutable cache lifetime', () => {
    const images = listDistFiles().filter(
      path => !path.startsWith('/_astro/') && IMAGE_EXT.test(path)
    );
    expect(images.length).toBeGreaterThan(0);
    for (const path of images) {
      const cacheControl = routeFor(routes, path)?.headers?.['Cache-Control'] ?? '';
      expect(cacheControl, `route for ${path}`).toMatch(/^public, max-age=\d+/);
      expect(cacheControl, `route for ${path}`).not.toContain('immutable');
    }
  });

  it('leaves HTML on the revalidating default', () => {
    expect(config.globalHeaders?.['Cache-Control']).toBeUndefined();
    for (const path of ['/', '/index.html']) {
      expect(
        routeFor(routes, path)?.headers?.['Cache-Control'],
        `route for ${path}`
      ).toBeUndefined();
    }
  });
});
