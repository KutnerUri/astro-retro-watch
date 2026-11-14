# Retro Watch

**See which planets are retrograde, and when their retrogrades overlap.**

Live: https://kutneruri.github.io/astro-retro-watch/

Retro Watch charts the apparent retrograde periods of Mercury, Venus, Mars, Jupiter, Saturn,
Uranus and Neptune, with a "today" line through every chart:

- **Years:** an overlap curve spanning ten years around today. It rises when several planets are
  retrograde at once. Under it is a timeline with one row per planet.
- **Months:** a year centred on today, with one wave for each planet's retrograde period.
- **Retrograde dates:** for each planet, whether it's retrograde now and when its next retrograde is.

Retrograde dates are available from 1900 to 2100.

## How it works

### Retrograde dates

A planet is *retrograde* when, seen from Earth, it appears to move backwards along the ecliptic
(its geocentric apparent ecliptic longitude is decreasing). It's an optical effect of Earth
overtaking the planet, or being overtaken by it.

[`scripts/gen-retrogrades.ts`](scripts/gen-retrogrades.ts) uses
[astronomy-engine](https://github.com/cosinekitty/astronomy) to sample each planet's longitude once
a day. Wherever the planet changes direction, it narrows the moment down to about a minute. The
output is [`data/retrogrades.json`](data/retrogrades.json): about 1,600 periods, 21 KB gzipped.

The dates are checked against Swiss Ephemeris times for 2013–2031:

| Planet | Typical difference |
|---|---|
| Mercury, Venus | a few minutes |
| Saturn, Uranus, Neptune | under ~2 hours |
| Mars | within ~1.5 hours |

Outer planets barely move when they turn, so a tiny difference in position shifts the time by hours.

### The overlap curve

Each retrograde period adds a smooth pulse: 0 when the planet turns retrograde, 1 at the middle
of the period and 0 again when it turns direct.

```
pulse(t) = sin²(π · (t − start) / (end − start))
overlap(t) = sum of every planet's pulse at time t
```

Every planet counts equally. The months view shows the individual pulses before they're added
together. Equal weights and the sin² shape are design choices that show timing and overlap. They
don't measure any physical force.

## Develop

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev      # http://localhost:4321/astro-retro-watch/
bun run build    # static site in dist/
```

Regenerate or check the data:

```bash
bun scripts/gen-retrogrades.ts 1900 2100   # writes data/retrogrades.json
bun scripts/check-retrogrades.ts           # compares with Swiss Ephemeris dates, 2013–2031
```

### Project layout

```
data/retrogrades.json      generated retrograde periods (don't edit by hand)
scripts/                   data generator, accuracy check, Swiss Ephemeris fixture
src/lib/retro.ts           data loading and the overlap function
src/lib/chart.ts           SVG renderers: years (curve + timeline) and months (waves)
src/lib/dates.ts           date text shared by the build and the browser
src/lib/store.ts           shared state (the "today" date) as nanostores atoms
src/pages/index.astro      the page
research/NOTES.md          background research and design notes
```

### Stack

- [Astro](https://astro.build) builds a static site, so the HTML includes real text that search engines can read.
- The charts are plain TypeScript drawing SVG, with [`d3-scale`](https://github.com/d3/d3-scale) and [`d3-shape`](https://github.com/d3/d3-shape). There's no UI framework.
- [nanostores](https://github.com/nanostores/nanostores) holds shared state.
- astronomy-engine runs only in the data script and never ships to the browser.

### Deploy

Every push to `main` deploys to GitHub Pages through
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). A daily scheduled build keeps the
static dates table current. The page also recalculates it in the browser, so it stays correct even
if a scheduled build doesn't run.

## Contributing

Issues and pull requests are welcome. If you change the data generator, run
`bun scripts/check-retrogrades.ts` and include its output in the PR.

## License

[MIT](LICENSE)
