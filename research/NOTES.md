# retro-watch: research notes

Collected on 2026-11-14 before starting implementation. Nothing here is built yet.

## Where the original work came from

| What | Original location | Copied to |
|---|---|---|
| Chart scripts, input data, SVG/PNG outputs, source notes | `~/Documents/Codex/2026-10-26/new-chat/information-chart/` | `reference/information-chart/` |
| Final 17-slide carousel (1080×1350) and chart sources | `~/Downloads/retro-pocalypse-complete-carousel/` | `reference/carousel/` |
| Retrograde intervals with Mars included | `information-chart/planet-model-clean/intervals-used.json` | `../data/retrograde-intervals-2013-2031.json` |

These were not copied:
- `planet-model-clean/samples.{csv,json}` (9.5 MB). `model.py` can regenerate them.
- Zips, `__pycache__` and `test.*`.
- `~/Downloads/climax-information-overlay`. It's an older subset of the Codex folder.

There was no ephemeris script on disk. The intervals were computed in a chat session elsewhere
using Swiss Ephemeris 2.10.03.2 (Moshier). Each interval is a period when the planet's geocentric
apparent ecliptic longitude is decreasing. Stations were found by checking each day, then bisecting.
The times are UTC and accurate to within a few minutes.

## Data we have

`data/retrograde-intervals-2013-2031.json`: 130 intervals, `{planet, start_utc, end_utc, ...}`

| Planet | Count | Coverage |
|---|---:|---|
| Mercury | 57 | 2013-02 → 2031 |
| Venus | 11 | |
| Mars | 8 | |
| Saturn | 18 | |
| Uranus | 18 | |
| Neptune | 18 | |

Jupiter and Pluto aren't included. Decide whether to add them. Jupiter is a traditional planet,
so leaving it out is noticeable.

Limit: the data covers 2013–2031 only. Showing older history and the far future means computing
retrogrades ourselves. See below.

## Planned visual (from the user, not implemented)

One vertical **"today" line** runs through every panel. Top to bottom:

1. **Years scale:** a smoothed sum of sine curves (the overlap score below).
2. **Years-scale Gantt:** one row per planet, with bars for retrograde periods.
3. **Months scale:** the same overlap graph, zoomed in around today.
4. **Months-scale Gantt:** one row per planet on the same zoomed axis.

Users should be able to look back into history and forward into the near and far future
(pan or zoom, or a date picker).

## The overlap model (from `reference/information-chart/planet-model-clean/`)

- For each retrograde window `[a,b]`: `q(t) = sin²(π(t−a)/(b−a))` inside the window, and 0 outside.
- `Q(t) = Σ q_p(t)`. Each planet's peak is 1 by default.
- The curve is smooth (C¹) at the stations. Its unit is arbitrary: it shows overlap, not force or intensity.
- `weighting-review.md` covers other weightings: equal area (`w = 22.19/D`) or an editorial
  emphasis (Mercury, Venus, Mars 1; Saturn 0.75; Uranus, Neptune 0.5). Both are design choices.
  Equal peaks is the documented default.
- The README rejects a pure cosine sum as a weak overlap score. Each cosine is positive half
  the time, and negative values cancel.
- Mean synodic recurrence in days, with mean retrograde duration:
  Mercury 116/22, Venus 584/42, Mars 780/74, Saturn 378/139, Uranus 370/152, Neptune 367/159.
- The 2013–2030 peak with equal weights is about 3.49, on 2026-11-01.

## Computing retrogrades for any date (needed for history and the future)

Option A (likely best): compute in the browser.
- Use a JS ephemeris library. The candidate is **astronomy-engine** (cosinekitty/astronomy,
  MIT license, no dependencies, about 1 arcminute accuracy). Verify its license, valid date range
  and API before relying on it.
- Algorithm: sample geocentric ecliptic longitude daily, then find where its rate changes sign.
  Unwrap the longitude across 0/360° first. Bisect each sign change to the minute.
