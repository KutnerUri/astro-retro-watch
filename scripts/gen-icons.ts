/**
 * Renders public/favicon.svg into the raster icons, after `astro build`:
 * - favicon.ico (32×32), for browsers and crawlers that don't take SVG icons
 * - apple-touch-icon.png (180×180), for iOS home screens
 * - icon-192.png and icon-512.png, for the web app manifest (site.webmanifest)
 *
 * The larger sizes are filled edge to edge (the platforms round the corners themselves).
 *
 * Run: bun scripts/gen-icons.ts (after astro build)
 */
import { Resvg } from '@resvg/resvg-js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const svg = await Bun.file(new URL('../public/favicon.svg', import.meta.url)).text();
const BG = '#07080d';

const png = (size: number, square: boolean) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size }, ...(square && { background: BG }) }).render().asPng();

// An ICO file may hold a PNG as is: a 6-byte header, one 16-byte directory entry, then the image.
function ico(image: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(22 + image.length);
  const v = new DataView(out.buffer);
  v.setUint16(2, 1, true); // type: icon
  v.setUint16(4, 1, true); // one image
  out[6] = size;
  out[7] = size;
  v.setUint16(10, 1, true); // colour planes
  v.setUint16(12, 32, true); // bits per pixel
  v.setUint32(14, image.length, true);
  v.setUint32(18, 22, true); // image offset
  out.set(image, 22);
  return out;
}

await Bun.write(join(dist, 'favicon.ico'), ico(png(32, false), 32));
await Bun.write(join(dist, 'apple-touch-icon.png'), png(180, true));
await Bun.write(join(dist, 'icon-192.png'), png(192, true));
await Bun.write(join(dist, 'icon-512.png'), png(512, true));
console.log('dist/favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png');
