import data from '../../data/retrogrades.json';

export const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as const;
export type Planet = (typeof PLANETS)[number];

/** Astronomical symbols. U+FE0E asks for the text (not emoji) form of ♀ and ♂. */
export const GLYPH: Record<Planet, string> = {
  Mercury: '☿',
  Venus: '♀\uFE0E',
  Mars: '♂\uFE0E',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '⛢',
  Neptune: '♆',
};

export interface Period {
  planet: Planet;
  start: number; // epoch ms
  end: number;
}

export const periods: Record<Planet, Period[]> = Object.fromEntries(
  PLANETS.map((planet) => [
    planet,
    (data.planets as Record<string, [string, string][]>)[planet].map(([s, e]) => ({
      planet,
      start: Date.parse(s),
      end: Date.parse(e),
    })),
  ]),
) as Record<Planet, Period[]>;

export const dataRange = data.range as [number, number];

/** The period of `planet` active at time t, if any. */
export function activeAt(planet: Planet, t: number): Period | undefined {
  return periods[planet].find((p) => p.start <= t && t < p.end);
}

/** Next period of `planet` starting after t. */
export function nextAfter(planet: Planet, t: number): Period | undefined {
  return periods[planet].find((p) => p.start > t);
}

/**
 * Smoothed overlap score: each retrograde period contributes a sin² pulse that is
 * 0 at its stations and 1 at its midpoint. Summed over planets. Arbitrary units:
 * it shows how much retrograde time overlaps, not any physical force.
 */
export function overlap(t: number): number {
  let sum = 0;
  for (const planet of PLANETS) {
    const p = activeAt(planet, t);
    if (p) sum += pulse(p, t);
  }
  return sum;
}

const pulse = (p: Period, t: number) => Math.sin((Math.PI * (t - p.start)) / (p.end - p.start)) ** 2;

/** overlap() sampled every `step` ms from `from` to `to`, in one sweep per planet. */
export function sampleOverlap(from: number, to: number, step: number): [number, number][] {
  const n = Math.ceil((to - from) / step) + 1;
  const values = new Float64Array(n);
  for (const planet of PLANETS) {
    const list = periods[planet];
    let i = list.findIndex((p) => p.end > from);
    if (i < 0) continue;
    for (let k = 0; k < n; k++) {
      const t = from + k * step;
      while (i < list.length && list[i].end <= t) i++;
      if (i >= list.length) break;
      if (list[i].start <= t) values[k] += pulse(list[i], t);
    }
  }
  return Array.from(values, (v, k) => [from + k * step, v]);
}
