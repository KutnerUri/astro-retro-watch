/**
 * Generates public/calendar/*.ics from data/retrogrades.json. The files are committed, not built on deploy:
 * they don't depend on today's date. Rerun after changing the wording, the range or the data. UIDs are stable,
 * so subscribers' events are updated in place.
 *
 * Run: bun scripts/gen-calendars.ts
 */
import { mkdirSync } from 'node:fs';
import astroConfig from '../astro.config.mjs';
import { GROUPS, INNER, SINGLES, type Calendar } from '../src/lib/calendars';
import { GLYPH, periods, type Period } from '../src/lib/retro';

const FROM_YEAR = 2025;
const TO_YEAR = 2050;
const SITE = new URL('/', astroConfig.site).href;
const OUT = new URL('../public/calendar/', import.meta.url).pathname;
/** Fixed, so that a rerun without changes gives identical files. Raise it when the events change. */
const STAMP = '20261124T000000Z';

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Feb 2, 2036", in UTC: the month in letters reads the same in every locale. */
const longDate = (ms: number) => {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};
const icsDate = (ms: number) => new Date(ms).toISOString().slice(0, 10).replaceAll('-', '');
const escape = (s: string) => s.replace(/[\;,]/g, '\\$&').replaceAll('\n', '\\n');

/** iCalendar lines are at most 75 bytes; longer ones continue on the next line after a space. */
function fold(line: string): string {
  let out = '';
  let bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > 75) {
      out += '\r\n ';
      bytes = 1;
    }
    out += ch;
    bytes += n;
  }
  return out;
}

/** An all-day event from the day of `first` through the day of `last`. */
function event(p: Period, kind: 'span' | 'start' | 'end', first: number, last: number): string[] {
  const title = `${GLYPH[p.planet]} ${p.planet} retrograde${kind === 'span' ? '' : ` ${kind}s`}`;
  const notes = `${p.planet} retrograde starts on ${longDate(p.start)} and continues all the way to ${longDate(p.end)}.\n\n${SITE}`;
  return [
    'BEGIN:VEVENT',
    // Year and month identify a retrograde even if its exact time is ever refined.
    `UID:${p.planet.toLowerCase()}-${icsDate(p.start).slice(0, 6)}-${kind}@${new URL(SITE).hostname}`,
    `DTSTAMP:${STAMP}`,
    `DTSTART;VALUE=DATE:${icsDate(first)}`,
    `DTEND;VALUE=DATE:${icsDate(last + DAY)}`, // exclusive
    `SUMMARY:${escape(title)}`,
    `DESCRIPTION:${escape(notes)}`,
    `URL:${SITE}`,
    'TRANSP:TRANSPARENT', // shows as free
    'END:VEVENT',
  ];
}

function ics(cal: Calendar): string {
  const events = cal.planets
    .flatMap((planet) => periods[planet])
    .filter((p) => new Date(p.end).getUTCFullYear() >= FROM_YEAR && new Date(p.start).getUTCFullYear() <= TO_YEAR)
    .sort((a, b) => a.start - b.start)
    .flatMap((p) =>
      INNER.includes(p.planet)
        ? event(p, 'span', p.start, p.end)
        : [...event(p, 'start', p.start, p.start), ...event(p, 'end', p.end, p.end)],
    );
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Retrograde Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${escape(cal.name)}`,
    `X-WR-CALNAME:${escape(cal.name)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:P7D',
    'X-PUBLISHED-TTL:P7D',
    ...events,
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

mkdirSync(OUT, { recursive: true });
for (const cal of [...GROUPS, ...SINGLES]) await Bun.write(`${OUT}${cal.id}.ics`, ics(cal));
