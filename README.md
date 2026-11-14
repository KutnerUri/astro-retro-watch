# Retro Watch

An interactive timeline of planetary retrograde periods. It shows a smoothed overlap curve and
one Gantt row per planet, at a years scale and a months scale, with a "today" marker.

Status: early. Research and design notes are in [research/NOTES.md](research/NOTES.md).

## Develop

```bash
bun install
bun run dev
```

Retrograde data (`data/retrogrades.json`, 1900–2100) is generated, not hand-edited:

```bash
bun scripts/gen-retrogrades.ts 1900 2100   # regenerate
bun scripts/check-retrogrades.ts           # compare with Swiss Ephemeris dates, 2013–2031
```

## Stack

- [Astro](https://astro.build) builds the static site. The page is plain HTML, so search engines can read it.
- The chart is plain TypeScript drawing SVG, with `d3-scale` and `d3-shape`.
- [nanostores](https://github.com/nanostores/nanostores) holds shared state as atoms, such as the date of the "today" line.
- [astronomy-engine](https://github.com/cosinekitty/astronomy) is used at build time only, to compute retrograde dates.

## License

MIT
