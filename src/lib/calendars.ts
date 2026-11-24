import { PLANETS, type Planet } from './retro';

/** Inner planets get one event across the whole retrograde; outer ones (months long) get start and end days. */
export const INNER: readonly Planet[] = ['Mercury', 'Venus', 'Mars'];
export const OUTER: readonly Planet[] = PLANETS.filter((p) => !INNER.includes(p));

export interface Calendar {
  /** File name in public/calendar/. People subscribe to these URLs, so never rename one. */
  id: string;
  /** Button text. */
  label: string;
  /** The calendar's name in the subscriber's app. */
  name: string;
  planets: readonly Planet[];
}

export const GROUPS: readonly Calendar[] = [
  { id: 'all', label: 'All', name: 'Planet retrogrades', planets: PLANETS },
  { id: 'inner', label: 'Inner planets', name: 'Inner planet retrogrades', planets: INNER },
  { id: 'outer', label: 'Outer planets', name: 'Outer planet retrogrades', planets: OUTER },
];

export const SINGLES: readonly Calendar[] = PLANETS.map((planet) => ({
  id: planet.toLowerCase(),
  label: planet,
  name: `${planet} retrograde`,
  planets: [planet],
}));
