import { atom } from 'nanostores';

/** The date the "today" line is drawn at. Defaults to now; could later follow a ?date= URL param. */
export const $today = atom<Date>(new Date());

/** Centre of the months view, when the visitor has moved it. null = follow today. */
export const $focus = atom<number | null>(null);