- Speed check: Mercury has about 3 retrogrades a year, so even ±200 years is a few thousand
  stations. Daily sampling of 7 planets over 400 years is about 1M evaluations. Do it in a
  Web Worker or compute lazily as the view moves.
- Validation: the result must match `data/retrograde-intervals-2013-2031.json` to within minutes.
  That file is our test fixture.

Option B: precompute a JSON file, say 1900–2100, at build time with Python `pyswisseph`.
Swiss Ephemeris is AGPL or commercial, which matters for an open-source repo. Moshier mode needs
no data files.

Possible approach: Option A at runtime, plus a precomputed file for fast first paint and SEO text
such as "next Mercury retrograde: …".

## Content and claims hygiene

The original notes are careful, and the site should keep that care:
- "Alignment" means retrograde periods overlap in time. It isn't a physical alignment.
- The overlap score doesn't measure force, influence or probability.
- The economic overlay charts (IMF, BIS, UCDP, WID, Stanford AI Index) are separate and only
  show correlation. If they're reused, keep `reference/information-chart/source/SOURCES.md`
  attribution and licenses (check UCDP and WID terms).
- The carousel's dated hooks, such as the 27 Oct 2026 Knesset election and the 3 Nov 2026 US
  midterms, are now in the past.

## Hosting, indexing and spread

- Hosting: GitHub Pages is fine. Cloudflare Pages and Netlify would rank the same.
  A custom domain helps with trust and sharing.
- Indexing: Google finds new sites through links. A site with no inbound links can wait weeks
  or never be crawled. Search Console plus a sitemap speeds that up.
- Put real HTML text on the page with dates for current and next retrogrades. A canvas-only
  chart gives Google nothing to read.
- Add Open Graph and Twitter cards with a preview image, since most early traffic will come from
  shares. A daily-rebuilt OG image showing "today" would be a strong hook.
- Possible static pages for search: `/mercury-retrograde-2027` and similar.

## Open questions

- Include Jupiter and Pluto? Mars is in the model data but wasn't on the slides.
- Default weighting: equal peaks, or let users switch.
- Chart stack: plain SVG with d3-scale/d3-zoom, or a library? Framework: plain Vite, or Astro
  for static SEO pages?
- Domain name.

## Existing sites (checked 2026-11-14)

The full combination isn't done anywhere: smoothed overlap curve, two-scale Gantt, today line,
and long history/future. The closest tools:
- **TradingView "Planetary Retrograde Dashboard"** (MIT): shades retrograde periods over a price
  chart and has a histogram of how many planets are retrograde. It only works inside TradingView,
  with no Gantt rows and no zooming between scales.
  https://www.tradingview.com/script/QG4Rr9kx-Planetary-Retrograde-Dashboard/
- Other TradingView scripts: "Planetary Retrograde Periods" (one planet at a time) and
  "Retrograde Periods (Multi-Planet)" (2009–2026 dates hard-coded).
- Augurine (https://www.augurine.com/tools/retrogrades): cards showing what's retrograde now, no timeline.
- Date tables: Cafe Astrology, bonniesorsby.com (2026–2032), retrograde.pro (2026 calendar,
  describes overlaps in words). None have charts.
- Explainers of the retrograde illusion: Elysia Tools, Dekhopanchang. Overlap statistics:
  gregoryrozek.com "rx-centuries" (records per century, static).
- No GitHub repo, Observable notebook or Show HN post for a retrograde timeline was found.

Ways to stand out: a standalone, free, good-looking site; the overlap curve; linked year and month
scales; scrolling across centuries; shareable date links; shading for the shadow periods around
each retrograde; marking record overlaps (e.g. 5 planets retrograde from 24 Oct to 13 Nov 2026).

Library choice confirmed: **astronomy-engine** (npm, v2.1.19, MIT, about ±1 arcminute). It has
no station finder, so we write our own: sample the geocentric ecliptic longitude, find where its
rate changes sign, and bisect. Alternatives: mivion/ephemeris and the npm `ephemeris` package
(GPL-2.0), and Swiss Ephemeris ports (AGPL or commercial).
