/* global process, console, fetch */
// Compares the on-device prayer times (the `adhan` library, configured exactly as
// src/prayer/calc.ts does) with the live Aladhan service V1 used (method 1, school 1).
//
// This is a manual check for someone with internet access. The test suite never calls the
// network, so it cannot run there. It exits with a non-zero code when any time differs by more
// than one minute.
//
//   node packages/content/scripts/compare-aladhan.mjs
//   node packages/content/scripts/compare-aladhan.mjs 2026-12-21 2027-03-20     (other dates)
//
// Record the date you ran it and the result in docs/engineering/decisions/0007-prayer-times-and-hijri.md.

import { Coordinates, CalculationMethod, Madhab, PrayerTimes } from 'adhan';

const CITIES = [
  { name: 'Karachi', latitude: 24.8607, longitude: 67.0011 },
  { name: 'Lahore', latitude: 31.5204, longitude: 74.3587 },
  { name: 'Islamabad', latitude: 33.6844, longitude: 73.0479 },
  { name: 'Peshawar', latitude: 34.0151, longitude: 71.5249 },
  { name: 'Quetta', latitude: 30.1798, longitude: 66.975 },
  { name: 'Gilgit', latitude: 35.9208, longitude: 74.3144 },
];
const DATES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['2026-03-21', '2026-06-21', '2026-09-23', '2026-10-16', '2026-12-21'];
const PAKISTAN_OFFSET_MINUTES = 300;
const NAMES = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function onDevice(city, isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const params = CalculationMethod.Karachi();
  params.madhab = Madhab.Hanafi;
  params.methodAdjustments = { ...params.methodAdjustments, dhuhr: 0 };
  const t = new PrayerTimes(
    new Coordinates(city.latitude, city.longitude),
    new Date(y, m - 1, d),
    params,
  );
  const toMinutes = (date) => (Math.floor(date.getTime() / 60000) + PAKISTAN_OFFSET_MINUTES) % 1440;
  return [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha].map(toMinutes);
}

async function fromAladhan(city, isoDate) {
  const [y, m, d] = isoDate.split('-');
  const url =
    `https://api.aladhan.com/v1/timings/${d}-${m}-${y}` +
    `?latitude=${city.latitude}&longitude=${city.longitude}&method=1&school=1&timezonestring=Asia/Karachi`;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Aladhan answered ${response.status} for ${city.name} ${isoDate}`);
  const body = await response.json();
  const t = body.data.timings;
  return [t.Fajr, t.Sunrise, t.Dhuhr, t.Asr, t.Maghrib, t.Isha].map((hhmm) => {
    const [h, min] = hhmm.slice(0, 5).split(':').map(Number);
    return h * 60 + min;
  });
}

const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

let worst = 0;
let compared = 0;
for (const city of CITIES) {
  for (const date of DATES) {
    const mine = onDevice(city, date);
    const theirs = await fromAladhan(city, date);
    const diffs = mine.map((value, i) => value - theirs[i]);
    const flag = diffs.some((x) => Math.abs(x) > 1) ? '  <-- MORE THAN 1 MINUTE' : '';
    console.log(
      `${city.name.padEnd(10)} ${date}  ` +
        NAMES.map(
          (n, i) =>
            `${n} ${hhmm(mine[i])}/${hhmm(theirs[i])} (${diffs[i] >= 0 ? '+' : ''}${diffs[i]})`,
        ).join('  ') +
        flag,
    );
    for (const x of diffs) worst = Math.max(worst, Math.abs(x));
    compared += diffs.length;
  }
}
console.log(
  `\nCompared ${compared} times. Largest difference: ${worst} minute(s). Format: on-device/Aladhan.`,
);
process.exit(worst > 1 ? 1 : 0);
