import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

// Asserts over the built static output (the `test` target dependsOn `build`).
const distDir = join(dirname(fileURLToPath(import.meta.url)), '../../../dist/apps/cybertec-io');

// Section anchors in page order (header nav and CTAs target these).
const SECTIONS = ['top', 'services', 'skills', 'principles', 'experience', 'about', 'contact'];

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

  it('renders all seven section ids', () => {
    for (const id of SECTIONS) {
      expect(html, `missing section id="${id}"`).toContain(`id="${id}"`);
    }
  });

  it('has no dangling in-page anchors (every #href has a matching id)', () => {
    const hrefs = [...html.matchAll(/href="#([a-z0-9-]+)"/gi)].map(m => m[1].toLowerCase());
    const ids = new Set([...html.matchAll(/id="([a-z0-9-]+)"/gi)].map(m => m[1].toLowerCase()));
    const dangling = [...new Set(hrefs)].filter(h => !ids.has(h));
    expect(dangling, `anchors with no matching section: ${dangling.join(', ')}`).toEqual([]);
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

  it('serves a responsive, optimized portrait (Sharp <Image> srcset)', () => {
    // astro:assets emits hashed, re-encoded variants with a width descriptor.
    expect(html).toMatch(/srcset="[^"]*\.webp \d+w/);
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
});
