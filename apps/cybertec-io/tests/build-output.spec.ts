import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

// Asserts over the built static output (the `test` target dependsOn `build`).
const distDir = join(dirname(fileURLToPath(import.meta.url)), '../../../dist/apps/cybertec-io');

describe('cybertec-io build output', () => {
  let html = '';

  beforeAll(() => {
    const indexPath = join(distDir, 'index.html');
    // Read lazily so a missing build fails this suite with a clear message
    // rather than crashing test discovery at import time. A plain throw, not
    // `expect`, since this is a precondition guard, not a test assertion
    // (vitest/no-standalone-expect).
    if (!existsSync(indexPath)) {
      throw new Error(`build output missing at ${indexPath}; run \`nx build cybertec-io\` first`);
    }
    html = readFileSync(indexPath, 'utf8');
  });

  it('renders the page copy and no in-page anchors', () => {
    expect(html).toContain('<title>CyberTec</title>');
    expect(html).toContain('<h1');
    expect(html).toMatch(/What I.m working on/);
    expect(html).toContain('© 2026 CyberTec');
    expect(html).not.toMatch(/href="#/);
  });

  it('links GitHub, LinkedIn, the platform repo and email', () => {
    for (const href of [
      'https://github.com/cybertecpty"',
      'https://linkedin.com/in/djmcgrath101"',
      'https://github.com/cybertecpty/platform"',
      'mailto:contact@cybertec.io"'
    ]) {
      expect(html, `missing link ${href}`).toContain(`href="${href}`);
    }
  });

  it('avoids retired positioning language', () => {
    expect(html).not.toMatch(/consultant|contractor|full-stack|coming soon|under construction/i);
  });

  it('includes the core SEO and social meta', () => {
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('name="description"');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toMatch(/application\/ld\+json/);
    // Whitespace-tolerant so pretty-printed and minified JSON-LD both pass.
    expect(html).toMatch(/"@type"\s*:\s*"Person"/);
  });

  it('wires the social card image (og:image and large-image card)', () => {
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:image"');
    expect(html).toContain('content="summary_large_image"');
  });

  it('serves the optimized portrait above the name (Sharp <Image> srcset)', () => {
    expect(html).toMatch(/srcset="[^"]*\.webp \d+w/);
    expect(html.indexOf('alt="Daniel McGrath"')).toBeLessThan(html.indexOf('<h1'));
  });

  it('emits robots.txt, sitemap.xml, and the favicon and og raster assets', () => {
    for (const file of ['robots.txt', 'sitemap.xml', 'favicon.ico', 'og-image.png']) {
      expect(existsSync(join(distDir, file)), `missing ${file}`).toBe(true);
    }
  });

  it('compiles the Tailwind utilities and design tokens into the stylesheet', () => {
    const cssHrefs = [...html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)].map(m => m[1]);
    const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
    const css = [
      ...inlineCss,
      ...cssHrefs.map(href => readFileSync(join(distDir, href), 'utf8'))
    ].join('\n');
    // A custom token utility (bg-ink) and a project utility (.site-container)
    // only appear if the Tailwind v4 theme and @utility blocks compiled.
    expect(css).toMatch(/\.bg-ink\b/);
    expect(css).toMatch(/\.site-container\b/);
  });

  it('loads the Cloudflare Web Analytics beacon as a deferred module', () => {
    const beacon =
      /<script\b[^>]*src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"[^>]*>/.exec(
        html
      )?.[0];
    expect(beacon, 'missing Cloudflare beacon script').toBeDefined();
    expect(beacon).toContain('type="module"');
    // Astro entity-encodes the JSON attribute value; decode it as a browser would.
    const config = /data-cf-beacon="([^"]*)"/.exec(beacon ?? '')?.[1]?.replaceAll('&quot;', '"');
    expect(JSON.parse(config ?? '{}')).toEqual({ token: expect.stringMatching(/^[0-9a-f]{32}$/) });
  });
});
