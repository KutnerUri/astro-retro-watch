import type { Period } from './retro';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "9 Feb 2027", in UTC. Formatted by hand, not with toLocaleDateString, so the
 * static build and the browser print identical text.
 */
export const fmtDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export const nowText = (current: Period | undefined) => (current ? `Retrograde until ${fmtDate(current.end)}` : 'Direct');

export const nextText = (next: Period) => `${fmtDate(next.start)} – ${fmtDate(next.end)}`;
