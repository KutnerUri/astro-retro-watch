/**
 * Generates dist/og.png, the 1200×630 image shown when the site is shared, after `astro build`: it reads the
 * bare SVG that src/pages/og-map.astro built (the orbit map as of the build), renders it to PNG and removes
 * that page from the output.
 *
 * Run: bun scripts/gen-og.ts (after astro build)
 */
import { Resvg } from '@resvg/resvg-js';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const page = join(dist, 'og-map');

// WOFF 1.0 -> TTF: unpack each (zlib-compressed) table and lay them out again behind a plain sfnt header.
// resvg can't read WOFF, and @fontsource only ships web formats.
function woffToTtf(woff: Uint8Array): Uint8Array {
  const v = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  const n = v.getUint16(12);
  const tables = Array.from({ length: n }, (_, i) => {
    const o = 44 + i * 20;
    const [tag, off, comp, orig, sum] = [0, 4, 8, 12, 16].map((k) => v.getUint32(o + k));
    const raw = woff.subarray(off, off + comp);
    return { tag, sum, data: comp < orig ? new Uint8Array(inflateSync(raw)) : raw };
  });
  const head = 12 + 16 * n;
  const out = new Uint8Array(tables.reduce((s, t) => s + ((t.data.length + 3) & ~3), head));
  const w = new DataView(out.buffer);
  const es = Math.floor(Math.log2(n));
  w.setUint32(0, v.getUint32(4));
  w.setUint16(4, n);
  w.setUint16(6, 16 << es);
  w.setUint16(8, es);
  w.setUint16(10, n * 16 - (16 << es));
  let at = head;
  tables.forEach((t, i) => {
    const o = 12 + i * 16;
    w.setUint32(o, t.tag);
    w.setUint32(o + 4, t.sum);
    w.setUint32(o + 8, at);
    w.setUint32(o + 12, t.data.length);
    out.set(t.data, at);
    at += (t.data.length + 3) & ~3;
  });
  return out;
}

// The planet symbols' font, as on the page. This resvg version ignores in-memory fonts, so it goes to a temp file.
const woff = new URL('../node_modules/@fontsource/noto-sans-symbols/files/noto-sans-symbols-symbols-400-normal.woff', import.meta.url);
const fontPath = join(tmpdir(), 'retro-watch-noto-sans-symbols.ttf');
await Bun.write(fontPath, woffToTtf(new Uint8Array(await Bun.file(woff).arrayBuffer())));

// Astro puts a doctype in front of every page; the rest is the SVG.
const svg = (await Bun.file(join(page, 'index.html')).text()).replace(/^<!DOCTYPE html>/i, '');

// System fonts are the fallback for ⊕ (Earth), which the Noto subset lacks; the page falls back the same way.
const png = new Resvg(svg, { font: { fontFiles: [fontPath], loadSystemFonts: true, defaultFontFamily: 'Noto Sans Symbols' } })
  .render()
  .asPng();
await Bun.write(join(dist, 'og.png'), png);
await rm(page, { recursive: true });
console.log(`dist/og.png ${(png.length / 1024).toFixed(0)} KB`);
