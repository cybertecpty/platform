// Generates the brand raster assets that need an image toolchain (Sharp), from
// the vendored brand SVGs — committed to public/ as stable-URL static assets:
//
//   public/og-image.png   1200×630 social card — the light primary lockup
//                          centered on the ink field (og:image / twitter:image).
//   public/favicon.ico     16/32/48 multi-res .ico fallback for the SVG favicon
//                          (ink mark on the copper rounded field).
//
// Re-run after a brand-asset change:  node apps/cybertec-io/scripts/generate-brand-rasters.mjs
// The .ico is packed inline (PNG-compressed ICO) so no extra dependency is needed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const brand = join(appRoot, 'public', 'brand');
const out = join(appRoot, 'public');

const INK = { r: 0x14, g: 0x11, b: 0x0d, alpha: 1 };

// --- og-image.png (1200×630) -------------------------------------------------
// The light primary lockup (its own #e8e3d8 panel) centered on the ink field.
const OG_W = 1200;
const OG_H = 630;
const lockupWidth = 760; // 410×113 source ratio → ~760×209 centered with margin

const lockup = await sharp(join(brand, 'cybertec-primary-light.svg'), { density: 384 })
  .resize({ width: lockupWidth })
  .png()
  .toBuffer();
const lockupMeta = await sharp(lockup).metadata();
// `metadata().height` is typed optional; fall back so the centering math can
// never produce NaN (which Sharp's composite `top` rejects).
const lockupHeight = lockupMeta.height ?? OG_H;

await sharp({
  create: { width: OG_W, height: OG_H, channels: 4, background: INK }
})
  .composite([
    {
      input: lockup,
      top: Math.round((OG_H - lockupHeight) / 2),
      left: Math.round((OG_W - lockupWidth) / 2)
    }
  ])
  .png()
  .toFile(join(out, 'og-image.png'));

// --- favicon.ico (16/32/48, PNG-compressed) ----------------------------------
const faviconSvg = readFileSync(join(out, 'favicon.svg'));
const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map(size => sharp(faviconSvg, { density: 384 }).resize(size, size).png().toBuffer())
);

// ICO container: 6-byte header + 16-byte directory entry per image + PNG blobs.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);

let offset = 6 + sizes.length * 16;
const entries = [];
for (let i = 0; i < sizes.length; i++) {
  const size = sizes[i];
  const png = pngs[i];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 ⇒ 256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image size
  entry.writeUInt32LE(offset, 12); // image offset
  offset += png.length;
  entries.push(entry);
}

writeFileSync(join(out, 'favicon.ico'), Buffer.concat([header, ...entries, ...pngs]));

console.log('Wrote public/og-image.png (1200×630) and public/favicon.ico (16/32/48).');
